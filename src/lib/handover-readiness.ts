import {
  getMissingOnboardingFields,
  isOnboardingProfileComplete,
  type OnboardingProfileShape,
} from '@/lib/onboarding-profile';
import { normalizeStandardRates } from '@/lib/standard-rates';

type InvoiceProfileShape = Partial<OnboardingProfileShape> & {
  bank_name?: string | null;
  bank_account_name?: string | null;
  bank_sort_code?: string | null;
  bank_account_number?: string | null;
  standard_rates?: unknown;
};

const hasText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

export function getCertificateReadiness(profile: Partial<OnboardingProfileShape> | null | undefined) {
  return {
    ready: isOnboardingProfileComplete(profile),
    missingFields: getMissingOnboardingFields(profile),
  };
}

export function getInvoiceReadiness(profile: InvoiceProfileShape | null | undefined) {
  const standardRates = normalizeStandardRates(profile?.standard_rates);
  const hasStandardRates = Boolean(
    standardRates.cp12 || standardRates.boiler_service || standardRates.cp12_boiler_service,
  );
  const missingBankFields = [
    { key: 'bank_name', label: 'Bank name' },
    { key: 'bank_account_name', label: 'Account name' },
    { key: 'bank_sort_code', label: 'Sort code' },
    { key: 'bank_account_number', label: 'Account number' },
  ].filter(({ key }) => !hasText(profile?.[key as keyof InvoiceProfileShape])).map((field) => field.label);

  const missingFields = [
    ...(!hasStandardRates ? ['Standard rates'] : []),
    ...missingBankFields,
  ];

  return {
    ready: missingFields.length === 0,
    hasStandardRates,
    hasBankTransferDetails: missingBankFields.length === 0,
    missingFields,
    standardRates,
  };
}

