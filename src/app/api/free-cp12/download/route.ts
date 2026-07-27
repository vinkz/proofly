import { NextResponse } from 'next/server';
import { z } from 'zod';

import { FREE_CP12_LIMITS } from '@/lib/cp12/free-tool';
import { FreeCp12PayloadSchema } from '@/lib/cp12/freeCp12Payload';
import { clientKeyFromRequest, rateLimit } from '@/lib/rate-limit';
import { buildFreeCp12Documents, freeSubmissionIssues } from '@/server/free-cp12-documents';
import {
  emailCapReached,
  emailDownloadCountToday,
  freeCp12Reference,
  recordFreeCp12Lead,
  reportFreeToolEmailFailure,
  sendFreeCp12Email,
} from '@/server/free-cp12';

const DAY_MS = 24 * 60 * 60 * 1000;

const DownloadSchema = z.object({
  email: z.string().trim().min(3).max(160).email(),
  payload: FreeCp12PayloadSchema,
});

/**
 * The download step: email the certificate and record the address.
 *
 * The PDF is re-rendered here from the same form data the preview used rather
 * than being held server-side between the two requests — that is what keeps the
 * tool stateless. The visitor's browser saves the copy it already has.
 */
export async function POST(request: Request) {
  const ipLimit = rateLimit(
    `free-cp12:download:${clientKeyFromRequest(request)}`,
    FREE_CP12_LIMITS.downloadPerIpPerDay,
    DAY_MS,
  );
  if (!ipLimit.ok) {
    return NextResponse.json(
      {
        error: "You've reached today's limit for this connection. " +
          'An account removes the cap — and keeps every certificate you issue.',
        retryAfterSeconds: ipLimit.retryAfterSeconds,
      },
      { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Could not read the form data.' }, { status: 400 });
  }

  const parsed = DownloadSchema.safeParse(body);
  if (!parsed.success) {
    const emailIssue = parsed.error.issues.some((issue) => issue.path[0] === 'email');
    return NextResponse.json(
      {
        error: emailIssue
          ? 'That email address does not look right — check it and try again.'
          : 'Some answers were not in the expected format.',
      },
      { status: 400 },
    );
  }

  const { email, payload } = parsed.data;

  const emailCount = await emailDownloadCountToday(email);
  if (emailCapReached(emailCount)) {
    return NextResponse.json(
      {
        error: `That email address has already been sent ${FREE_CP12_LIMITS.downloadPerEmailPerDay} certificates today. ` +
          'An account removes the cap.',
      },
      { status: 429 },
    );
  }

  const reference = freeCp12Reference();
  const issuedAt = new Date();

  const errors = freeSubmissionIssues(payload, { recordId: reference, issuedAt });
  if (errors.length) {
    return NextResponse.json({ error: 'The certificate is not complete yet.', issues: errors }, { status: 422 });
  }

  const documents = await buildFreeCp12Documents(payload, { reference, issuedAt });

  // Capture BEFORE sending. Resend is an external call; if it hangs long enough
  // for the function to be killed we would lose the lead entirely, and the lead
  // is the only thing this exchange gives us. Written whenever an address was
  // submitted in earnest, even if delivery then fails — the visitor still has
  // their certificate in the browser either way.
  const lead = await recordFreeCp12Lead(email);
  if (!lead.ok) {
    console.error('free CP12 lead capture failed', { error: lead.error });
  }

  const delivery = await sendFreeCp12Email({ to: email, documents, reference });

  if (delivery.status === 'failed') {
    reportFreeToolEmailFailure('free_cp12', delivery.error);
    return NextResponse.json(
      {
        error: 'We could not email the certificate just now, but your download is ready below.',
        emailed: false,
        reference,
      },
      { status: 200 },
    );
  }

  return NextResponse.json({
    emailed: delivery.status === 'sent',
    reference,
  });
}
