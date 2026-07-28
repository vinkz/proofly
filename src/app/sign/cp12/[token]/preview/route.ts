import { NextResponse } from 'next/server';

import { getCp12RemoteSignaturePreviewUrl } from '@/server/certificates';
import { toUserMessage } from '@/lib/user-errors';

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
      { error: toUserMessage(error, 'Unable to generate preview') },
      { status: 400 },
    );
  }
}
