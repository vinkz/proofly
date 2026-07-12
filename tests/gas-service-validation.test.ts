import { describe, expect, it } from 'vitest';

import { validateGasServiceForIssue } from '@/lib/gas-service/validation';

const complete: Record<string, unknown> = {
  property_address: '15 Acacia Avenue, London, SW1A 1AA',
  service_date: '2026-07-12',
  engineer_name: 'A. Engineer',
  gas_safe_number: '123456',
  boiler_make: 'Worcester Bosch',
  boiler_model: 'Greenstar 30i',
  boiler_location: 'Kitchen cupboard',
  appliance_flueing_safe: 'Pass',
  appliance_ventilation_safe: 'Pass',
  operating_pressure_mbar: '20',
  heat_input: '24',
  appliance_safe: 'Yes',
  engineer_signature: 'data:image/png;base64,AAAA',
};

describe('validateGasServiceForIssue', () => {
  it('accepts a complete record (no customer signature, no summary/recommendations)', () => {
    expect(validateGasServiceForIssue(complete)).toEqual([]);
  });

  it('does NOT require a customer signature or service summary/recommendations', () => {
    const errors = validateGasServiceForIssue(complete);
    expect(errors.join(' ')).not.toMatch(/customer signature/i);
    expect(errors.join(' ')).not.toMatch(/summary|recommendation/i);
  });

  it('blocks when a Reg 26(9) outcome is missing', () => {
    const errors = validateGasServiceForIssue({ ...complete, appliance_ventilation_safe: '', service_ventilation_checked: '' });
    expect(errors.some((e) => e.includes('Ventilation result (Reg 26(9))'))).toBe(true);
  });

  it('accepts a Reg 26(9) outcome via its service fallback key', () => {
    const errors = validateGasServiceForIssue({ ...complete, appliance_flueing_safe: '', service_flue_checked: 'Pass' });
    expect(errors).toEqual([]);
  });

  it('requires the engineer signature', () => {
    const errors = validateGasServiceForIssue({ ...complete, engineer_signature: '' });
    expect(errors).toContain('Engineer signature is required');
  });

  it('requires defect details when the appliance is unsafe', () => {
    const errors = validateGasServiceForIssue({ ...complete, appliance_safe: 'No' });
    expect(errors.some((e) => e.toLowerCase().includes('defect details'))).toBe(true);
  });

  it('accepts a property job-address fallback instead of property_address', () => {
    const { property_address, ...rest } = complete;
    void property_address;
    expect(validateGasServiceForIssue({ ...rest, job_address_line1: '15 Acacia Avenue', job_postcode: 'SW1A 1AA' })).toEqual([]);
  });
});
