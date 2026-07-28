import { NextResponse } from 'next/server';

import { renderSampleBoilerService } from '@/server/free-boiler-service-sample';

/**
 * The example service record shown before an engineer starts filling anything
 * in. Fixed input and issue date, so the bytes are stable and this is cached
 * rather than re-rendered per visitor — one cacheable document, not
 * per-request work, which is why it needs no rate limit.
 */
export const dynamic = 'force-static';
export const revalidate = 86_400;

export async function GET() {
  const bytes = await renderSampleBoilerService();

  return new NextResponse(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="boiler-service-record-example.pdf"',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, immutable',
    },
  });
}
