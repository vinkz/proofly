'use client';

import { useDeferredValue, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import type { AddressLookupResult, AddressLookupSuggestion } from '@/lib/address-lookup';
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
};

const steps = [
  { id: 1, title: 'About you' },
  { id: 2, title: 'Business' },
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

  return (
    <div className="space-y-6 rounded-3xl border border-white/20 bg-white/80 p-6 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {steps.map((item) => {
          const active = item.id === step;
          return (
            <div
              key={item.id}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                active ? 'bg-[var(--accent)] text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {item.id}. {item.title}
            </div>
          );
        })}
      </div>

      {step === 1 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-semibold text-muted">
            Full name
            <Input value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-2" disabled={isPending} />
          </label>
          <label className="block text-sm font-semibold text-muted">
            Date of birth
            <Input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} className="mt-2" disabled={isPending} />
          </label>
          <label className="block text-sm font-semibold text-muted">
            Profession
            <Select
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
              className="mt-2"
              disabled={isPending}
            >
              <option value="">Select profession</option>
              {TRADE_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
              <option value="Other">Other</option>
            </Select>
          </label>
          {professionChoice === 'Other' ? (
            <label className="block text-sm font-semibold text-muted">
              Profession (manual)
              <Input value={profession} onChange={(event) => setProfession(event.target.value)} className="mt-2" disabled={isPending} />
            </label>
          ) : (
            <div />
          )}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-semibold text-muted">
            Company name
            <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="mt-2" disabled={isPending} />
          </label>
          <div />
          <div className="relative md:col-span-2">
            <label className="block text-sm font-semibold text-muted">
              Address line 1
              <Input
                value={companyAddressSearchQuery}
                onChange={(event) => {
                  const value = event.target.value;
                  setCompanyAddressSearchQuery(value);
                  setCompanyAddressLine1(value);
                  setCompanyAddressSearchError(null);
                  setSelectedCompanyAddressMatchId(null);
                }}
                className="mt-2"
                disabled={isPending}
                placeholder="Start typing address or postcode"
              />
            </label>
            {isCompanyAddressLookupPending && !companyAddressSuggestions.length ? (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-muted shadow-lg">
                Searching addresses…
              </div>
            ) : null}
            {companyAddressSuggestions.length ? (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-lg">
                <div className="max-h-72 overflow-y-auto p-2">
                  {companyAddressSuggestions.map((suggestion) => {
                    const isSelected = selectedCompanyAddressMatchId === suggestion.id;
                    return (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => void handleCompanyAddressMatchSelect(suggestion)}
                        className={`w-full rounded-xl px-3 py-2 text-left transition ${
                          isSelected
                            ? 'bg-[color:var(--action-soft)] text-muted'
                            : 'hover:bg-[color:var(--brand-soft)] text-muted'
                        }`}
                      >
                        <div className="text-sm font-medium">{suggestion.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {companyAddressSearchError ? (
              <p className="mt-2 text-xs text-red-600">{companyAddressSearchError}</p>
            ) : null}
          </div>
          <label className="block text-sm font-semibold text-muted md:col-span-2">
            Address line 2
            <Input value={companyAddressLine2} onChange={(event) => setCompanyAddressLine2(event.target.value)} className="mt-2" disabled={isPending} />
          </label>
          <label className="block text-sm font-semibold text-muted">
            Town / city
            <Input value={companyTown} onChange={(event) => setCompanyTown(event.target.value)} className="mt-2" disabled={isPending} />
          </label>
          <label className="block text-sm font-semibold text-muted">
            Postcode
            <Input value={companyPostcode} onChange={(event) => setCompanyPostcode(event.target.value)} className="mt-2" disabled={isPending} />
          </label>
          <label className="block text-sm font-semibold text-muted">
            Tel. No
            <Input value={companyPhone} onChange={(event) => setCompanyPhone(event.target.value)} className="mt-2" disabled={isPending} />
          </label>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-semibold text-muted md:col-span-2">
            Gas Safe number
            <Input value={gasSafeNumber} onChange={(event) => setGasSafeNumber(event.target.value)} className="mt-2" disabled={isPending} />
          </label>
          <label className="block text-sm font-semibold text-muted md:col-span-2">
            ID card number
            <Input value={engineerId} onChange={(event) => setEngineerId(event.target.value)} className="mt-2" disabled={isPending} />
          </label>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-between gap-3">
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep((current) => Math.max(current - 1, 1))} disabled={isPending || step === 1}>
            Back
          </Button>
          <Button variant="ghost" onClick={() => saveStep('later')} disabled={isPending}>
            Save and return later
          </Button>
        </div>

        <Button onClick={() => saveStep(step === steps.length ? 'finish' : 'next')} disabled={isPending}>
          {isPending ? 'Saving…' : step === steps.length ? 'Finish setup' : 'Save and continue'}
        </Button>
      </div>
    </div>
  );
}
