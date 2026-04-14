import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { isUUID } from '@/lib/ids';
import { getInvoice } from '@/server/invoices';
import { InvoicePdfActions } from './_components/invoice-pdf-actions';

export default async function InvoicePdfPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  if (!isUUID(invoiceId)) {
    notFound();
  }

  let invoiceData: Awaited<ReturnType<typeof getInvoice>>;
  try {
    invoiceData = await getInvoice(invoiceId);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      redirect('/login');
    }
    notFound();
  }

  const { invoice } = invoiceData;

  if (invoice.pdf_path) {
    const supabase = await supabaseServerReadOnly();
    const { data: signed, error: signedErr } = await supabase.storage.from('invoices').createSignedUrl(invoice.pdf_path, 60 * 60);
    if (!signedErr && signed?.signedUrl) {
      redirect(signed.signedUrl);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <Link href="/invoices" className="text-xs uppercase tracking-wide text-accent">
          ← Back to invoices
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-muted">Invoice PDF</h1>
        <p className="text-sm text-muted-foreground/70">{invoice.invoice_number}</p>
      </div>
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-muted-foreground/80">
          Generate a PDF version of this invoice.
        </p>
        <div className="mt-4 flex justify-end">
          <InvoicePdfActions invoiceId={invoice.id} />
        </div>
      </section>
    </main>
  );
}
