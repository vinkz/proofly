import 'server-only';

import { randomUUID } from 'node:crypto';

import * as Sentry from '@sentry/nextjs';

import { FREE_CP12_LEAD_SOURCE, FREE_CP12_LIMITS } from '@/lib/cp12/free-tool';
import { sendEmail, isEmailConfigured, type SendEmailResult } from '@/lib/resend';
import { supabaseServerServiceRole } from '@/lib/supabaseServer';

/**
 * An ephemeral certificate reference for a free CP12.
 *
 * Deliberately not stored and not sequential: without an account there is no
 * record to number. Two downloads of the same certificate get two references,
 * which is one of the honest limitations of the free tool.
 */
export function freeCp12Reference() {
  return `FREE-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Per-email daily cap, counted in the database.
 *
 * The in-memory limiter in @/lib/rate-limit is per-instance and resets on cold
 * start, which makes it a poor fit for a per-identity cap. Counting the rows we
 * are already writing costs one indexed query and survives redeploys.
 *
 * Fails open: if the count cannot be read, a visitor is not blocked from the
 * certificate they came for. The IP limiter still applies.
 */
export async function emailDownloadCountToday(email: string): Promise<number | null> {
  try {
    const sb = await supabaseServerServiceRole();
    const since = new Date(Date.now() - DAY_MS).toISOString();
    const { count, error } = await sb
      .from('free_tool_leads')
      .select('id', { count: 'exact', head: true })
      .eq('email', email.toLowerCase())
      .gte('created_at', since);
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

export function emailCapReached(count: number | null) {
  return count !== null && count >= FREE_CP12_LIMITS.downloadPerEmailPerDay;
}

/**
 * The one row the free tool persists: who asked for a certificate, and when.
 *
 * Nothing about the certificate contents is recorded — not the property, not
 * the landlord, not the appliances, not the PDF.
 */
/**
 * Write the lead row, and make any failure loud.
 *
 * The caller deliberately swallows the result — the visitor still gets their
 * certificate if capture fails, which is right for them and invisible to us.
 * That combination is how a broken funnel runs for a week unnoticed, so a
 * failure here is reported to Sentry rather than only logged. The email address
 * is deliberately not attached to the report: it is the one piece of personal
 * data these tools hold, and an error tracker is not where it belongs.
 */
export async function recordLead(
  email: string,
  source: string,
): Promise<{ ok: boolean; error?: string }> {
  const report = (error: unknown, detail: string) => {
    Sentry.captureException(error instanceof Error ? error : new Error(detail), {
      tags: { area: 'free_tools', operation: 'lead_capture', source },
      extra: { detail },
    });
  };

  try {
    const sb = await supabaseServerServiceRole();
    const { error } = await sb.from('free_tool_leads').insert({ email: email.toLowerCase(), source });
    if (error) {
      report(error, `free_tool_leads insert failed: ${error.message}`);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    report(error, `free_tool_leads insert threw: ${message}`);
    return { ok: false, error: message };
  }
}

export async function recordFreeCp12Lead(email: string) {
  return recordLead(email, FREE_CP12_LEAD_SOURCE);
}

/**
 * A delivery failure is reported for the same reason a capture failure is: the
 * visitor still gets their document from the browser, so nothing surfaces on
 * its own. No recipient address is attached.
 */
export function reportFreeToolEmailFailure(source: string, detail?: string) {
  Sentry.captureException(new Error(`free tool email delivery failed: ${detail ?? 'unknown'}`), {
    tags: { area: 'free_tools', operation: 'email_delivery', source },
  });
}

const NOT_KEPT = [
  'We did not keep a copy. We store your email address and nothing else, so if you lose these',
  'files we cannot re-send them. A CertNow account keeps every certificate you issue, lets you',
  'reissue them, and gives each one a shareable link for the landlord.',
].join(' ');

/** Email the finished documents to the visitor as attachments. */
export async function sendFreeCp12Email(params: {
  to: string;
  documents: Array<{ kind: string; title: string; filename: string; bytes: Uint8Array }>;
  reference: string;
}): Promise<SendEmailResult> {
  if (!isEmailConfigured()) return { status: 'not_configured' };

  const notices = params.documents.filter((doc) => doc.kind === 'gas_warning_notice');
  const noticeLine = notices.length
    ? `Also attached: ${notices.length} Gas Warning Notice${notices.length > 1 ? 's' : ''} for the unsafe ` +
      'appliance(s) recorded on the certificate. Give a copy to the responsible person. Remember that ' +
      'Immediately Dangerous fittings must be reported to HSE under RIDDOR within 14 days.'
    : '';

  const text = [
    notices.length ? 'Your CP12 and warning notice(s) are attached.' : 'Your CP12 is attached.',
    '',
    `Reference: ${params.reference}`,
    '',
    'This is a complete Landlord Gas Safety Record — no watermark, nothing held back.',
    ...(noticeLine ? ['', noticeLine] : []),
    '',
    NOT_KEPT,
  ].join('\n');

  const html = [
    `<p>${notices.length ? 'Your CP12 and warning notice(s) are attached.' : 'Your CP12 is attached.'}</p>`,
    `<p><strong>Reference:</strong> ${params.reference}</p>`,
    '<p>This is a complete Landlord Gas Safety Record — no watermark, nothing held back.</p>',
    ...(noticeLine ? [`<p>${noticeLine}</p>`] : []),
    `<p>${NOT_KEPT}</p>`,
  ].join('');

  return sendEmail({
    to: params.to,
    subject: notices.length
      ? `Your CP12 and warning notice (${params.reference})`
      : `Your CP12 certificate (${params.reference})`,
    text,
    html,
    attachments: params.documents.map((doc) => ({
      filename: doc.filename,
      content: Buffer.from(doc.bytes).toString('base64'),
    })),
  });
}
