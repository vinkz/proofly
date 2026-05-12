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

export const GAS_SAFE_NUMBER_PATTERN = /^\d{6}$/;
export const ENGINEER_ID_CARD_NUMBER_PATTERN = /^\d{7}$/;
export const GAS_SAFE_NUMBER_MESSAGE = 'Gas Safe registration number must be 6 digits';
export const ENGINEER_ID_CARD_NUMBER_MESSAGE = 'Engineer ID card number must be 7 digits';

function hasValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isOnboardingProfileComplete(profile: Partial<OnboardingProfileShape> | null | undefined) {
  if (!profile) return false;

  return ONBOARDING_REQUIRED_FIELDS.every(({ key }) => {
    const value =
      key === 'default_engineer_name'
        ? profile.default_engineer_name ?? profile.full_name
        : profile[key];
    if (!hasValue(value)) return false;
    if (key === 'gas_safe_number') return GAS_SAFE_NUMBER_PATTERN.test(String(value).trim());
    if (key === 'default_engineer_id') return ENGINEER_ID_CARD_NUMBER_PATTERN.test(String(value).trim());
    return true;
  });
}

export function getMissingOnboardingFields(profile: Partial<OnboardingProfileShape> | null | undefined) {
  if (!profile) return ONBOARDING_REQUIRED_FIELDS.map((field) => field.label);

  return ONBOARDING_REQUIRED_FIELDS.filter(({ key }) => {
    const value =
      key === 'default_engineer_name'
        ? profile.default_engineer_name ?? profile.full_name
        : profile[key];
    if (!hasValue(value)) return true;
    if (key === 'gas_safe_number') return !GAS_SAFE_NUMBER_PATTERN.test(String(value).trim());
    if (key === 'default_engineer_id') return !ENGINEER_ID_CARD_NUMBER_PATTERN.test(String(value).trim());
    return false;
  }).map((field) => field.label);
}

export function getOnboardingStep(profile: Partial<OnboardingProfileShape> | null | undefined) {
  if (
    !hasValue(profile?.full_name) ||
    !hasValue(profile?.date_of_birth) ||
    !hasValue(profile?.profession)
  ) {
    return 1;
  }

  if (
    !hasValue(profile?.company_name) ||
    !hasValue(profile?.company_address) ||
    !hasValue(profile?.company_postcode) ||
    !hasValue(profile?.company_phone)
  ) {
    return 2;
  }

  if (
    !GAS_SAFE_NUMBER_PATTERN.test(String(profile?.gas_safe_number ?? '').trim()) ||
    !ENGINEER_ID_CARD_NUMBER_PATTERN.test(String(profile?.default_engineer_id ?? '').trim())
  ) {
    return 3;
  }

  return 1;
}
