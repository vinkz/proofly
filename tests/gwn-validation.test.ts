import { describe, expect, it } from 'vitest';

import { validateGwnForIssue } from '@/lib/gwn/validation';
import type { GasWarningNoticeFields } from '@/types/gas-warning-notice';

const base: GasWarningNoticeFields = {
  property_address: '15 Acacia Avenue, London',
  customer_name: 'Alex Landlord',
  appliance_location: 'Living room',
  appliance_type: 'Back boiler',
  unsafe_situation_description: 'Spillage of combustion products.',
  actions_taken: 'Turned off with permission.',
  engineer_name: 'A. Engineer',
  gas_safe_number: '123456',
  issued_at: '12/07/2026',
  record_id: 'GWN-1',
  customer_present: true,
  customer_informed: true,
  engineer_signature: 'https://example.test/signatures/engineer.png',
};

describe('validateGwnForIssue', () => {
  it('accepts a complete At Risk notice without a RIDDOR report', () => {
    expect(validateGwnForIssue({ ...base, classification: 'AT_RISK' })).toEqual([]);
  });

  it('blocks an Immediately Dangerous notice with no RIDDOR report or reference', () => {
    const errors = validateGwnForIssue({
      ...base,
      classification: 'IMMEDIATELY_DANGEROUS',
      danger_do_not_use_label_fitted: true,
      gas_supply_isolated: true,
    });
    expect(errors.some((e) => e.includes('RIDDOR'))).toBe(true);
  });

  it('accepts an Immediately Dangerous notice once RIDDOR is recorded', () => {
    expect(
      validateGwnForIssue({
        ...base,
        classification: 'IMMEDIATELY_DANGEROUS',
        danger_do_not_use_label_fitted: true,
        gas_supply_isolated: true,
        riddor_11_2_reported: true,
      }),
    ).toEqual([]);
    expect(
      validateGwnForIssue({
        ...base,
        classification: 'IMMEDIATELY_DANGEROUS',
        danger_do_not_use_label_fitted: true,
        gas_supply_isolated: true,
        emergency_reference: 'HSE-DGF-1',
      }),
    ).toEqual([]);
  });

  it('still requires the Danger label and isolation/refusal for Immediately Dangerous', () => {
    const errors = validateGwnForIssue({ ...base, classification: 'IMMEDIATELY_DANGEROUS', emergency_reference: 'HSE-DGF-1' });
    expect(errors.some((e) => e.includes('Danger'))).toBe(true);
    expect(errors.some((e) => e.toLowerCase().includes('isolated'))).toBe(true);
  });

  it('blocks when a tier-1 field is missing', () => {
    expect(validateGwnForIssue({ ...base, classification: 'AT_RISK', engineer_name: '' }).length).toBeGreaterThan(0);
  });

  it('requires notice-left confirmation when the customer is not present', () => {
    const errors = validateGwnForIssue({ ...base, classification: 'AT_RISK', customer_present: false, customer_informed: false });
    expect(errors.some((e) => e.toLowerCase().includes('notice left'))).toBe(true);
  });

  it('blocks an otherwise complete notice that the engineer has not signed', () => {
    const unsigned = { ...base, engineer_signature: '' };
    const errors = validateGwnForIssue({ ...unsigned, classification: 'AT_RISK' });
    expect(errors).toContain('Engineer signature is required');
  });

  it('accepts the signature under any of the three keys the flows write', () => {
    const unsigned = { ...base, engineer_signature: '' };
    for (const key of ['engineer_signature', 'engineer_signature_path', 'engineer_signature_url']) {
      expect(
        validateGwnForIssue({ ...unsigned, classification: 'AT_RISK', [key]: 'sig-value' }),
      ).toEqual([]);
    }
  });
});
