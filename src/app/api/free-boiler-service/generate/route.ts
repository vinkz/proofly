import { NextResponse } from 'next/server';

import { FREE_BOILER_SERVICE_LIMITS } from '@/lib/boiler-service/free-tool';
import { FreeBoilerServiceSchema } from '@/lib/boiler-service/freeBoilerServicePayload';
import { consumePublicActionRateLimit } from '@/lib/public-action-security';
import { clientKeyFromRequest, rateLimit } from '@/lib/rate-limit';
import { buildFreeBoilerServicePdf, freeBoilerServiceIssues } from '@/server/free-boiler-service';
import { freeCp12Reference } from '@/server/free-cp12';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Render a boiler service record for an anonymous visitor.
 *
 * Nothing is written anywhere: no storage upload, no record row, no draft.
 */
export async function POST(request: Request) {
  const clientIdentifier = clientKeyFromRequest(request);
  const limit = rateLimit(
    `free-boiler-service:generate:${clientIdentifier}`,
    FREE_BOILER_SERVICE_LIMITS.generatePerIpPerHour,
    HOUR_MS,
  );
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: "You've generated a lot of records from this connection in the last hour. " +
          'Try again shortly, or create an account for unlimited records.',
        retryAfterSeconds: limit.retryAfterSeconds,
      },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }
  const durableLimit = await consumePublicActionRateLimit({
    action: 'free_boiler_generate_ip',
    identifier: clientIdentifier,
    limit: FREE_BOILER_SERVICE_LIMITS.generatePerIpPerHour,
    windowSeconds: HOUR_MS / 1000,
  });
  if (!durableLimit.allowed) {
    return NextResponse.json(
      {
        error: "You've generated a lot of records from this connection in the last hour. " +
          'Try again shortly, or create an account for unlimited records.',
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

  const parsed = FreeBoilerServiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Some answers were not in the expected format.' }, { status: 400 });
  }

  const errors = freeBoilerServiceIssues(parsed.data);
  if (errors.length) {
    return NextResponse.json({ error: 'The record is not complete yet.', issues: errors }, { status: 422 });
  }

  const reference = freeCp12Reference();
  const pdfBytes = await buildFreeBoilerServicePdf(parsed.data, { reference, issuedAt: new Date() });

  return new NextResponse(pdfBytes as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="boiler-service-record.pdf"',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
