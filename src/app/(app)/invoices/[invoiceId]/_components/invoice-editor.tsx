'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { useToast } from '@/components/ui/use-toast';
import { setInvoiceMeta, upsertLineItems, sendInvoiceEmail, type InvoiceLineItemInput, type InvoiceRow } from '@/server/invoices';

type ClientSummary = {
  name: string;
  address: string | null;
  postcode: string | null;
  email: string | null;
  phone: string | null;
};

type JobSummary = {
  address: string | null;
  title: string | null;
};

type InvoiceEditorProps = {
  invoice: InvoiceRow;
  lineItems: InvoiceLineItemInput[];
  client: ClientSummary | null;
  job: JobSummary | null;
  certificateType?: string | null;
  returnTo?: string;
};

type InvoiceStatus = 'draft' | 'unpaid' | 'overdue' | 'paid';

const STATUS_BADGE: Record<InvoiceStatus, { bg: string; color: string; label: string }> = {
  draft:   { bg: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', label: 'Draft' },
  unpaid:  { bg: '#faeeda', color: '#BA7517',         label: 'Unpaid' },
  overdue: { bg: '#fcebeb', color: '#a32d2d',         label: 'Overdue' },
  paid:    { bg: '#edf7f2', color: '#1a7a52',         label: 'Paid' },
};

const STATUS_SEGMENTS: Array<{ value: InvoiceStatus; label: string; activeBg: string; activeColor: string }> = [
  { value: 'draft',   label: 'Draft',   activeBg: 'var(--color-background-secondary)', activeColor: 'var(--color-text-secondary)' },
  { value: 'unpaid',  label: 'Unpaid',  activeBg: '#faeeda', activeColor: '#BA7517' },
  { value: 'overdue', label: 'Overdue', activeBg: '#fcebeb', activeColor: '#a32d2d' },
  { value: 'paid',    label: 'Paid',    activeBg: '#edf7f2', activeColor: '#1a7a52' },
];

const LAST_USED_PRICE_STORAGE_KEY = 'certnow.invoice.last-used-prices';

const DEFAULT_LINE_ITEM_BY_CERTIFICATE_TYPE: Record<string, string> = {
  cp12: 'Gas Safety Certificate (CP12)',
  gas_warning_notice: 'Gas Warning Notice Inspection',
};

function getInitials(name: string) {
  const words = name.trim().split(/\s+/);
  if (!words.length || !words[0]) return '?';
  if (words.length === 1) return (words[0][0] ?? '?').toUpperCase();
  return ((words[0][0] ?? '') + (words[words.length - 1][0] ?? '')).toUpperCase();
}

function getVatPercentDisplay(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '20';
  return String(numeric <= 1 ? numeric * 100 : numeric);
}

function normalizeVatPercent(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return numeric;
}

function readLastUsedPrice(certificateType: string | null | undefined) {
  if (!certificateType || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_USED_PRICE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, number>;
    const value = parsed[certificateType];
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeLastUsedPrice(certificateType: string | null | undefined, unitPrice: number) {
  if (!certificateType || typeof window === 'undefined' || !Number.isFinite(unitPrice) || unitPrice < 0) return;
  try {
    const raw = window.localStorage.getItem(LAST_USED_PRICE_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    parsed[certificateType] = unitPrice;
    window.localStorage.setItem(LAST_USED_PRICE_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

function splitAddressParts(value: string | null | undefined) {
  return String(value ?? '')
    .split(/[\r\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseMoneyInput(value: string) {
  const sanitized = value.replace(/[^\d.]/g, '');
  const numeric = Number(sanitized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function computeInitialStatus(
  status: string | null | undefined,
  dueDate: string | null | undefined,
): InvoiceStatus {
  const s = (status ?? '').toLowerCase();
  if (s === 'paid') return 'paid';
  if (s === 'overdue') return 'overdue';
  if (
    dueDate &&
    !Number.isNaN(new Date(dueDate).getTime()) &&
    new Date(dueDate) < new Date()
  ) return 'overdue';
  if (s === 'unpaid') return 'unpaid';
  return 'draft';
}

function toInputDate(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(isoDate: string | null | undefined) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function InvoiceEditor({ invoice, lineItems, client, job, certificateType, returnTo = '/invoices' }: InvoiceEditorProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const defaultDescription = certificateType ? (DEFAULT_LINE_ITEM_BY_CERTIFICATE_TYPE[certificateType] ?? '') : '';
  const initialAddressParts = splitAddressParts(invoice.client_address_override ?? client?.address ?? job?.address ?? '');

  const [items, setItems] = useState<InvoiceLineItemInput[]>(
    lineItems.length
      ? lineItems
      : [{ description: defaultDescription, quantity: 1, unit_price: 0, vat_exempt: false }],
  );
  const [vatRate, setVatRate] = useState<string>(getVatPercentDisplay(invoice.vat_rate ?? 0.2));
  const [notes, setNotes] = useState<string>(invoice.notes ?? '');
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus>(
    computeInitialStatus(invoice.status, invoice.due_date),
  );
  const [dueDate, setDueDate] = useState<string>(() => {
    if (invoice.due_date) return toInputDate(invoice.due_date);
    const d = new Date(invoice.created_at);
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });

  // Client fields — editable, seeded from saved overrides or original job/client data.
  const [clientName, setClientName] = useState(invoice.client_name_override ?? client?.name ?? '');
  const [clientEmail, setClientEmail] = useState(invoice.client_email_override ?? client?.email ?? '');
  const [clientPhone, setClientPhone] = useState(invoice.client_phone_override ?? client?.phone ?? '');
  const [clientAddressLine1, setClientAddressLine1] = useState(initialAddressParts[0] ?? '');
  const [clientAddressLine2, setClientAddressLine2] = useState(
    initialAddressParts.length > 3
      ? initialAddressParts.slice(1, -2).join(', ')
      : (initialAddressParts[1] ?? ''),
  );
  const [clientCity, setClientCity] = useState(
    initialAddressParts.length >= 3 ? (initialAddressParts[initialAddressParts.length - 2] ?? '') : '',
  );
  const [clientPostcode, setClientPostcode] = useState(
    invoice.client_address_override
      ? (initialAddressParts.at(-1) ?? '')
      : (client?.postcode ?? ''),
  );

  useEffect(() => {
    if (!certificateType || lineItems.length > 0) return;
    const lastUsedPrice = readLastUsedPrice(certificateType);
    if (lastUsedPrice === null) return;
    setItems((prev) => {
      if (prev.length !== 1) return prev;
      const [firstItem] = prev;
      if (Number(firstItem?.unit_price ?? 0) > 0) return prev;
      return [{ ...firstItem!, unit_price: lastUsedPrice, description: firstItem?.description || defaultDescription }];
    });
  }, [certificateType, defaultDescription, lineItems.length]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => {
      const qty = Number(item.quantity ?? 0);
      const unit = Number(item.unit_price ?? 0);
      return sum + qty * unit;
    }, 0);
    const taxable = items.reduce((sum, item) => {
      if (item.vat_exempt) return sum;
      const qty = Number(item.quantity ?? 0);
      const unit = Number(item.unit_price ?? 0);
      return sum + qty * unit;
    }, 0);
    const rate = normalizeVatPercent(vatRate) / 100;
    const vat = taxable * rate;
    return { subtotal, vat, total: subtotal + vat };
  }, [items, vatRate]);

  const updateItem = (index: number, updates: Partial<InvoiceLineItemInput>) => {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...updates } : item)));
  };

  const addRow = () =>
    setItems((prev) => [...prev, { description: '', quantity: 1, unit_price: 0, vat_exempt: false }]);

  const removeRow = (index: number) => setItems((prev) => prev.filter((_, idx) => idx !== index));

  const buildSaveAddress = () => {
    const parts = [clientAddressLine1, clientAddressLine2, clientCity, clientPostcode]
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.filter((p, idx, arr) => arr.indexOf(p) === idx).join(', ');
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        await upsertLineItems(invoice.id, items.filter((item) => item.description?.trim().length));
        await setInvoiceMeta(invoice.id, {
          status: invoiceStatus,
          due_date: dueDate || null,
          vat_rate: normalizeVatPercent(vatRate) / 100,
          notes,
          client_name_override: clientName || null,
          client_address_override: buildSaveAddress() || null,
          client_email_override: clientEmail || null,
          client_phone_override: clientPhone || null,
        });
        const rememberedItem = items.find((item) => item.description?.trim() && Number(item.unit_price ?? 0) >= 0);
        if (rememberedItem) {
          writeLastUsedPrice(certificateType, Number(rememberedItem.unit_price ?? 0));
        }
        const response = await fetch(`/api/invoices/${invoice.id}/pdf`, { method: 'POST' });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? 'Unable to generate PDF');
        }
        pushToast({ title: 'Invoice saved', variant: 'success' });
        router.push(returnTo);
      } catch (error) {
        pushToast({
          title: 'Unable to save invoice',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const sharePdf = async () => {
    const response = await fetch(`/api/invoices/${invoice.id}/pdf`, { method: 'POST' });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? 'Unable to generate PDF');
    }
    const payload = (await response.json()) as { pdfUrl?: string };
    if (!payload.pdfUrl) throw new Error('No PDF URL returned');
    return payload.pdfUrl;
  };

  const handleEmail = () => {
    startTransition(async () => {
      try {
        const email = clientEmail.trim();
        if (!email) throw new Error('Add a client email address first.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
        const url = await sharePdf();
        const result = await sendInvoiceEmail(invoice.id, email, url);
        if (result.status === 'not_configured') {
          throw new Error('Email sending is not configured on this account.');
        }
        if (result.status === 'failed') {
          throw new Error(result.error ?? 'Send failed. Please try again.');
        }
        pushToast({ title: `Invoice sent to ${email}`, variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Unable to email invoice',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const handlePreview = () => {
    startTransition(async () => {
      try {
        const url = await sharePdf();
        window.open(url, '_blank');
      } catch (error) {
        pushToast({
          title: 'Unable to generate preview',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleWhatsApp = () => {
    startTransition(async () => {
      try {
        if (!clientPhone.trim()) throw new Error('Add a client phone number first.');
        const url = await sharePdf();
        const message = encodeURIComponent(`Invoice ${invoice.invoice_number}: ${url}`);
        const phone = clientPhone.replace(/[^\d+]/g, '');
        window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
      } catch (error) {
        pushToast({
          title: 'Unable to send WhatsApp',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const badge = STATUS_BADGE[invoiceStatus];
  const initials = getInitials(clientName || 'C');
  const displayPaidAt =
    invoiceStatus === 'paid'
      ? formatDisplayDate(invoice.status === 'paid' ? invoice.updated_at : new Date().toISOString())
      : null;

  return (
    <div className="min-h-full">
      {/* Page-level header */}
      <div className="border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-[18px] py-[14px]">
          <Link
            href={returnTo}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] text-[var(--color-text-secondary)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="sr-only">Back</span>
          </Link>
          <p className="min-w-0 flex-1 truncate text-[16px] font-medium text-[var(--color-text-primary)]">
            Invoice {invoice.invoice_number}
          </p>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium"
            style={{ backgroundColor: badge.bg, color: badge.color }}
          >
            {badge.label}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {/* Status card */}
        <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
            Payment status
          </p>
          <div className="mt-3 flex gap-1 rounded-[10px] bg-[var(--color-background-secondary)] p-1">
            {STATUS_SEGMENTS.map((seg) => {
              const active = invoiceStatus === seg.value;
              return (
                <button
                  key={seg.value}
                  type="button"
                  onClick={() => setInvoiceStatus(seg.value)}
                  className="flex-1 rounded-[8px] py-[7px] text-[13px] font-medium transition-colors"
                  style={
                    active
                      ? { backgroundColor: seg.activeBg, color: seg.activeColor }
                      : { backgroundColor: 'transparent', color: 'var(--color-text-tertiary)' }
                  }
                >
                  {seg.label}
                </button>
              );
            })}
          </div>
          {invoiceStatus === 'paid' && displayPaidAt ? (
            <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">Paid on {displayPaidAt}</p>
          ) : null}
        </div>

        {/* Client card */}
        <div className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
          {/* Avatar + name */}
          <div className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-background-secondary)] text-[13px] font-medium text-[var(--color-text-secondary)]">
              {initials}
            </div>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Client name"
              className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
            />
          </div>

          {/* Bill to address */}
          <div className="border-t-[0.5px] border-[var(--color-border-tertiary)] px-4 pb-3 pt-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
              Bill to
            </p>
            <div className="mt-1.5 space-y-1.5">
              <input
                value={clientAddressLine1}
                onChange={(e) => setClientAddressLine1(e.target.value)}
                placeholder="Address line 1"
                className="w-full bg-transparent text-[13px] text-[var(--color-text-secondary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
              />
              <input
                value={clientAddressLine2}
                onChange={(e) => setClientAddressLine2(e.target.value)}
                placeholder="Address line 2 (optional)"
                className="w-full bg-transparent text-[13px] text-[var(--color-text-secondary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
              />
              <div className="flex gap-2">
                <input
                  value={clientCity}
                  onChange={(e) => setClientCity(e.target.value)}
                  placeholder="Town / city"
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--color-text-secondary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
                />
                <input
                  value={clientPostcode}
                  onChange={(e) => setClientPostcode(e.target.value)}
                  placeholder="Postcode"
                  className="w-[88px] shrink-0 bg-transparent text-right text-[13px] text-[var(--color-text-secondary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
                />
              </div>
            </div>
          </div>

          {/* Email */}
          <div className="flex items-center justify-between border-t-[0.5px] border-[var(--color-border-tertiary)] px-4 py-3">
            <p className="shrink-0 text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">Email</p>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="client@example.com"
              className="min-w-0 flex-1 bg-transparent text-right text-[14px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
            />
          </div>

          {/* Phone */}
          <div className="flex items-center justify-between border-t-[0.5px] border-[var(--color-border-tertiary)] px-4 py-3">
            <p className="shrink-0 text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">Phone</p>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="+44 7700 000000"
              className="min-w-0 flex-1 bg-transparent text-right text-[14px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
            />
          </div>

          {/* Due date */}
          <div className="flex items-center justify-between border-t-[0.5px] border-[var(--color-border-tertiary)] px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">Due</p>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="cursor-pointer bg-transparent text-right text-[14px] font-medium text-[var(--color-text-primary)] outline-none"
            />
          </div>

          {/* Send buttons */}
          <div className="flex gap-2 border-t-[0.5px] border-[var(--color-border-tertiary)] px-4 py-3">
            <button
              type="button"
              onClick={handleEmail}
              disabled={isPending}
              style={{ flex: 2 }}
              className="rounded-[24px] bg-[#111] px-5 py-[13px] text-[15px] font-medium text-white disabled:opacity-50"
            >
              {invoiceStatus === 'paid' ? 'Resend receipt' : 'Email invoice'} →
            </button>
            <button
              type="button"
              onClick={handleWhatsApp}
              disabled={isPending}
              style={{ flex: 1 }}
              className="rounded-[24px] border-[0.5px] border-[var(--color-border-secondary)] px-3 py-[13px] text-[15px] font-medium text-[var(--color-text-secondary)] disabled:opacity-50"
            >
              WhatsApp
            </button>
          </div>

          {/* Preview */}
          <div className="border-t-[0.5px] border-[var(--color-border-tertiary)] px-4 pb-3.5 pt-2 text-center">
            <button
              type="button"
              onClick={handlePreview}
              disabled={isPending}
              className="text-[12px] text-[var(--color-text-tertiary)] underline-offset-2 hover:text-[var(--color-text-secondary)] hover:underline disabled:opacity-50"
            >
              Preview PDF ↗
            </button>
          </div>
        </div>

        {/* Line items card */}
        <div className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Line items</p>
            <button
              type="button"
              onClick={addRow}
              className="rounded-full bg-[#edf7f2] px-3 py-1 text-[12px] font-medium text-[#1a7a52]"
            >
              + Add item
            </button>
          </div>

          {items.map((item, index) => (
            <div key={`item-${index}`} className="border-t-[0.5px] border-[var(--color-border-tertiary)]">
              <div className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                    placeholder="Description"
                    className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
                  />
                  <div className="flex shrink-0 items-center">
                    <span className="text-[14px] font-medium text-[var(--color-text-primary)]">£</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={String(item.unit_price ?? 0)}
                      onChange={(e) => updateItem(index, { unit_price: parseMoneyInput(e.target.value) })}
                      className="w-16 bg-transparent text-right text-[14px] font-medium text-[var(--color-text-primary)] outline-none"
                    />
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-[12px] text-[var(--color-text-secondary)]">
                    {item.quantity ?? 1} × £{Number(item.unit_price ?? 0).toFixed(2)}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="text-[12px] text-[#a32d2d]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* VAT */}
          <div className="flex items-center justify-between border-t-[0.5px] border-[var(--color-border-tertiary)] px-4 py-3">
            <p className="text-[13px] text-[var(--color-text-secondary)]">VAT rate</p>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.1"
                min="0"
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
                className="w-[60px] rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-2 py-1 text-right text-[13px] text-[var(--color-text-primary)] outline-none"
              />
              <span className="text-[13px] text-[var(--color-text-secondary)]">%</span>
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-1.5 border-t-[0.5px] border-[var(--color-border-tertiary)] px-4 py-3">
            <div className="flex justify-between text-[13px] text-[var(--color-text-secondary)]">
              <span>Subtotal</span>
              <span>£{totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[13px] text-[var(--color-text-secondary)]">
              <span>VAT ({normalizeVatPercent(vatRate).toFixed(0)}%)</span>
              <span>£{totals.vat.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t-[0.5px] border-[var(--color-border-tertiary)] pt-2">
              <span className="text-[15px] font-medium text-[var(--color-text-primary)]">Total</span>
              <span className="text-[15px] font-medium text-[#1a7a52]">£{totals.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes card */}
        <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
            Notes (optional)
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Payment due within 14 days. Thank you for your custom."
            rows={4}
            className="mt-3 w-full resize-none border-none bg-transparent text-[13px] text-[var(--color-text-secondary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
          />
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="w-full rounded-[24px] bg-[#111] py-[14px] text-[15px] font-medium text-white disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save invoice'}
        </button>
      </div>
    </div>
  );
}
