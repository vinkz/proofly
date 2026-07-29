import { NextResponse } from 'next/server';
import { z } from 'zod';

import { FREE_CP12_LIMITS } from '@/lib/cp12/free-tool';
import { FreeCp12PayloadSchema } from '@/lib/cp12/freeCp12Payload';
import { consumePublicActionRateLimit } from '@/lib/public-action-security';
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
 * tool stateless. These exact bytes are returned to the browser as well as sent
 * by email, so every copy from one issue action has the same reference.
 */
export async function POST(request: Request) {
  const clientIdentifier = clientKeyFromRequest(request);
  const ipLimit = rateLimit(
    `free-cp12:download:${clientIdentifier}`,
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
  const durableIpLimit = await consumePublicActionRateLimit({
    action: 'free_cp12_download_ip',
    identifier: clientIdentifier,
    limit: FREE_CP12_LIMITS.downloadPerIpPerDay,
    windowSeconds: DAY_MS / 1000,
  });
  if (!durableIpLimit.allowed) {
    return NextResponse.json(
      {
        error: "You've reached today's limit for this connection. " +
          'An account removes the cap — and keeps every certificate you issue.',
        retryAfterSeconds: durableIpLimit.retryAfterSeconds,
      },
      { status: 429, headers: { 'Retry-After': String(durableIpLimit.retryAfterSeconds) } },
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
  const durableEmailLimit = await consumePublicActionRateLimit({
    action: 'free_cp12_download_email',
    identifier: email,
    limit: FREE_CP12_LIMITS.downloadPerEmailPerDay,
    windowSeconds: DAY_MS / 1000,
  });
  if (!durableEmailLimit.allowed) {
    return NextResponse.json(
      {
        error: `That email address has already been sent ${FREE_CP12_LIMITS.downloadPerEmailPerDay} certificates today. ` +
          'An account removes the cap.',
      },
      { status: 429, headers: { 'Retry-After': String(durableEmailLimit.retryAfterSeconds) } },
    );
  }

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
  const responseDocuments = documents.map((document) => ({
    kind: document.kind,
    title: document.title,
    filename: document.filename,
    reference: document.reference,
    base64: Buffer.from(document.bytes).toString('base64'),
  }));

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
        documents: responseDocuments,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } },
    );
  }

  return NextResponse.json(
    {
      emailed: delivery.status === 'sent',
      reference,
      documents: responseDocuments,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } },
  );
}
