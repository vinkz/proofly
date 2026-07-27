import { NextResponse } from 'next/server';

import { buildCp12RenderInput } from '@/lib/cp12/buildCp12Render';
import { FREE_CP12_LIMITS } from '@/lib/cp12/free-tool';
import {
  FreeCp12PayloadSchema,
  freeCp12ToRenderSource,
  freeCp12ValidationInput,
} from '@/lib/cp12/freeCp12Payload';
import { validateCp12TierOne } from '@/lib/cp12/validation';
import { clientKeyFromRequest, rateLimit } from '@/lib/rate-limit';
import { renderCp12CertificatePdf } from '@/server/pdf/renderCp12Certificate';
import { freeCp12Reference } from '@/server/free-cp12';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Render a CP12 for an anonymous visitor and stream it straight back.
 *
 * Nothing is written anywhere: no storage upload, no certificate row, no draft.
 * The bytes exist for the duration of the response and then only in the
 * visitor's browser.
 */
export async function POST(request: Request) {
  const limit = rateLimit(
    `free-cp12:generate:${clientKeyFromRequest(request)}`,
    FREE_CP12_LIMITS.generatePerIpPerHour,
    HOUR_MS,
  );
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: "You've generated a lot of certificates from this connection in the last hour. " +
          'Try again shortly, or create an account for unlimited certificates.',
        retryAfterSeconds: limit.retryAfterSeconds,
      },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Could not read the form data.' }, { status: 400 });
  }

  const parsed = FreeCp12PayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Some answers were not in the expected format.', issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  // The same statutory gate the paid flow applies before issuing.
  const errors = validateCp12TierOne(freeCp12ValidationInput(parsed.data));
  if (errors.length) {
    return NextResponse.json({ error: 'The certificate is not complete yet.', issues: errors }, { status: 422 });
  }

  const reference = freeCp12Reference();
  const pdfBytes = await renderCp12CertificatePdf(
    buildCp12RenderInput(
      freeCp12ToRenderSource(parsed.data, {
        recordId: reference,
        certNumber: reference,
        issuedAt: new Date(),
      }),
    ),
  );

  return new NextResponse(pdfBytes as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="cp12-landlord-gas-safety-record.pdf"',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
