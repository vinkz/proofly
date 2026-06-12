'use client';

import { useDeferredValue, useEffect, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { submitStandaloneLandlordJobRequest } from '@/server/job-requests';
import type { AddressLookupSuggestion } from '@/lib/address-lookup';

export type ScopedRequestEngineer = {
  requestLinkSlug: string;
  engineerName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  gasSafeNumber: string | null;
};

type AddressLookupApiResponse = {
  suggestions?: AddressLookupSuggestion[];
  address?: {
    id: string;
    name: string;
    line1: string;
    line2: string;
    city: string;
    postcode: string;
    summary: string;
    label: string;
  };
  error?: string;
};

const ADDRESS_SEARCH_MIN_QUERY_LENGTH = 3;

const getAddressLookupErrorMessage = (error: unknown, fallback: string) => {
  if (
    error instanceof Error &&
    ['Address lookup disabled', 'Address lookup is disabled', 'Address lookup is not configured'].includes(error.message)
  ) {
    return null;
  }
  return error instanceof Error ? error.message : fallback;
};

// Public-facing form: never show the raw provider error (e.g. Ideal Postcodes 402) in red.
// Pass through benign guidance, collapse everything else to a calm "enter manually" hint.
const formatAddressError = (msg: string | null) => {
  if (!msg) return null;
  if (msg.startsWith('Type at least') || msg === 'No addresses found. Try a postcode or add more detail.') {
    return msg;
  }
  return 'Address lookup unavailable — enter manually';
};

const composeAddress = (...parts: Array<string | null | undefined>) =>
  parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(', ');

const JOB_TYPES = [
  { value: 'cp12' as const, label: 'Annual gas safety check' },
  { value: 'service' as const, label: 'Boiler service' },
  { value: 'both' as const, label: 'Gas safety + service' },
  { value: 'other' as const, label: 'Other' },
];

export function RequestJobClient({ scopedEngineer = null }: { scopedEngineer?: ScopedRequestEngineer | null }) {
  const totalSteps = 3;
  const [step, setStep] = useState(1);

  const [isSubmitting, startSubmitTransition] = useTransition();

  // Address autocomplete
  const [isAddressLookupPending, setIsAddressLookupPending] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressLookupSuggestion[]>([]);
  const [selectedAddressMatchId, setSelectedAddressMatchId] = useState<string | null>(null);
  const [addressSearchError, setAddressSearchError] = useState<string | null>(null);

  // Job address
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');

  // Landlord
  const [landlordName, setLandlordName] = useState('');
  const [landlordCompany, setLandlordCompany] = useState('');
  const [landlordEmail, setLandlordEmail] = useState('');
  const [landlordPhone, setLandlordPhone] = useState('');
  const [landlordAddressLine1, setLandlordAddressLine1] = useState('');
  const [landlordAddressLine2, setLandlordAddressLine2] = useState('');
  const [landlordCity, setLandlordCity] = useState('');
  const [landlordPostcode, setLandlordPostcode] = useState('');

  // Engineer (only when no scopedEngineer)
  const [engineerName, setEngineerName] = useState('');
  const [engineerEmail, setEngineerEmail] = useState('');
  const [engineerPhone, setEngineerPhone] = useState('');

  // Job details
  const [tenantName, setTenantName] = useState('');
  const [sitePhone, setSitePhone] = useState('');
  const [accessNotes, setAccessNotes] = useState('');
  const [jobType, setJobType] = useState<'cp12' | 'service' | 'both' | 'other'>('cp12');
  const [preferredDate, setPreferredDate] = useState('');

  // Result
  const [message, setMessage] = useState<string | null>(null);
  const [engineerShareUrl, setEngineerShareUrl] = useState<string | null>(null);
  const [engineerShareText, setEngineerShareText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  const deferredAddressSearchQuery = useDeferredValue(addressLine1.trim());

  useEffect(() => {
    if (!deferredAddressSearchQuery) {
      setAddressSuggestions([]);
      setSelectedAddressMatchId(null);
      setAddressSearchError(null);
      setIsAddressLookupPending(false);
      return;
    }

    if (deferredAddressSearchQuery.length < ADDRESS_SEARCH_MIN_QUERY_LENGTH) {
      setAddressSuggestions([]);
      setSelectedAddressMatchId(null);
      setAddressSearchError(`Type at least ${ADDRESS_SEARCH_MIN_QUERY_LENGTH} characters to search.`);
      setIsAddressLookupPending(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsAddressLookupPending(true);
      setAddressSearchError(null);
      try {
        const response = await fetch(`/api/address-search?q=${encodeURIComponent(deferredAddressSearchQuery)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as AddressLookupApiResponse;
        if (!response.ok) throw new Error(payload.error || 'Lookup failed');
        const suggestions = payload.suggestions ?? [];
        setAddressSuggestions(suggestions);
        setSelectedAddressMatchId(null);
        setAddressSearchError(suggestions.length ? null : 'No addresses found. Try a postcode or add more detail.');
      } catch (lookupError) {
        if (controller.signal.aborted) return;
        setAddressSuggestions([]);
        setSelectedAddressMatchId(null);
        setAddressSearchError(getAddressLookupErrorMessage(lookupError, 'Try another search.'));
      } finally {
        if (!controller.signal.aborted) setIsAddressLookupPending(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [deferredAddressSearchQuery]);

  const handleAddressSelect = async (suggestion: AddressLookupSuggestion) => {
    setIsAddressLookupPending(true);
    setSelectedAddressMatchId(suggestion.id);
    setAddressSearchError(null);
    try {
      const response = await fetch(`/api/address-search?id=${encodeURIComponent(suggestion.id)}`);
      const payload = (await response.json()) as AddressLookupApiResponse;
      if (!response.ok || !payload.address) throw new Error(payload.error || 'Lookup failed');
      const address = payload.address;
      setAddressLine1(address.line1 || suggestion.label);
      setAddressLine2(address.line2 || '');
      setCity(address.city || '');
      setPostcode(address.postcode || '');
      setAddressSuggestions([]);
    } catch (selectError) {
      setSelectedAddressMatchId(null);
      setAddressSearchError(selectError instanceof Error ? selectError.message : 'Try again.');
    } finally {
      setIsAddressLookupPending(false);
    }
  };

  const hasLandlordDetailsToCopy = Boolean(
    landlordName.trim() ||
    landlordPhone.trim() ||
    landlordAddressLine1.trim() ||
    landlordCity.trim() ||
    landlordPostcode.trim(),
  );

  const copyLandlordDetailsToProperty = () => {
    // Copy the landlord's ADDRESS to the property — do not touch the tenant name
    // (the tenant is a different person from the landlord/form-filler).
    if (landlordPhone.trim()) setSitePhone(landlordPhone);
    setAddressLine1(landlordAddressLine1);
    setAddressLine2(landlordAddressLine2);
    setCity(landlordCity);
    setPostcode(landlordPostcode);
    setAddressSearchError(null);
    setSelectedAddressMatchId(null);
    setAddressSuggestions([]);
  };

  const stepLabels = ['Engineer', 'Your details', 'Property'];

  const progressPct = Math.round((step / totalSteps) * 100);

  const validateCurrentStep = (): boolean => {
    if (!scopedEngineer && step === 1) {
      if (!engineerName.trim()) {
        setStepError('Engineer name is required.');
        return false;
      }
    }
    if (step === 2) {
      if (!landlordName.trim()) { setStepError('Your name is required.'); return false; }
      if (!landlordEmail.trim()) { setStepError('Email address is required.'); return false; }
      if (!landlordPhone.trim()) { setStepError('Phone number is required.'); return false; }
    }
    return true;
  };

  const handleNext = () => {
    setStepError(null);
    if (!validateCurrentStep()) return;
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setStepError(null);
    setStep((s) => s - 1);
  };

  const handleSubmit = () => {
    setStepError(null);
    if (!addressLine1.trim() || !city.trim() || !postcode.trim()) {
      setStepError('Address line 1, city, and postcode are required.');
      return;
    }
    setError(null);
    setMessage(null);
    setEngineerShareUrl(null);
    setEngineerShareText(null);
    startSubmitTransition(async () => {
      try {
        const propertyAddress = composeAddress(addressLine1, addressLine2, city, postcode);
        const result = await submitStandaloneLandlordJobRequest({
          landlordName,
          landlordEmail,
          landlordPhone,
          landlordAddressLine1,
          landlordAddressLine2,
          landlordCity,
          landlordPostcode,
          propertyAddress,
          propertyPostcode: postcode,
          jobType,
          tenantName,
          tenantPhone: sitePhone,
          accessNotes,
          preferredDates: preferredDate,
          engineerName: scopedEngineer
            ? scopedEngineer.engineerName ?? scopedEngineer.companyName ?? 'Selected engineer'
            : engineerName,
          engineerEmail: scopedEngineer?.email ?? engineerEmail,
          engineerPhone: scopedEngineer?.phone ?? engineerPhone,
          engineerGasSafeNumber: scopedEngineer?.gasSafeNumber ?? '',
          engineerRequestSlug: scopedEngineer?.requestLinkSlug ?? '',
        });
        const confirmation =
          result.landlordConfirmationStatus === 'sent'
            ? 'A confirmation email has been sent to you.'
            : 'Your request is saved; email delivery is not configured yet.';
        const engineerNotice =
          result.engineerNotificationStatus === 'sent'
            ? ' The engineer contact has also been emailed.'
            : result.engineerNotificationStatus === 'skipped_same_recipient'
              ? ' The engineer email was skipped because the landlord and engineer email are the same. The request is still on the engineer dashboard.'
            : result.engineerNotificationStatus === 'not_configured'
              ? ' The engineer email was not sent because email delivery is not configured or no engineer email was supplied.'
              : ' The engineer email could not be sent, but the request details were saved.';
        setMessage(`${confirmation}${engineerNotice}`);
        if (result.engineerActionUrl) {
          setEngineerShareUrl(result.engineerActionUrl);
          setEngineerShareText(
            `I sent you a CertNow job request for ${propertyAddress}. Open it here: ${result.engineerActionUrl}`,
          );
        }
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : 'Could not submit request.');
      }
    });
  };

  if (message) {
    return (
      <div className="grid gap-3">
        <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-[18px] py-4">
          <p className="text-[15px] font-medium text-[var(--color-text-primary)]">Request sent</p>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">{message}</p>
        </div>
        {engineerShareUrl && engineerShareText ? (
          <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-[18px] py-4">
            <p className="text-[15px] font-medium text-[var(--color-text-primary)]">Share with the engineer</p>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
              If you only have their mobile number, send this request link by WhatsApp so they can open or claim it.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="action">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(engineerShareText)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Share on WhatsApp
                </a>
              </Button>
              <Button asChild variant="secondary">
                <a href={engineerShareUrl} target="_blank" rel="noreferrer">
                  Open request link
                </a>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {/* Progress bar */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-border-tertiary)]">
        <div
          className="h-full rounded-full bg-[var(--color-action)] transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Step label */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
          {stepLabels[step - 1]}
        </p>
        <p className="text-[13px] text-[var(--color-text-tertiary)]">
          Step {step} of {totalSteps}
        </p>
      </div>

      {/* Step 1: Engineer details */}
      {step === 1 ? (
        <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-[18px] py-4">
          {scopedEngineer ? (
            <div className="flex items-center gap-3 rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3">
              <span className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full bg-[#edf7f2] text-[14px] font-semibold text-[#1a7a52]">
                {(scopedEngineer.companyName ?? scopedEngineer.engineerName ?? 'E')
                  .trim()
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((word) => word[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || 'E'}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                  {scopedEngineer.companyName ?? scopedEngineer.engineerName ?? 'Your selected engineer'}
                </p>
                {[
                  scopedEngineer.engineerName,
                  scopedEngineer.gasSafeNumber ? `Gas Safe ${scopedEngineer.gasSafeNumber}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') ? (
                  <p className="mt-0.5 text-[12px] text-[var(--color-text-secondary)]">
                    {[
                      scopedEngineer.engineerName,
                      scopedEngineer.gasSafeNumber ? `Gas Safe ${scopedEngineer.gasSafeNumber}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                ) : null}
                {[scopedEngineer.email, scopedEngineer.phone].filter(Boolean).join(' · ') ? (
                  <p className="mt-0.5 text-[12px] text-[var(--color-text-tertiary)]">
                    {[scopedEngineer.email, scopedEngineer.phone].filter(Boolean).join(' · ')}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <p className="mb-4 text-[13px] text-[var(--color-text-secondary)]">
                Enter your engineer&apos;s details. CertNow will send them this job request.
              </p>
              <div className="grid gap-3">
                <Input
                  value={engineerName}
                  onChange={(e) => setEngineerName(e.target.value)}
                  placeholder="Engineer name"
                />
                <Input
                  type="email"
                  value={engineerEmail}
                  onChange={(e) => setEngineerEmail(e.target.value)}
                  placeholder="Engineer email"
                />
                <Input
                  type="tel"
                  value={engineerPhone}
                  onChange={(e) => setEngineerPhone(e.target.value)}
                  placeholder="Engineer phone"
                />
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* Step 2: Landlord details */}
      {step === 2 ? (
        <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-[18px] py-4">
          <div className="grid gap-3">
            <Input
              autoComplete="name"
              value={landlordName}
              onChange={(e) => setLandlordName(e.target.value)}
              placeholder="Your name"
            />
            <Input
              autoComplete="organization"
              value={landlordCompany}
              onChange={(e) => setLandlordCompany(e.target.value)}
              placeholder="Company (optional)"
            />
            <Input
              type="email"
              autoComplete="email"
              value={landlordEmail}
              onChange={(e) => setLandlordEmail(e.target.value)}
              placeholder="Email address"
            />
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={landlordPhone}
              onChange={(e) => setLandlordPhone(e.target.value)}
              placeholder="Phone number"
            />
            <Input
              autoComplete="address-line1"
              value={landlordAddressLine1}
              onChange={(e) => setLandlordAddressLine1(e.target.value)}
              placeholder="Your address line 1"
            />
            <Input
              autoComplete="address-line2"
              value={landlordAddressLine2}
              onChange={(e) => setLandlordAddressLine2(e.target.value)}
              placeholder="Your address line 2"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                autoComplete="address-level2"
                value={landlordCity}
                onChange={(e) => setLandlordCity(e.target.value)}
                placeholder="City"
              />
              <Input
                autoComplete="postal-code"
                value={landlordPostcode}
                onChange={(e) => setLandlordPostcode(e.target.value)}
                placeholder="Postcode"
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Step 3: Property + job address details */}
      {step === 3 ? (
        <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-[18px] py-4">
          <div className="grid gap-3">
            <div className="flex flex-col gap-3 rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Property same as your details?</p>
                <p className="mt-0.5 text-[12px] text-[var(--color-text-secondary)]">
                  Copy your name, phone and address from Step 2.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={copyLandlordDetailsToProperty}
                disabled={!hasLandlordDetailsToCopy}
                className="shrink-0"
              >
                Copy details
              </Button>
            </div>
            <Input
              autoComplete="off"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="Tenant name"
            />
            {/* Address autocomplete */}
            <div className="relative">
              <Input
                autoComplete="off"
                value={addressLine1}
                onChange={(e) => {
                  setAddressLine1(e.target.value);
                  setAddressSearchError(null);
                  setSelectedAddressMatchId(null);
                }}
                placeholder="Address line 1"
              />
              {isAddressLookupPending && !addressSuggestions.length ? (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-[13px] text-[var(--color-text-secondary)] shadow-sm">
                  Searching addresses…
                </div>
              ) : null}
              {addressSuggestions.length ? (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-sm">
                  <div className="max-h-60 overflow-y-auto p-1.5">
                    {addressSuggestions.map((suggestion) => {
                      const isSelected = selectedAddressMatchId === suggestion.id;
                      return (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => void handleAddressSelect(suggestion)}
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
              {addressSearchError ? (
                <p className="mt-1.5 text-[12px] text-[var(--color-text-tertiary)]">{formatAddressError(addressSearchError)}</p>
              ) : null}
            </div>
            <Input
              autoComplete="off"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="Address line 2"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                autoComplete="off"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
              />
              <Input
                autoComplete="off"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                placeholder="Postcode"
              />
            </div>
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={sitePhone}
              onChange={(e) => setSitePhone(e.target.value)}
              placeholder="Tenant / site phone"
            />
            <Input
              value={accessNotes}
              onChange={(e) => setAccessNotes(e.target.value)}
              placeholder="Access notes (optional)"
            />
            {/* Job type chip group */}
            <div className="grid grid-cols-2 gap-2">
              {JOB_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setJobType(type.value)}
                  className={`rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${
                    jobType === type.value
                      ? 'bg-[var(--color-action)] text-white'
                      : 'border-[0.5px] border-[var(--color-border-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-background-tertiary)]'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[var(--color-text-tertiary)]">
                Preferred date
              </label>
              <Input
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
        </div>
      ) : null}

      {stepError ? (
        <p className="rounded-[10px] bg-[var(--color-red-bg)] px-4 py-3 text-[13px] text-[var(--color-red)]">
          {stepError}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-[10px] bg-[var(--color-red-bg)] px-4 py-3 text-[13px] text-[var(--color-red)]">
          {error}
        </p>
      ) : null}

      {/* Navigation */}
      <div className="flex items-center gap-3">
        {step > 1 ? (
          <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
            Back
          </Button>
        ) : null}
        {step < totalSteps ? (
          <Button type="button" variant="action" onClick={handleNext} className="flex-1">
            Continue
          </Button>
        ) : (
          <Button type="button" variant="action" onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
            {isSubmitting ? 'Sending…' : 'Send job request'}
          </Button>
        )}
      </div>
    </div>
  );
}
