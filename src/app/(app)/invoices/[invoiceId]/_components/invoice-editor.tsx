'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { setInvoiceMeta, upsertLineItems, type InvoiceLineItemInput, type InvoiceRow } from '@/server/invoices';

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
};

const LAST_USED_PRICE_STORAGE_KEY = 'certnow.invoice.last-used-prices';

const DEFAULT_LINE_ITEM_BY_CERTIFICATE_TYPE: Record<string, string> = {
  cp12: 'Gas Safety Certificate (CP12)',
  gas_warning_notice: 'Gas Warning Notice Inspection',
};

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
    // Ignore local storage write failures.
  }
}

function splitAddressParts(value: string | null | undefined) {
  return String(value ?? '')
    .split(/[\r\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildAddressText(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

function parseMoneyInput(value: string) {
  const sanitized = value.replace(/[^\d.]/g, '');
  const numeric = Number(sanitized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeInvoiceStatus(status: string | null | undefined) {
  return status === 'paid' ? 'paid' : 'unpaid';
}

export function InvoiceEditor({ invoice, lineItems, client, job, certificateType }: InvoiceEditorProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const defaultDescription = certificateType ? DEFAULT_LINE_ITEM_BY_CERTIFICATE_TYPE[certificateType] ?? '' : '';
  const initialAddressParts = splitAddressParts(invoice.client_address_override ?? client?.address ?? job?.address ?? '');
  const [items, setItems] = useState<InvoiceLineItemInput[]>(
    lineItems.length
      ? lineItems
      : [{ description: defaultDescription, quantity: 1, unit_price: 0, vat_exempt: false }],
  );
  const [vatRate, setVatRate] = useState<string>(getVatPercentDisplay(invoice.vat_rate ?? 0.2));
  const [notes, setNotes] = useState<string>(invoice.notes ?? '');
  const [invoiceStatus, setInvoiceStatus] = useState<'paid' | 'unpaid'>(normalizeInvoiceStatus(invoice.status));
  const [clientName, setClientName] = useState<string>(invoice.client_name_override ?? client?.name ?? '');
  const [clientAddressLine1, setClientAddressLine1] = useState<string>(initialAddressParts[0] ?? '');
  const [clientAddressLine2, setClientAddressLine2] = useState<string>(
    initialAddressParts.length > 3 ? initialAddressParts.slice(1, -2).join(', ') : initialAddressParts[1] ?? '',
  );
  const [clientCity, setClientCity] = useState<string>(
    initialAddressParts.length >= 3 ? initialAddressParts[initialAddressParts.length - 2] ?? '' : '',
  );
  const [clientPostcode, setClientPostcode] = useState<string>(
    invoice.client_address_override ? initialAddressParts.at(-1) ?? '' : client?.postcode ?? '',
  );
  const [clientEmail, setClientEmail] = useState<string>(invoice.client_email_override ?? client?.email ?? '');
  const [clientPhone, setClientPhone] = useState<string>(invoice.client_phone_override ?? client?.phone ?? '');

  useEffect(() => {
    if (!certificateType || lineItems.length > 0) return;
    const lastUsedPrice = readLastUsedPrice(certificateType);
    if (lastUsedPrice === null) return;
    setItems((prev) => {
      if (prev.length !== 1) return prev;
      const [firstItem] = prev;
      if (Number(firstItem.unit_price ?? 0) > 0) return prev;
      return [{ ...firstItem, unit_price: lastUsedPrice, description: firstItem.description || defaultDescription }];
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

  const handleSave = () => {
    startTransition(async () => {
      try {
        await upsertLineItems(invoice.id, items.filter((item) => item.description?.trim().length));
        await setInvoiceMeta(invoice.id, {
          status: invoiceStatus === 'paid' ? 'paid' : 'draft',
          vat_rate: normalizeVatPercent(vatRate) / 100,
          notes,
          client_name_override: clientName || null,
          client_address_override:
            buildAddressText([clientAddressLine1, clientAddressLine2, clientCity, clientPostcode]) || null,
          client_email_override: clientEmail || null,
          client_phone_override: clientPhone || null,
        });
        const rememberedUnitPrice = items.find((item) => item.description?.trim() && Number(item.unit_price ?? 0) >= 0);
        if (rememberedUnitPrice) {
          writeLastUsedPrice(certificateType, Number(rememberedUnitPrice.unit_price ?? 0));
        }
        const response = await fetch(`/api/invoices/${invoice.id}/pdf`, { method: 'POST' });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? 'Unable to generate PDF');
        }
        pushToast({ title: 'Invoice saved', variant: 'success' });
        router.push('/invoices');
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
        if (!clientEmail.trim()) {
          throw new Error('Add a client email first.');
        }
        const url = await sharePdf();
        const subject = encodeURIComponent(`Invoice ${invoice.invoice_number}`);
        const body = encodeURIComponent(`Hi,\n\nPlease find your invoice here:\n${url}\n\nThanks.`);
        window.location.href = `mailto:${clientEmail}?subject=${subject}&body=${body}`;
      } catch (error) {
        pushToast({
          title: 'Unable to email invoice',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleWhatsApp = () => {
    startTransition(async () => {
      try {
        if (!clientPhone.trim()) {
          throw new Error('Add a client phone number first.');
        }
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

  return (
    <div className="space-y-6 pb-24">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Invoice status</h2>
        <div className="mt-3 flex gap-2">
          <Button
            variant={invoiceStatus === 'unpaid' ? 'primary' : 'outline'}
            className="rounded-full"
            onClick={() => setInvoiceStatus('unpaid')}
          >
            Unpaid
          </Button>
          <Button
            variant={invoiceStatus === 'paid' ? 'primary' : 'outline'}
            className="rounded-full"
            onClick={() => setInvoiceStatus('paid')}
          >
            Paid
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Client & address</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Client name"
            className="rounded-2xl"
          />
          <Input
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
            placeholder="Phone"
            className="rounded-2xl"
          />
          <Input
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            placeholder="Email"
            className="rounded-2xl"
          />
          <Input
            value={clientAddressLine1}
            onChange={(e) => setClientAddressLine1(e.target.value)}
            placeholder="Address line 1"
            className="rounded-2xl sm:col-span-2"
          />
          <Input
            value={clientAddressLine2}
            onChange={(e) => setClientAddressLine2(e.target.value)}
            placeholder="Address line 2 (optional)"
            className="rounded-2xl sm:col-span-2"
          />
          <Input
            value={clientCity}
            onChange={(e) => setClientCity(e.target.value)}
            placeholder="Town / city"
            className="rounded-2xl"
          />
          <Input
            value={clientPostcode}
            onChange={(e) => setClientPostcode(e.target.value)}
            placeholder="Postcode"
            className="rounded-2xl"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full" onClick={handleEmail} disabled={isPending}>
            Email invoice
          </Button>
          <Button variant="outline" className="rounded-full" onClick={handleWhatsApp} disabled={isPending}>
            WhatsApp invoice
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Line items</h2>
          <Button variant="outline" className="rounded-full text-xs" onClick={addRow}>
            Add row
          </Button>
        </div>
        <div className="mt-3 space-y-3">
          {items.map((item, index) => (
            <div key={`item-${index}`} className="rounded-2xl border border-white/10 bg-white/80 p-3">
              <div className="grid gap-2 sm:grid-cols-5">
                <Input
                  value={item.description}
                  onChange={(e) => updateItem(index, { description: e.target.value })}
                  placeholder="Description"
                  className="sm:col-span-3"
                />
                <Input
                  type="number"
                  min="0"
                  value={item.quantity ?? 0}
                  onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                  placeholder="Qty"
                />
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/70">
                    £
                  </span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={String(item.unit_price ?? 0)}
                    onChange={(e) => updateItem(index, { unit_price: parseMoneyInput(e.target.value) })}
                    placeholder="Price"
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button variant="outline" className="rounded-full text-xs" onClick={() => removeRow(index)}>
                  Delete row
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">VAT rate & totals</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <Input
              type="number"
              step="0.1"
              min="0"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              placeholder="VAT"
              className="pr-8"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/70">
              %
            </span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/80 p-4 text-sm text-muted-foreground/80">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span>£{totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span>VAT ({normalizeVatPercent(vatRate).toFixed(0)}%)</span>
              <span>£{totals.vat.toFixed(2)}</span>
            </div>
            <div className="mt-3 border-t border-white/10 pt-3">
              <div className="flex items-center justify-between font-semibold text-muted">
                <span>Total</span>
                <span>£{totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Notes</h2>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes for this invoice (optional)"
          className="mt-3 min-h-[120px]"
        />
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-white/10 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:justify-end">
          <Button onClick={handleSave} disabled={isPending} className="rounded-full">
            {isPending ? 'Saving…' : 'Save Invoice'}
          </Button>
        </div>
      </div>
    </div>
  );
}
