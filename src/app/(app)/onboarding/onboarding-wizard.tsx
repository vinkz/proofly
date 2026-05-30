'use client';

import { useDeferredValue, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import type { AddressLookupResult, AddressLookupSuggestion } from '@/lib/address-lookup';
import {
  ENGINEER_ID_CARD_NUMBER_MESSAGE,
  ENGINEER_ID_CARD_NUMBER_PATTERN,
  GAS_SAFE_NUMBER_MESSAGE,
  GAS_SAFE_NUMBER_PATTERN,
} from '@/lib/onboarding-profile';
import { TRADE_TYPES } from '@/lib/profile-options';
import { updateProfileBasics } from '@/server/profile';

type OnboardingWizardProps = {
  initialFullName?: string;
  initialDateOfBirth?: string;
  initialProfession?: string;
  initialCompanyName?: string;
  initialCompanyAddressLine1?: string;
  initialCompanyAddressLine2?: string;
  initialCompanyTown?: string;
  initialCompanyPostcode?: string;
  initialCompanyPhone?: string;
  initialEngineerId?: string;
  initialGasSafeNumber?: string;
  initialStep?: number;
};

const steps = [
  { id: 1, title: 'About you' },
  { id: 2, title: 'Your business' },
  { id: 3, title: 'Engineer details' },
] as const;

const ADDRESS_SEARCH_MIN_QUERY_LENGTH = 3;

type AddressLookupApiResponse = {
  suggestions?: AddressLookupSuggestion[];
  address?: AddressLookupResult;
  error?: string;
};

const isAddressLookupUnavailable = (message: string | null) => {
  const normalized = String(message ?? '').toLowerCase();
  return normalized.includes('disabled') || normalized.includes('not configured');
};

const fieldLabel = (text: string) => (
  <p className="text-[11px] font-medium tracking-[0.5px] text-[var(--color-text-tertiary)]">{text}</p>
);

export function OnboardingWizard({
  initialFullName = '',
  initialDateOfBirth = '',
  initialProfession = '',
  initialCompanyName = '',
  initialCompanyAddressLine1 = '',
  initialCompanyAddressLine2 = '',
  initialCompanyTown = '',
  initialCompanyPostcode = '',
  initialCompanyPhone = '',
  initialEngineerId = '',
  initialGasSafeNumber = '',
  initialStep,
}: OnboardingWizardProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState(initialFullName);
  const [dateOfBirth, setDateOfBirth] = useState(initialDateOfBirth);
  const [profession, setProfession] = useState(initialProfession);
  const [professionChoice, setProfessionChoice] = useState(
    initialProfession && TRADE_TYPES.includes(initialProfession as (typeof TRADE_TYPES)[number])
      ? initialProfession
      : initialProfession
        ? 'Other'
        : '',
  );
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [companyAddressLine1, setCompanyAddressLine1] = useState(initialCompanyAddressLine1);
  const [companyAddressLine2, setCompanyAddressLine2] = useState(initialCompanyAddressLine2);
  const [companyTown, setCompanyTown] = useState(initialCompanyTown);
  const [companyPostcode, setCompanyPostcode] = useState(initialCompanyPostcode);
  const [companyPhone, setCompanyPhone] = useState(initialCompanyPhone);
  const [companyAddressSearchQuery, setCompanyAddressSearchQuery] = useState(initialCompanyAddressLine1);
  const [companyAddressSuggestions, setCompanyAddressSuggestions] = useState<AddressLookupSuggestion[]>([]);
  const [selectedCompanyAddressMatchId, setSelectedCompanyAddressMatchId] = useState<string | null>(null);
  const [companyAddressSearchError, setCompanyAddressSearchError] = useState<string | null>(null);
  const [isCompanyAddressLookupPending, setIsCompanyAddressLookupPending] = useState(false);
  const [engineerId, setEngineerId] = useState(initialEngineerId);
  const [gasSafeNumber, setGasSafeNumber] = useState(initialGasSafeNumber);
  const deferredCompanyAddressSearchQuery = useDeferredValue(companyAddressSearchQuery.trim());
  const [step, setStep] = useState(() => {
    const requestedInitialStep = initialStep;
    if (
      typeof requestedInitialStep === 'number' &&
      Number.isInteger(requestedInitialStep) &&
      requestedInitialStep >= 1 &&
      requestedInitialStep <= steps.length
    ) {
      return requestedInitialStep;
    }
    if (!fullName.trim() || !dateOfBirth.trim() || !profession.trim()) return 1;
    if (!companyName.trim() || !companyAddressLine1.trim() || !companyPostcode.trim() || !companyPhone.trim()) {
      return 2;
    }
    if (!engineerId.trim() || !gasSafeNumber.trim()) return 3;
    return 1;
  });

  useEffect(() => {
    if (!deferredCompanyAddressSearchQuery) {
      setCompanyAddressSuggestions([]);
      setSelectedCompanyAddressMatchId(null);
      setCompanyAddressSearchError(null);
      setIsCompanyAddressLookupPending(false);
      return;
    }

    if (deferredCompanyAddressSearchQuery.length < ADDRESS_SEARCH_MIN_QUERY_LENGTH) {
      setCompanyAddressSuggestions([]);
      setSelectedCompanyAddressMatchId(null);
      setCompanyAddressSearchError(`Type at least ${ADDRESS_SEARCH_MIN_QUERY_LENGTH} characters to search.`);
      setIsCompanyAddressLookupPending(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsCompanyAddressLookupPending(true);
      setCompanyAddressSearchError(null);

      try {
        const query = encodeURIComponent(deferredCompanyAddressSearchQuery);
        const response = await fetch(`/api/address-search?q=${query}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        const payload = (await response.json()) as AddressLookupApiResponse;
        if (!response.ok) {
          throw new Error(payload.error || 'Lookup failed');
        }

        const suggestions = payload.suggestions ?? [];
        setCompanyAddressSuggestions(suggestions);
        setSelectedCompanyAddressMatchId(null);
        setCompanyAddressSearchError(
          suggestions.length ? null : 'No addresses found. Try a postcode or add more detail.',
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'Try another search.';
        setCompanyAddressSuggestions([]);
        setSelectedCompanyAddressMatchId(null);
        setCompanyAddressSearchError(isAddressLookupUnavailable(message) ? null : message);
      } finally {
        if (!controller.signal.aborted) {
          setIsCompanyAddressLookupPending(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [deferredCompanyAddressSearchQuery]);

  const handleCompanyAddressMatchSelect = async (suggestion: AddressLookupSuggestion) => {
    setIsCompanyAddressLookupPending(true);
    setSelectedCompanyAddressMatchId(suggestion.id);
    setCompanyAddressSearchError(null);

    try {
      const response = await fetch(`/api/address-search?id=${encodeURIComponent(suggestion.id)}`, {
        headers: { Accept: 'application/json' },
      });
      const payload = (await response.json()) as AddressLookupApiResponse;
      if (!response.ok || !payload.address) {
        throw new Error(payload.error || 'Lookup failed');
      }

      const address = payload.address;
      setCompanyAddressSearchQuery(address.line1);
      setCompanyAddressLine1(address.line1);
      setCompanyAddressLine2(address.line2);
      setCompanyTown(address.city);
      setCompanyPostcode(address.postcode || '');
      setCompanyAddressSuggestions([]);
      pushToast({
        title: 'Address selected',
        variant: 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Try again.';
      setSelectedCompanyAddressMatchId(null);
      setCompanyAddressSearchError(isAddressLookupUnavailable(message) ? null : message);
      if (!isAddressLookupUnavailable(message)) {
        pushToast({
          title: 'Address not found',
          description: message,
          variant: 'error',
        });
      }
    } finally {
      setIsCompanyAddressLookupPending(false);
    }
  };

  const validateCurrentStep = () => {
    const missing =
      step === 1
        ? [
            ['Full name', fullName],
            ['Date of birth', dateOfBirth],
            ['Profession', profession],
          ]
        : step === 2
          ? [
              ['Company name', companyName],
              ['Address line 1', companyAddressLine1],
              ['Postcode', companyPostcode],
              ['Phone', companyPhone],
            ]
          : [
              ['Gas Safe number', gasSafeNumber],
              ['ID card number', engineerId],
            ];

    const empty = missing.filter(([, value]) => !String(value).trim()).map(([label]) => label);
    if (empty.length) {
      pushToast({
        title: 'Required fields missing',
        description: `Fill: ${empty.join(', ')}`,
        variant: 'error',
      });
      return false;
    }

    if (step === 3) {
      if (!GAS_SAFE_NUMBER_PATTERN.test(gasSafeNumber.trim())) {
        pushToast({
          title: 'Check Gas Safe number',
          description: GAS_SAFE_NUMBER_MESSAGE,
          variant: 'error',
        });
        return false;
      }

      if (!ENGINEER_ID_CARD_NUMBER_PATTERN.test(engineerId.trim())) {
        pushToast({
          title: 'Check ID card number',
          description: ENGINEER_ID_CARD_NUMBER_MESSAGE,
          variant: 'error',
        });
        return false;
      }
    }

    return true;
  };

  const getCurrentStepPayload = (mode: 'next' | 'later' | 'finish') => {
    const includeValue = (value: string) => {
      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    };

    if (step === 1) {
      return {
        ...(mode !== 'later' || fullName.trim() ? { full_name: includeValue(fullName) } : {}),
        ...(mode !== 'later' || dateOfBirth.trim() ? { date_of_birth: includeValue(dateOfBirth) } : {}),
        ...(mode !== 'later' || profession.trim() ? { profession: includeValue(profession) } : {}),
      };
    }

    if (step === 2) {
      return {
        ...(mode !== 'later' || companyName.trim() ? { company_name: includeValue(companyName) } : {}),
        ...(mode !== 'later' || companyAddressLine1.trim()
          ? { company_address: includeValue(companyAddressLine1) }
          : {}),
        ...(companyAddressLine2.trim() ? { company_address_line2: includeValue(companyAddressLine2) } : {}),
        ...(companyTown.trim() ? { company_town: includeValue(companyTown) } : {}),
        ...(mode !== 'later' || companyPostcode.trim()
          ? { company_postcode: includeValue(companyPostcode) }
          : {}),
        ...(mode !== 'later' || companyPhone.trim() ? { company_phone: includeValue(companyPhone) } : {}),
      };
    }

    return {
      ...(mode !== 'later' || gasSafeNumber.trim()
        ? { gas_safe_number: includeValue(gasSafeNumber) }
        : {}),
      ...(mode !== 'later' || engineerId.trim()
        ? { default_engineer_id: includeValue(engineerId) }
        : {}),
    };
  };

  const saveStep = (mode: 'next' | 'later' | 'finish') => {
    if (mode !== 'later' && !validateCurrentStep()) return;

    startTransition(async () => {
      try {
        await updateProfileBasics(getCurrentStepPayload(mode));

        if (mode === 'next') {
          setStep((current) => Math.min(current + 1, steps.length));
          pushToast({
            title: 'Progress saved',
            description: 'You can continue with the next step.',
            variant: 'success',
          });
          return;
        }

        pushToast({
          title: mode === 'finish' ? 'Setup complete' : 'Progress saved',
          description:
            mode === 'finish'
              ? 'Your profile is ready for job creation.'
              : 'You can finish the remaining details later in Settings.',
          variant: 'success',
        });
        router.push('/dashboard');
      } catch (error) {
        pushToast({
          title: 'Unable to save',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const progressPct = Math.round((step / steps.length) * 100);

  return (
    <div>
      {/* Step indicator */}
      <p className="text-[12px] text-[var(--color-text-tertiary)]">
        Step {step} of {steps.length}
      </p>
      <p className="mb-3 mt-0.5 text-[18px] font-medium text-[var(--color-text-primary)]">
        {steps[step - 1].title}
      </p>
      <div className="mb-5 h-1 w-full overflow-hidden rounded-full bg-[var(--color-background-tertiary)]">
        <div
          className="h-full rounded-full bg-[var(--color-action)] transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Fields card */}
      <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">

        {/* Step 1: About you */}
        {step === 1 ? (
          <div className="flex flex-col gap-4">
            <div>
              {fieldLabel('Full name')}
              <Input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-1.5"
                disabled={isPending}
              />
            </div>
            <div>
              {fieldLabel('Date of birth')}
              <Input
                type="date"
                value={dateOfBirth}
                onChange={(event) => setDateOfBirth(event.target.value)}
                className="mt-1.5"
                disabled={isPending}
              />
            </div>
            <div>
              {fieldLabel('Profession')}
              <select
                value={professionChoice}
                onChange={(event) => {
                  const value = event.target.value;
                  setProfessionChoice(value);
                  if (value && value !== 'Other') {
                    setProfession(value);
                  } else if (value !== 'Other') {
                    setProfession('');
                  }
                }}
                disabled={isPending}
                className="mt-1.5 h-11 w-full rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 text-[14px] text-[var(--color-text-primary)] focus:border-[var(--color-action)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-action-ring)]"
              >
                <option value="">Select profession</option>
                {TRADE_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
                <option value="Other">Other</option>
              </select>
            </div>
            {professionChoice === 'Other' ? (
              <div>
                {fieldLabel('Profession (manual)')}
                <Input
                  value={profession}
                  onChange={(event) => setProfession(event.target.value)}
                  className="mt-1.5"
                  disabled={isPending}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Step 2: Business */}
        {step === 2 ? (
          <div className="flex flex-col gap-4">
            <div>
              {fieldLabel('Company name')}
              <Input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className="mt-1.5"
                disabled={isPending}
              />
            </div>
            <div className="relative">
              {fieldLabel('Address line 1')}
              <Input
                value={companyAddressSearchQuery}
                onChange={(event) => {
                  const value = event.target.value;
                  setCompanyAddressSearchQuery(value);
                  setCompanyAddressLine1(value);
                  setCompanyAddressSearchError(null);
                  setSelectedCompanyAddressMatchId(null);
                }}
                className="mt-1.5"
                disabled={isPending}
                placeholder="Start typing address or postcode"
              />
              {isCompanyAddressLookupPending && !companyAddressSuggestions.length ? (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-[13px] text-[var(--color-text-secondary)] shadow-sm">
                  Searching addresses…
                </div>
              ) : null}
              {companyAddressSuggestions.length ? (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-sm">
                  <div className="max-h-60 overflow-y-auto p-1.5">
                    {companyAddressSuggestions.map((suggestion) => {
                      const isSelected = selectedCompanyAddressMatchId === suggestion.id;
                      return (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => void handleCompanyAddressMatchSelect(suggestion)}
                          className={`w-full rounded-[8px] px-3 py-2 text-left text-[13px] transition-colors ${
                            isSelected
                              ? 'bg-[var(--color-action-bg)] text-[var(--color-action)]'
                              : 'text-[var(--color-text-primary)] hover:bg-[var(--color-background-tertiary)]'
                          }`}
                        >
                          {suggestion.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {companyAddressSearchError ? (
                <p className="mt-1.5 text-[12px] text-[var(--color-red)]">{companyAddressSearchError}</p>
              ) : null}
            </div>
            <div>
              {fieldLabel('Address line 2')}
              <Input
                value={companyAddressLine2}
                onChange={(event) => setCompanyAddressLine2(event.target.value)}
                className="mt-1.5"
                disabled={isPending}
              />
            </div>
            <div>
              {fieldLabel('Town / city')}
              <Input
                value={companyTown}
                onChange={(event) => setCompanyTown(event.target.value)}
                className="mt-1.5"
                disabled={isPending}
              />
            </div>
            <div>
              {fieldLabel('Postcode')}
              <Input
                value={companyPostcode}
                onChange={(event) => setCompanyPostcode(event.target.value)}
                className="mt-1.5"
                disabled={isPending}
              />
            </div>
            <div>
              {fieldLabel('Phone')}
              <Input
                value={companyPhone}
                onChange={(event) => setCompanyPhone(event.target.value)}
                className="mt-1.5"
                disabled={isPending}
              />
            </div>
          </div>
        ) : null}

        {/* Step 3: Engineer details */}
        {step === 3 ? (
          <div className="flex flex-col gap-4">
            <div>
              {fieldLabel('Gas Safe registration number')}
              <Input
                value={gasSafeNumber}
                onChange={(event) => setGasSafeNumber(event.target.value)}
                className="mt-1.5"
                disabled={isPending}
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]{6}"
                placeholder="123456"
              />
              <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">6 digits</p>
            </div>
            <div>
              {fieldLabel('Engineer ID card number')}
              <Input
                value={engineerId}
                onChange={(event) => setEngineerId(event.target.value)}
                className="mt-1.5"
                disabled={isPending}
                inputMode="numeric"
                maxLength={7}
                pattern="[0-9]{7}"
                placeholder="1234567"
              />
              <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">7 digits</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Navigation */}
      <div className="mt-4 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => setStep((current) => Math.max(current - 1, 1))}
          disabled={isPending || step === 1}
          className="flex h-11 flex-1 items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] text-[14px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-background-tertiary)] disabled:pointer-events-none disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => saveStep('later')}
          disabled={isPending}
          className="flex h-11 flex-1 items-center justify-center rounded-full text-[14px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-background-tertiary)]"
        >
          Save for later
        </button>
        <Button
          variant="primary"
          onClick={() => saveStep(step === steps.length ? 'finish' : 'next')}
          disabled={isPending}
          className="h-11 flex-[2]"
        >
          {isPending ? 'Saving…' : step === steps.length ? 'Finish setup' : 'Save and continue'}
        </Button>
      </div>
    </div>
  );
}
