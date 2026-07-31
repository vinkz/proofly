import 'server-only';

import { randomUUID } from 'node:crypto';

import * as Sentry from '@sentry/nextjs';

import { FREE_CP12_LEAD_SOURCE, FREE_CP12_LIMITS } from '@/lib/cp12/free-tool';
import { sendEmail, isEmailConfigured, type SendEmailResult } from '@/lib/resend';
import { supabaseServerServiceRole } from '@/lib/supabaseServer';

/**
 * A certificate reference for a free CP12.
 *
 * Eight uppercase characters, matching the length of the per-account job code
 * so a landlord sees the same shape of reference whichever way the certificate
 * was produced. No "FREE-" prefix: what the engineer hands over should not
 * announce which tool made it.
 *
 * Random rather than sequential, and that part is not cosmetic. Account codes
 * are a per-user counter starting at 00000001, so a low-numbered random one
 * would collide with a real certificate belonging to a real account — two
 * different gas safety records carrying the same reference. Keeping the free
 * ones alphanumeric and high-entropy makes that effectively impossible while
 * still reading as a reference rather than a serial number.
 *
 * Still not stored: without an account there is no record to look up, so two
 * downloads of the same certificate get two references. That remains one of the
 * honest limitations of the free tool.
 */
export function freeCp12Reference() {
  return randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Per-email daily cap, counted in the database.
 *
 * The in-memory limiter in @/lib/rate-limit is per-instance and resets on cold
 * start, which makes it a poor fit for a per-identity cap. Counting the rows we
 * are already writing costs one indexed query and survives redeploys.
 *
 * Fails open: if this compatibility count cannot be read, the durable IP and
 * email limiters in the route still apply.
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

const SIGNUP_URL = 'https://certnow.uk/signup/step1';

/**
 * The honest pitch, at the moment it is most obviously true.
 *
 * Named for what it is: the limitation stated plainly first, then what fixes
 * it. The engineer has just typed a full property, landlord and appliance
 * record from scratch, so "you will type all of this again next time" lands
 * harder here than any feature list.
 */
const LIMITATION_LINES = [
  'Doing this property again next year? You will be typing all of it in again — the property, ' +
    'the landlord, every appliance.',
  'We did not keep a copy. Not the certificate, not the details you entered. We store your email ' +
    'address and nothing else, so if you lose these files we cannot re-send them or reissue them.',
  'A free CertNow account fixes all of that. Your details and your customers are remembered, so a ' +
    'repeat visit is a few taps. Every certificate you issue is kept and can be reissued, each one ' +
    'gets a link you can send the landlord, and you get a reminder before it runs out.',
];

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
    ...LIMITATION_LINES.flatMap((line) => [line, '']),
    `Create one free at ${SIGNUP_URL} — no card required.`,
  ].join('\n');

  const html = [
    `<p>${notices.length ? 'Your CP12 and warning notice(s) are attached.' : 'Your CP12 is attached.'}</p>`,
    `<p><strong>Reference:</strong> ${params.reference}</p>`,
    '<p>This is a complete Landlord Gas Safety Record — no watermark, nothing held back.</p>',
    ...(noticeLine ? [`<p>${noticeLine}</p>`] : []),
    ...LIMITATION_LINES.map((line) => `<p>${line}</p>`),
    `<p><a href="${SIGNUP_URL}">Create a free account</a> — no card required.</p>`,
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
