'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { setInvoiceMeta, upsertLineItems, type InvoiceLineItemInput, type InvoiceRow } from '@/server/invoices';

type ClientSummary = {
  name: string;
  address: string | null;
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
};

export function InvoiceEditor({ invoice, lineItems, client, job }: InvoiceEditorProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<InvoiceLineItemInput[]>(
    lineItems.length ? lineItems : [{ description: '', quantity: 1, unit_price: 0, vat_exempt: false }],
  );
  const [vatRate, setVatRate] = useState<string>(String(invoice.vat_rate ?? 0.2));
  const [notes, setNotes] = useState<string>(invoice.notes ?? '');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string>(invoice.client_name_override ?? client?.name ?? '');
  const [clientAddress, setClientAddress] = useState<string>(invoice.client_address_override ?? client?.address ?? job?.address ?? '');
  const [clientEmail, setClientEmail] = useState<string>(invoice.client_email_override ?? client?.email ?? '');
  const [clientPhone, setClientPhone] = useState<string>(invoice.client_phone_override ?? client?.phone ?? '');

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
    const rate = Number(vatRate || 0);
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
          vat_rate: Number(vatRate),
          notes,
          client_name_override: clientName || null,
          client_address_override: clientAddress || null,
          client_email_override: clientEmail || null,
          client_phone_override: clientPhone || null,
        });
        pushToast({ title: 'Invoice saved', variant: 'success' });
        router.refresh();
      } catch (error) {
        pushToast({
          title: 'Unable to save invoice',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/invoices/${invoice.id}/pdf`, { method: 'POST' });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? 'Unable to generate PDF');
        }
        const payload = (await response.json()) as { pdfUrl?: string };
        setPdfUrl(payload.pdfUrl ?? null);
        pushToast({ title: 'PDF generated', variant: 'success' });
        if (payload.pdfUrl) {
          window.open(payload.pdfUrl, '_blank');
        }
      } catch (error) {
        pushToast({
          title: 'Unable to generate PDF',
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
    setPdfUrl(payload.pdfUrl);
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
            value={clientAddress}
            onChange={(e) => setClientAddress(e.target.value)}
            placeholder="Address"
            className="rounded-2xl sm:col-span-2"
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
                <Input
                  type="number"
                  min="0"
                  value={item.unit_price ?? 0}
                  onChange={(e) => updateItem(index, { unit_price: Number(e.target.value) })}
                  placeholder="Unit price"
                />
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
          <Input
            type="number"
            step="0.01"
            min="0"
            value={vatRate}
            onChange={(e) => setVatRate(e.target.value)}
            placeholder="VAT rate (e.g. 0.20)"
          />
          <div className="rounded-2xl border border-white/10 bg-white/80 p-3 text-sm text-muted-foreground/80">
            <p>Subtotal: £{totals.subtotal.toFixed(2)}</p>
            <p>VAT: £{totals.vat.toFixed(2)}</p>
            <p className="font-semibold text-muted">Total: £{totals.total.toFixed(2)}</p>
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
          {pdfUrl ? (
            <Button asChild variant="outline" className="rounded-full">
              <a href={pdfUrl} target="_blank" rel="noreferrer">
                Open PDF
              </a>
            </Button>
          ) : (
            <Button variant="outline" className="rounded-full" onClick={handleGenerate}>
              Generate PDF
            </Button>
          )}
          <Button onClick={handleSave} disabled={isPending} className="rounded-full">
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
