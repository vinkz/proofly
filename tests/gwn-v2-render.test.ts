import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabaseServer', () => ({ supabaseServerServiceRole: async () => null }));

import { renderGasWarningNoticeV2Pdf } from '@/server/pdf/renderGasWarningNoticeV2';
import type { GasWarningNoticeFields } from '@/types/gas-warning-notice';

const base: GasWarningNoticeFields = {
  record_id: 'GWN-TEST-1',
  issued_at: '12/07/2026',
  engineer_name: 'A. Engineer',
  gas_safe_number: '123456',
  job_address_line1: '15 Acacia Avenue',
  job_postcode: 'SW1A 1AA',
  customer_name: 'Alex Landlord',
  appliance_type: 'Back boiler',
  appliance_location: 'Living room',
  unsafe_situation_description: 'Spillage of products of combustion.',
  actions_taken: 'Turned off with permission.',
  customer_informed: true,
};

const isPdf = (bytes: Uint8Array) => bytes.byteLength > 1000 && bytes[0] === 0x25 && bytes[1] === 0x50;

describe('Gas Warning Notice v2 renderer', () => {
  it('renders an At Risk notice', async () => {
    const bytes = await renderGasWarningNoticeV2Pdf({
      fields: { ...base, classification: 'AT_RISK', classification_code: 'AR', ventilation_issue: true },
      issuedAt: '2026-07-12T09:00:00Z',
      recordId: 'job-1',
    });
    expect(isPdf(bytes)).toBe(true);
  });

  it('renders an Immediately Dangerous notice with RIDDOR + Danger label details', async () => {
    const bytes = await renderGasWarningNoticeV2Pdf({
      fields: {
        ...base,
        classification: 'IMMEDIATELY_DANGEROUS',
        classification_code: 'ID',
        gas_escape_issue: true,
        danger_do_not_use_label_fitted: true,
        appliance_capped_off: true,
        riddor_11_1_reported: true,
        emergency_reference: 'HSE-DGF-1',
      },
      issuedAt: '2026-07-12T09:00:00Z',
      recordId: 'job-2',
    });
    expect(isPdf(bytes)).toBe(true);
  });

  it('renders with a bare minimum (no classification) without throwing', async () => {
    const bytes = await renderGasWarningNoticeV2Pdf({
      fields: { record_id: 'x', engineer_name: 'A', gas_safe_number: '1' },
      issuedAt: '2026-07-12T09:00:00Z',
      recordId: 'job-3',
    });
    expect(isPdf(bytes)).toBe(true);
  });
});
