import { NextResponse } from 'next/server';

import { getCertificatePdfFile, getReportPdfFile } from '@/server/certificates';
import { CERTIFICATE_TYPES, type CertificateType } from '@/types/certificates';

/**
 * Streams a job's PDF (certificate or report) through our own domain so the
 * browser never sees the raw *.supabase.co signed storage URL. Auth and
 * ownership are enforced inside the helpers via the session cookie.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const source = url.searchParams.get('source');
  const rawType = url.searchParams.get('type');
  const certificateType: CertificateType | undefined =
    rawType && CERTIFICATE_TYPES.includes(rawType as CertificateType) ? (rawType as CertificateType) : undefined;

  try {
    const { bytes, filename } =
      source === 'report'
        ? await getReportPdfFile(id)
        : await getCertificatePdfFile({ jobId: id, certificateType });

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load PDF';
    const status = /unauthorized|rls mismatch/i.test(message) ? 403 : 404;
    return NextResponse.json({ error: message }, { status });
  }
}
