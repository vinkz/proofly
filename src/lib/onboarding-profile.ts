import type { Tables } from '@/lib/database.types';

export type OnboardingProfileShape = Pick<
  Tables<'profiles'>,
  | 'full_name'
  | 'date_of_birth'
  | 'profession'
  | 'company_name'
  | 'company_address'
  | 'company_postcode'
  | 'company_phone'
  | 'default_engineer_name'
  | 'default_engineer_id'
  | 'gas_safe_number'
>;

export const ONBOARDING_REQUIRED_FIELDS: Array<{ key: keyof OnboardingProfileShape; label: string }> = [
  { key: 'full_name', label: 'Full name' },
  { key: 'date_of_birth', label: 'Date of birth' },
  { key: 'profession', label: 'Profession' },
  { key: 'company_name', label: 'Company name' },
  { key: 'company_address', label: 'Company address line 1' },
  { key: 'company_postcode', label: 'Company postcode' },
  { key: 'company_phone', label: 'Company phone' },
  { key: 'default_engineer_id', label: 'Engineer ID card number' },
  { key: 'gas_safe_number', label: 'Gas Safe number' },
];

export function isOnboardingProfileComplete(profile: Partial<OnboardingProfileShape> | null | undefined) {
  if (!profile) return false;

  return ONBOARDING_REQUIRED_FIELDS.every(({ key }) => {
    const value =
      key === 'default_engineer_name'
        ? profile.default_engineer_name ?? profile.full_name
        : profile[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

export function getMissingOnboardingFields(profile: Partial<OnboardingProfileShape> | null | undefined) {
  if (!profile) return ONBOARDING_REQUIRED_FIELDS.map((field) => field.label);

  return ONBOARDING_REQUIRED_FIELDS.filter(({ key }) => {
    const value =
      key === 'default_engineer_name'
        ? profile.default_engineer_name ?? profile.full_name
        : profile[key];
    return !(typeof value === 'string' && value.trim().length > 0);
  }).map((field) => field.label);
}
