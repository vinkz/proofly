import 'server-only';

import { FREE_BOILER_SERVICE_LEAD_SOURCE } from '@/lib/boiler-service/free-tool';
import {
  freeBoilerServiceToRenderInput,
  freeBoilerServiceValidationInput,
  type FreeBoilerServicePayload,
} from '@/lib/boiler-service/freeBoilerServicePayload';
import { validateGasServiceForIssue } from '@/lib/gas-service/validation';
import { sendEmail, isEmailConfigured, type SendEmailResult } from '@/lib/resend';
import { renderGasServicePdf } from '@/server/pdf/renderGasServicePdf';
import { recordLead } from '@/server/free-cp12';

const FILENAME = 'boiler-service-record.pdf';

/** The shared issue gate — the same one the authenticated flow applies. */
export function freeBoilerServiceIssues(payload: FreeBoilerServicePayload): string[] {
  return validateGasServiceForIssue(freeBoilerServiceValidationInput(payload));
}

export async function buildFreeBoilerServicePdf(
  payload: FreeBoilerServicePayload,
  options: { reference: string; issuedAt: Date },
): Promise<Uint8Array> {
  return renderGasServicePdf(
    freeBoilerServiceToRenderInput(payload, {
      recordId: options.reference,
      certNumber: options.reference,
      issuedAt: options.issuedAt,
    }),
  );
}

/** Same table, different source, so the two tools' leads stay distinguishable. */
export async function recordFreeBoilerServiceLead(email: string) {
  return recordLead(email, FREE_BOILER_SERVICE_LEAD_SOURCE);
}

export async function sendFreeBoilerServiceEmail(params: {
  to: string;
  pdfBytes: Uint8Array;
  reference: string;
}): Promise<SendEmailResult> {
  if (!isEmailConfigured()) return { status: 'not_configured' };

  const closing = [
    'We did not keep a copy. We store your email address and nothing else, so if you lose this',
    'file we cannot re-send it. A CertNow account keeps every record you issue, lets you reissue',
    'them, and gives each one a shareable link for the customer.',
  ].join(' ');

  const text = [
    'Your boiler service record is attached.',
    '',
    `Reference: ${params.reference}`,
    '',
    'This is a complete service record — no watermark, nothing held back.',
    '',
    closing,
  ].join('\n');

  const html = [
    '<p>Your boiler service record is attached.</p>',
    `<p><strong>Reference:</strong> ${params.reference}</p>`,
    '<p>This is a complete service record — no watermark, nothing held back.</p>',
    `<p>${closing}</p>`,
  ].join('');

  return sendEmail({
    to: params.to,
    subject: `Your boiler service record (${params.reference})`,
    text,
    html,
    attachments: [{ filename: FILENAME, content: Buffer.from(params.pdfBytes).toString('base64') }],
  });
}
