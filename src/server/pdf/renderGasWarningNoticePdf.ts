import 'server-only';

import type { GasWarningNoticeFields } from '@/types/gas-warning-notice';
import { renderGasWarningNoticeV2Pdf } from './renderGasWarningNoticeV2';

// The Gas Warning Notice now uses the programmatic v2 renderer (CP12 house style,
// ID/AR classification as the spine, adaptive render-if-captured). This wrapper
// preserves the existing call signature used by the issue path.
export async function renderGasWarningNoticePdf(opts: {
  fields: GasWarningNoticeFields;
  issuedAt: string;
  recordId: string;
  companyLogoBytes?: Uint8Array;
}): Promise<Uint8Array> {
  return renderGasWarningNoticeV2Pdf(opts);
}
