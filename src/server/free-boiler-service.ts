import 'server-only';

const SIGNUP_URL = 'https://certnow.uk/signup/step1';

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

  // Same shape as the free CP12 email: the limitation stated plainly, at the
  // moment the engineer has just typed the whole record in from scratch.
  const closing = [
    'Servicing this boiler again next year? You will be typing all of it in again — the customer, ' +
      'the appliance, every reading.',
    'We did not keep a copy. Not the record, not the details you entered. We store your email ' +
      'address and nothing else, so if you lose this file we cannot re-send it.',
    'A free CertNow account fixes all of that. Your details and your customers are remembered, so ' +
      'a repeat visit is a few taps. Every record you issue is kept and can be reissued, and each ' +
      'one gets a link you can send the customer.',
  ];

  const text = [
    'Your boiler service record is attached.',
    '',
    `Reference: ${params.reference}`,
    '',
    'This is a complete service record — no watermark, nothing held back.',
    '',
    ...closing.flatMap((line) => [line, '']),
    `Create one free at ${SIGNUP_URL} — no card required.`,
  ].join('\n');

  const html = [
    '<p>Your boiler service record is attached.</p>',
    `<p><strong>Reference:</strong> ${params.reference}</p>`,
    '<p>This is a complete service record — no watermark, nothing held back.</p>',
    ...closing.map((line) => `<p>${line}</p>`),
    `<p><a href="${SIGNUP_URL}">Create a free account</a> — no card required.</p>`,
  ].join('');

  return sendEmail({
    to: params.to,
    subject: `Your boiler service record (${params.reference})`,
    text,
    html,
    attachments: [{ filename: FILENAME, content: Buffer.from(params.pdfBytes).toString('base64') }],
  });
}
