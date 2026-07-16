import { describe, expect, it } from 'vitest';

import { validateCp12TierOne } from '@/lib/cp12/validation';

const validFields = {
  inspection_date: '2026-07-11',
  property_address: '15 Acacia Avenue, London, SW1A 1AA',
  landlord_name: 'Alex Landlord',
  landlord_address: '21 Owner Street, London, SE1 1AA',
  engineer_name: 'A. Engineer',
  gas_safe_number: '123456',
  reg_26_9_confirmed: true,
  engineer_signature_path: 'signatures/engineer.png',
  customer_signature_path: 'signatures/customer.png',
};

const validAppliance = {
  appliance_type: 'boiler',
  make_model: 'Worcester Bosch Greenstar',
  location: 'Kitchen',
  safety_rating: 'safe',
  reg_26_9_confirmed: true,
};

describe('validateCp12TierOne', () => {
  it('blocks a missing landlord correspondence address instead of using the property address', () => {
    const errors = validateCp12TierOne({
      fields: { ...validFields, landlord_address: '', landlord_address_line1: '', landlord_city: '', landlord_postcode: '' },
      appliances: [validAppliance],
    });

    expect(errors).toContain('Landlord or agent correspondence address is required');
  });

  it('requires Regulation 26(9) confirmation for every active appliance', () => {
    const errors = validateCp12TierOne({
      fields: validFields,
      appliances: [{ ...validAppliance, reg_26_9_confirmed: false }],
    });

    expect(errors).toContain('Appliance 1: Regulation 26(9) confirmation is required');
  });

  it('accepts a complete tier-one record', () => {
    expect(validateCp12TierOne({ fields: validFields, appliances: [validAppliance] })).toEqual([]);
  });

  it('does not require a separate record-level Regulation 26(9) flag (per-appliance is sufficient)', () => {
    const errors = validateCp12TierOne({
      fields: { ...validFields, reg_26_9_confirmed: false },
      appliances: [validAppliance], // per-appliance reg_26_9_confirmed: true
    });
    expect(errors).toEqual([]);
  });

  it('accepts a record with no customer signature (customer signature is optional)', () => {
    const errors = validateCp12TierOne({
      fields: { ...validFields, customer_signature_path: '', customer_signature: '', customer_signature_url: '' },
      appliances: [validAppliance],
    });
    expect(errors).toEqual([]);
  });

  it('still blocks a missing engineer signature', () => {
    const errors = validateCp12TierOne({
      fields: { ...validFields, engineer_signature_path: '', engineer_signature: '', engineer_signature_url: '' },
      appliances: [validAppliance],
    });
    expect(errors).toContain('Engineer signature is required');
  });
});
