import 'server-only';

import { randomUUID } from 'node:crypto';

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
export async function recordFreeCp12Lead(email: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const sb = await supabaseServerServiceRole();
    const { error } = await sb
      .from('free_tool_leads')
      .insert({ email: email.toLowerCase(), source: FREE_CP12_LEAD_SOURCE });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

const FILENAME = 'cp12-landlord-gas-safety-record.pdf';

/** Email the finished certificate to the visitor as an attachment. */
export async function sendFreeCp12Email(params: {
  to: string;
  pdfBytes: Uint8Array;
  reference: string;
}): Promise<SendEmailResult> {
  if (!isEmailConfigured()) return { status: 'not_configured' };

  const text = [
    'Your CP12 is attached.',
    '',
    `Reference: ${params.reference}`,
    '',
    'This is a complete Landlord Gas Safety Record — no watermark, nothing held back.',
    '',
    "We did not keep a copy. We store your email address and nothing else, so if you lose this",
    'file we cannot re-send it. A CertNow account keeps every certificate you issue, lets you',
    'reissue them, and gives each one a shareable link for the landlord.',
  ].join('\n');

  const html = [
    '<p>Your CP12 is attached.</p>',
    `<p><strong>Reference:</strong> ${params.reference}</p>`,
    '<p>This is a complete Landlord Gas Safety Record — no watermark, nothing held back.</p>',
    '<p>We did not keep a copy. We store your email address and nothing else, so if you lose this ' +
      'file we cannot re-send it. A CertNow account keeps every certificate you issue, lets you ' +
      'reissue them, and gives each one a shareable link for the landlord.</p>',
  ].join('');

  return sendEmail({
    to: params.to,
    subject: `Your CP12 certificate (${params.reference})`,
    text,
    html,
    attachments: [
      {
        filename: FILENAME,
        content: Buffer.from(params.pdfBytes).toString('base64'),
      },
    ],
  });
}
