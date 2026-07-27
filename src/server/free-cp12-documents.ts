import 'server-only';

import { buildCp12RenderInput } from '@/lib/cp12/buildCp12Render';
import {
  freeCp12ToRenderSource,
  freeCp12ValidationInput,
  type FreeCp12Payload,
} from '@/lib/cp12/freeCp12Payload';
import { buildFreeGwnFields, freeGwnIssues, unsafeAppliances } from '@/lib/cp12/freeGwn';
import { validateCp12TierOne } from '@/lib/cp12/validation';
import { renderCp12CertificatePdf } from '@/server/pdf/renderCp12Certificate';
import { renderGasWarningNoticeV2Pdf } from '@/server/pdf/renderGasWarningNoticeV2';

/**
 * Everything a free submission produces: the CP12, plus a Gas Warning Notice
 * for each appliance classified At Risk or Immediately Dangerous.
 *
 * Preview and email both go through here so the set of documents a visitor
 * looked at is exactly the set that reaches their inbox.
 */
export type FreeCp12Document = {
  kind: 'cp12' | 'gas_warning_notice';
  title: string;
  filename: string;
  reference: string;
  bytes: Uint8Array;
};

const slug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'appliance';

/** Issue-blocking problems across the certificate and every notice it implies. */
export function freeSubmissionIssues(
  payload: FreeCp12Payload,
  options: { recordId: string; issuedAt: Date },
): string[] {
  return [
    ...validateCp12TierOne(freeCp12ValidationInput(payload)),
    ...freeGwnIssues(payload, options),
  ];
}

export async function buildFreeCp12Documents(
  payload: FreeCp12Payload,
  options: { reference: string; issuedAt: Date },
): Promise<FreeCp12Document[]> {
  const cp12Bytes = await renderCp12CertificatePdf(
    buildCp12RenderInput(
      freeCp12ToRenderSource(payload, {
        recordId: options.reference,
        certNumber: options.reference,
        issuedAt: options.issuedAt,
      }),
    ),
  );

  const documents: FreeCp12Document[] = [
    {
      kind: 'cp12',
      title: 'CP12 — Landlord Gas Safety Record',
      filename: 'cp12-landlord-gas-safety-record.pdf',
      reference: options.reference,
      bytes: cp12Bytes,
    },
  ];

  const unsafe = unsafeAppliances(payload);
  for (const entry of unsafe) {
    const reference = `${options.reference}-WN${entry.index + 1}`;
    const fields = buildFreeGwnFields(payload, entry, { recordId: reference, issuedAt: options.issuedAt });
    const bytes = await renderGasWarningNoticeV2Pdf({
      fields,
      issuedAt: options.issuedAt.toISOString(),
      recordId: reference,
    });
    const label = entry.classification === 'IMMEDIATELY_DANGEROUS' ? 'Immediately Dangerous' : 'At Risk';
    documents.push({
      kind: 'gas_warning_notice',
      title: `Warning notice — ${entry.appliance.location || `appliance ${entry.index + 1}`} (${label})`,
      filename: `gas-warning-notice-${entry.index + 1}-${slug(entry.appliance.location)}.pdf`,
      reference,
      bytes,
    });
  }

  return documents;
}
