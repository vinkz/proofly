import { NextResponse } from 'next/server';
import { z } from 'zod';

import { FREE_BOILER_SERVICE_LIMITS } from '@/lib/boiler-service/free-tool';
import { FreeBoilerServiceSchema } from '@/lib/boiler-service/freeBoilerServicePayload';
import { consumePublicActionRateLimit } from '@/lib/public-action-security';
import { clientKeyFromRequest, rateLimit } from '@/lib/rate-limit';
import {
  buildFreeBoilerServicePdf,
  freeBoilerServiceIssues,
  recordFreeBoilerServiceLead,
  sendFreeBoilerServiceEmail,
} from '@/server/free-boiler-service';
import {
  emailCapReached,
  emailDownloadCountToday,
  freeCp12Reference,
  reportFreeToolEmailFailure,
} from '@/server/free-cp12';

const DAY_MS = 24 * 60 * 60 * 1000;

const DownloadSchema = z.object({
  email: z.string().trim().min(3).max(160).email(),
  payload: FreeBoilerServiceSchema,
});

/** Email the record and capture the address. The only thing that persists. */
export async function POST(request: Request) {
  const clientIdentifier = clientKeyFromRequest(request);
  const ipLimit = rateLimit(
    `free-boiler-service:download:${clientIdentifier}`,
    FREE_BOILER_SERVICE_LIMITS.downloadPerIpPerDay,
    DAY_MS,
  );
  if (!ipLimit.ok) {
    return NextResponse.json(
      {
        error: "You've reached today's limit for this connection. " +
          'An account removes the cap — and keeps every record you issue.',
        retryAfterSeconds: ipLimit.retryAfterSeconds,
      },
      { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } },
    );
  }
  const durableIpLimit = await consumePublicActionRateLimit({
    action: 'free_boiler_download_ip',
    identifier: clientIdentifier,
    limit: FREE_BOILER_SERVICE_LIMITS.downloadPerIpPerDay,
    windowSeconds: DAY_MS / 1000,
  });
  if (!durableIpLimit.allowed) {
    return NextResponse.json(
      {
        error: "You've reached today's limit for this connection. " +
          'An account removes the cap — and keeps every record you issue.',
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
    action: 'free_boiler_download_email',
    identifier: email,
    limit: FREE_BOILER_SERVICE_LIMITS.downloadPerEmailPerDay,
    windowSeconds: DAY_MS / 1000,
  });
  if (!durableEmailLimit.allowed) {
    return NextResponse.json(
      {
        error: `That email address has already been sent ${FREE_BOILER_SERVICE_LIMITS.downloadPerEmailPerDay} documents today. ` +
          'An account removes the cap.',
      },
      { status: 429, headers: { 'Retry-After': String(durableEmailLimit.retryAfterSeconds) } },
    );
  }

  const emailCount = await emailDownloadCountToday(email);
  if (emailCapReached(emailCount)) {
    return NextResponse.json(
      {
        error: `That email address has already been sent ${FREE_BOILER_SERVICE_LIMITS.downloadPerEmailPerDay} documents today. ` +
          'An account removes the cap.',
      },
      { status: 429 },
    );
  }

  const errors = freeBoilerServiceIssues(payload);
  if (errors.length) {
    return NextResponse.json({ error: 'The record is not complete yet.', issues: errors }, { status: 422 });
  }

  const reference = freeCp12Reference();
  const pdfBytes = await buildFreeBoilerServicePdf(payload, { reference, issuedAt: new Date() });

  // Capture before sending — see the note in the CP12 download route.
  const lead = await recordFreeBoilerServiceLead(email);
  if (!lead.ok) {
    console.error('free boiler service lead capture failed', { error: lead.error });
  }

  const delivery = await sendFreeBoilerServiceEmail({ to: email, pdfBytes, reference });

  if (delivery.status === 'failed') {
    reportFreeToolEmailFailure('free_boiler_service', delivery.error);
    return NextResponse.json(
      { error: 'We could not email the record just now, but your download is ready below.', emailed: false, reference },
      { status: 200 },
    );
  }

  return NextResponse.json({ emailed: delivery.status === 'sent', reference });
}
