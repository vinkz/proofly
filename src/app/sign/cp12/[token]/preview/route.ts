import { NextResponse } from 'next/server';

import { getCp12RemoteSignaturePreviewUrl } from '@/server/certificates';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const pdfUrl = await getCp12RemoteSignaturePreviewUrl(token);
    return NextResponse.redirect(pdfUrl);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to generate preview' },
      { status: 400 },
    );
  }
}
