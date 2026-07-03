import { NextResponse } from 'next/server';

import { supabaseServerAction, supabaseServerServiceRole } from '@/lib/supabaseServer';

/**
 * Streams a generated invoice PDF through our own domain instead of redirecting
 * the browser to a raw *.supabase.co signed storage URL. The file is stored at
 * `${user.id}/${invoiceId}.pdf` in the `invoices` bucket, so ownership is
 * enforced by scoping the path to the authenticated user's id.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const sb = await supabaseServerAction();
  const {
    data: { user },
    error: authErr,
  } = await sb.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = await supabaseServerServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyAdmin = admin as any;
  const storagePath = `${user.id}/${invoiceId}.pdf`;
  const { data, error } = await anyAdmin.storage.from('invoices').download(storagePath);
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'PDF not found' }, { status: 404 });
  }

  const bytes = new Uint8Array(await data.arrayBuffer());
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${invoiceId}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
