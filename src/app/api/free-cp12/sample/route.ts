import { NextResponse } from 'next/server';

import { renderSampleCp12 } from '@/server/free-cp12-sample';

/**
 * The example CP12 shown before an engineer starts filling anything in.
 *
 * Fixed input and a fixed issue date, so the bytes are stable and this can be
 * cached hard at the edge rather than re-rendered per visitor. No rate limit
 * for that reason: it is one cacheable document, not per-request work.
 */
export const dynamic = 'force-static';
export const revalidate = 86_400;

export async function GET() {
  const bytes = await renderSampleCp12();

  return new NextResponse(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="cp12-example.pdf"',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, immutable',
    },
  });
}
