import { describe, expect, it } from 'vitest';

import { getMissingOnboardingFields, isOnboardingProfileComplete } from '@/lib/onboarding-profile';

// Legal minimum to issue a CP12: engineer name + Gas Safe number. Company
// details must NOT block issuing (audit: Reg 36(3)(h)/(i)).
const legalMinimum = {
  full_name: 'A. Engineer',
  gas_safe_number: '123456',
};

describe('isOnboardingProfileComplete', () => {
  it('is complete with only engineer name + Gas Safe number (no company details)', () => {
    expect(isOnboardingProfileComplete(legalMinimum)).toBe(true);
    expect(getMissingOnboardingFields(legalMinimum)).toEqual([]);
  });

  it('accepts default_engineer_name in place of full_name', () => {
    expect(isOnboardingProfileComplete({ default_engineer_name: 'B. Engineer', gas_safe_number: '654321' })).toBe(true);
  });

  it('does NOT require company address / phone / postcode', () => {
    expect(isOnboardingProfileComplete({ ...legalMinimum, company_address: '', company_postcode: '', company_phone: '' })).toBe(true);
  });

  it('blocks when the Gas Safe number is missing or malformed', () => {
    expect(isOnboardingProfileComplete({ full_name: 'A. Engineer' })).toBe(false);
    expect(isOnboardingProfileComplete({ full_name: 'A. Engineer', gas_safe_number: '12' })).toBe(false);
    expect(getMissingOnboardingFields({ full_name: 'A. Engineer' })).toContain('Gas Safe number');
  });

  it('blocks when the engineer name is missing', () => {
    expect(isOnboardingProfileComplete({ gas_safe_number: '123456' })).toBe(false);
    expect(getMissingOnboardingFields({ gas_safe_number: '123456' })).toContain('Engineer name');
  });
});
