import { NextResponse } from 'next/server';

import { FREE_CP12_LIMITS } from '@/lib/cp12/free-tool';
import { FreeCp12PayloadSchema } from '@/lib/cp12/freeCp12Payload';
import { consumePublicActionRateLimit } from '@/lib/public-action-security';
import { clientKeyFromRequest, rateLimit } from '@/lib/rate-limit';
import { buildFreeCp12Documents, freeSubmissionIssues } from '@/server/free-cp12-documents';
import { freeCp12Reference } from '@/server/free-cp12';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Render a CP12 — and a Gas Warning Notice for any appliance classified At Risk
 * or Immediately Dangerous — for an anonymous visitor.
 *
 * Nothing is written anywhere: no storage upload, no certificate row, no draft.
 * The bytes exist for the duration of the response and then only in the
 * visitor's browser.
 */
export async function POST(request: Request) {
  const clientIdentifier = clientKeyFromRequest(request);
  const limit = rateLimit(
    `free-cp12:generate:${clientIdentifier}`,
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
  const durableLimit = await consumePublicActionRateLimit({
    action: 'free_cp12_generate_ip',
    identifier: clientIdentifier,
    limit: FREE_CP12_LIMITS.generatePerIpPerHour,
    windowSeconds: HOUR_MS / 1000,
  });
  if (!durableLimit.allowed) {
    return NextResponse.json(
      {
        error: "You've generated a lot of certificates from this connection in the last hour. " +
          'Try again shortly, or create an account for unlimited certificates.',
        retryAfterSeconds: durableLimit.retryAfterSeconds,
      },
      { status: 429, headers: { 'Retry-After': String(durableLimit.retryAfterSeconds) } },
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

  const reference = freeCp12Reference();
  const issuedAt = new Date();

  // The same statutory gates the paid flow applies before issuing — CP12 tier
  // one, plus the GIUSP/RIDDOR gate for every warning notice implied.
  const errors = freeSubmissionIssues(parsed.data, { recordId: reference, issuedAt });
  if (errors.length) {
    return NextResponse.json({ error: 'The certificate is not complete yet.', issues: errors }, { status: 422 });
  }

  const documents = await buildFreeCp12Documents(parsed.data, { reference, issuedAt });

  return NextResponse.json(
    {
      reference,
      documents: documents.map((doc) => ({
        kind: doc.kind,
        title: doc.title,
        filename: doc.filename,
        reference: doc.reference,
        base64: Buffer.from(doc.bytes).toString('base64'),
      })),
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } },
  );
}
