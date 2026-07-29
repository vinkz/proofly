'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { AddressAutocompleteField } from '@/components/address/address-autocomplete-field';
import { useToast } from '@/components/ui/use-toast';
import { setInvoiceMeta, upsertLineItems, sendInvoiceEmail, type InvoiceLineItemInput, type InvoiceRow } from '@/server/invoices';
import { toUserMessage } from '@/lib/user-errors';

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
  if (s === '' || s === 'draft') return 'draft';
  // Any persisted "sent" status (the DB uses 'issued'; legacy rows may hold
  // 'unpaid'/'overdue') is shown as unpaid, or overdue once past the due date.
  const isPastDue =
    !!dueDate && !Number.isNaN(new Date(dueDate).getTime()) && new Date(dueDate) < new Date();
  return isPastDue ? 'overdue' : 'unpaid';
}

// The DB persists a canonical lifecycle — draft → issued → paid (enforced by the
// invoices_status_check constraint, which allows only draft/issued/paid/void).
// 'unpaid'/'overdue' are display-only states derived from the due date, so collapse
// them to 'issued' before saving — otherwise the write violates the constraint and
// the status silently never advances past 'draft'.
function toPersistedStatus(display: InvoiceStatus): 'draft' | 'issued' | 'paid' {
  if (display === 'paid') return 'paid';
  if (display === 'draft') return 'draft';
  return 'issued';
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
  // Lifecycle is derived, not hand-picked. `paid` is the one manual flag (pay-on-the-day);
  // `sent` flips automatically the first time the invoice is emailed/messaged. Overdue is
  // computed from the due date. Anything past 'draft' in the persisted status means it has
  // already been issued to the client.
  const initialStatus = computeInitialStatus(invoice.status, invoice.due_date);
  const [paid, setPaid] = useState<boolean>(initialStatus === 'paid');
  const [sent, setSent] = useState<boolean>(initialStatus !== 'draft');
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

  const pastDue = useMemo(() => {
    if (!dueDate) return false;
    const d = new Date(dueDate);
    if (Number.isNaN(d.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  }, [dueDate]);

  // Single source of truth for the lifecycle state shown/persisted.
  const status: InvoiceStatus = paid ? 'paid' : sent ? (pastDue ? 'overdue' : 'unpaid') : 'draft';

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

  // Persist the current form state (line items + meta). Shared by Save and by every
  // share action, so a previewed/emailed PDF always reflects the on-screen edits rather
  // than the last saved version.
  const persist = async () => {
    await upsertLineItems(invoice.id, items.filter((item) => item.description?.trim().length));
    await setInvoiceMeta(invoice.id, {
      status: toPersistedStatus(status),
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
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        await persist();
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
          description: toUserMessage(error, 'Please try again.'),
          variant: 'error',
        });
      }
    });
  };

  const sharePdf = async () => {
    await persist();
    const response = await fetch(`/api/invoices/${invoice.id}/pdf`, { method: 'POST' });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? 'Unable to generate PDF');
    }
    const payload = (await response.json()) as { pdfUrl?: string };
    if (!payload.pdfUrl) throw new Error('No PDF URL returned');
    return payload.pdfUrl;
  };

  // First send moves a draft into the outstanding (unpaid/overdue) lifecycle.
  const markSent = async () => {
    if (paid || sent) return;
    setSent(true);
    await setInvoiceMeta(invoice.id, { status: 'issued' });
  };

  const togglePaid = () => {
    startTransition(async () => {
      const next = !paid;
      setPaid(next);
      try {
        const nextStatus: InvoiceStatus = next ? 'paid' : sent ? (pastDue ? 'overdue' : 'unpaid') : 'draft';
        await setInvoiceMeta(invoice.id, { status: toPersistedStatus(nextStatus) });
        pushToast({ title: next ? 'Marked as paid' : 'Marked as unpaid', variant: 'success' });
      } catch (error) {
        setPaid(!next);
        pushToast({
          title: 'Unable to update status',
          description: toUserMessage(error, 'Please try again.'),
          variant: 'error',
        });
      }
    });
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
        await markSent();
        pushToast({ title: `Invoice sent to ${email}`, variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Unable to email invoice',
          description: toUserMessage(error, 'Please try again.'),
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
          description: toUserMessage(error, 'Please try again.'),
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
        await markSent();
      } catch (error) {
        pushToast({
          title: 'Unable to send WhatsApp',
          description: toUserMessage(error, 'Please try again.'),
          variant: 'error',
        });
      }
    });
  };

  const badge = STATUS_BADGE[status];
  const initials = getInitials(clientName || 'C');
  const displayPaidAt = paid
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
        {/* Status & terms card */}
        <div className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
          {/* Status — derived, not hand-picked. Shows where the invoice is in its life. */}
          <div className="flex items-center justify-between p-4">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
                Status
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[12px] font-medium"
                  style={{ backgroundColor: badge.bg, color: badge.color }}
                >
                  {badge.label}
                </span>
                <span className="text-[12px] text-[var(--color-text-tertiary)]">
                  {paid
                    ? displayPaidAt
                      ? `Paid on ${displayPaidAt}`
                      : 'Paid'
                    : sent
                      ? pastDue
                        ? 'Sent · past due date'
                        : 'Sent · awaiting payment'
                      : 'Not sent yet'}
                </span>
              </div>
            </div>
            {/* Mark as paid — the one manual status action (pay-on-the-day) */}
            <button
              type="button"
              onClick={togglePaid}
              disabled={isPending}
              aria-pressed={paid}
              className="shrink-0 rounded-full border-[0.5px] px-3 py-[7px] text-[13px] font-medium transition-colors disabled:opacity-50"
              style={
                paid
                  ? { backgroundColor: '#edf7f2', color: '#1a7a52', borderColor: 'transparent' }
                  : { backgroundColor: 'transparent', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-secondary)' }
              }
            >
              {paid ? 'Paid ✓' : 'Mark as paid'}
            </button>
          </div>
          {/* Due date */}
          <div className="flex items-center justify-between border-t-[0.5px] border-[var(--color-border-tertiary)] px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">Due date</p>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="cursor-pointer bg-transparent text-right text-[14px] font-medium text-[var(--color-text-primary)] outline-none"
            />
          </div>
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
              <AddressAutocompleteField
                variant="bare"
                value={clientAddressLine1}
                onValueChange={setClientAddressLine1}
                onAddressSelect={(address) => {
                  setClientAddressLine2(address.line2 || '');
                  setClientCity(address.city || '');
                  setClientPostcode(address.postcode || '');
                }}
                placeholder="Address line 1"
                inputClassName="w-full bg-transparent text-[13px] text-[var(--color-text-secondary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
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

          {items.map((item, index) => {
            const qty = Number(item.quantity ?? 1);
            const unit = Number(item.unit_price ?? 0);
            const lineTotal = (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(unit) ? unit : 0);
            return (
              <div key={`item-${index}`} className="border-t-[0.5px] border-[var(--color-border-tertiary)] px-4 py-3">
                {/* Description on its own line — easy to read and type */}
                <div className="flex items-start gap-2">
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                    placeholder="Description"
                    className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    aria-label="Remove item"
                    className="shrink-0 rounded-full p-1 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-background-secondary)] hover:text-[#a32d2d]"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                {/* Compact controls: qty × unit price, with the line total on the right */}
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)]">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={String(item.quantity ?? 1)}
                      onChange={(e) => {
                        const n = parseInt(e.target.value.replace(/[^\d]/g, ''), 10);
                        updateItem(index, { quantity: Number.isFinite(n) && n > 0 ? n : 1 });
                      }}
                      aria-label="Quantity"
                      className="w-10 rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-1.5 py-1 text-center text-[13px] text-[var(--color-text-primary)] outline-none"
                    />
                    <span>×</span>
                    <span className="flex items-center rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-1.5 py-1">
                      <span className="text-[13px] text-[var(--color-text-secondary)]">£</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={String(item.unit_price ?? 0)}
                        onChange={(e) => updateItem(index, { unit_price: parseMoneyInput(e.target.value) })}
                        aria-label="Unit price"
                        className="w-14 bg-transparent text-right text-[13px] text-[var(--color-text-primary)] outline-none"
                      />
                    </span>
                  </div>
                  <span className="text-[14px] font-medium text-[var(--color-text-primary)]">£{lineTotal.toFixed(2)}</span>
                </div>
              </div>
            );
          })}

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

        {/* Actions — one place for save, preview, and sending */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="w-full rounded-[24px] bg-[#111] py-[14px] text-[15px] font-medium text-white disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Save invoice'}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleEmail}
              disabled={isPending}
              className="flex-1 rounded-[24px] border-[0.5px] border-[var(--color-border-secondary)] py-[12px] text-[14px] font-medium text-[var(--color-text-secondary)] disabled:opacity-50"
            >
              {paid ? 'Resend receipt' : 'Email'}
            </button>
            <button
              type="button"
              onClick={handleWhatsApp}
              disabled={isPending}
              className="flex-1 rounded-[24px] border-[0.5px] border-[var(--color-border-secondary)] py-[12px] text-[14px] font-medium text-[var(--color-text-secondary)] disabled:opacity-50"
            >
              WhatsApp
            </button>
            <button
              type="button"
              onClick={handlePreview}
              disabled={isPending}
              className="flex-1 rounded-[24px] border-[0.5px] border-[var(--color-border-secondary)] py-[12px] text-[14px] font-medium text-[var(--color-text-secondary)] disabled:opacity-50"
            >
              Preview
            </button>
          </div>
          <p className="pt-0.5 text-center text-[11px] text-[var(--color-text-tertiary)]">
            Emailing, WhatsApp and preview save your changes first.
          </p>
        </div>
      </div>
    </div>
  );
}
