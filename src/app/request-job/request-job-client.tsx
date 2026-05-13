'use client';

import { useDeferredValue, useEffect, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
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

const composeAddress = (...parts: Array<string | null | undefined>) =>
  parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(', ');

export function RequestJobClient({ scopedEngineer = null }: { scopedEngineer?: ScopedRequestEngineer | null }) {
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [isAddressLookupPending, setIsAddressLookupPending] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressLookupSuggestion[]>([]);
  const [selectedAddressMatchId, setSelectedAddressMatchId] = useState<string | null>(null);
  const [addressSearchError, setAddressSearchError] = useState<string | null>(null);
  const [propertyReference, setPropertyReference] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [landlordAddressLine1, setLandlordAddressLine1] = useState('');
  const [landlordAddressLine2, setLandlordAddressLine2] = useState('');
  const [landlordCity, setLandlordCity] = useState('');
  const [landlordPostcode, setLandlordPostcode] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [engineerShareUrl, setEngineerShareUrl] = useState<string | null>(null);
  const [engineerShareText, setEngineerShareText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  const copyLandlordAddressToJobAddress = () => {
    setAddressLine1(landlordAddressLine1);
    setAddressLine2(landlordAddressLine2);
    setCity(landlordCity);
    setPostcode(landlordPostcode);
    setAddressSearchError(null);
    setSelectedAddressMatchId(null);
    setAddressSuggestions([]);
  };

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setError(null);
        setMessage(null);
        setEngineerShareUrl(null);
        setEngineerShareText(null);
        startSubmitTransition(async () => {
          try {
            const propertyAddress = composeAddress(propertyReference, addressLine1, addressLine2, city, postcode);
            const result = await submitStandaloneLandlordJobRequest({
              landlordName: String(form.get('landlordName') ?? ''),
              landlordEmail: String(form.get('landlordEmail') ?? ''),
              landlordPhone: String(form.get('landlordPhone') ?? ''),
              landlordAddressLine1,
              landlordAddressLine2,
              landlordCity,
              landlordPostcode,
              propertyAddress,
              propertyPostcode: postcode,
              jobType: String(form.get('jobType') ?? 'cp12') as 'cp12' | 'service' | 'both' | 'other',
              tenantName: '',
              tenantPhone: String(form.get('sitePhone') ?? ''),
              accessNotes: '',
              preferredDates: preferredDate,
              engineerName: scopedEngineer
                ? scopedEngineer.engineerName ?? scopedEngineer.companyName ?? 'Selected engineer'
                : String(form.get('engineerName') ?? ''),
              engineerEmail: scopedEngineer?.email ?? String(form.get('engineerEmail') ?? ''),
              engineerPhone: scopedEngineer?.phone ?? String(form.get('engineerPhone') ?? ''),
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
      }}
    >
      <div className="rounded-3xl bg-white/70 p-4">
        <p className="text-sm font-semibold">Your details</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input name="landlordName" required placeholder="Your name" className="rounded-2xl bg-white" />
          <Input name="landlordCompany" placeholder="Company (optional)" className="rounded-2xl bg-white" />
          <Input name="landlordEmail" required type="email" placeholder="Email address" className="rounded-2xl bg-white" />
          <Input name="landlordPhone" required type="tel" placeholder="Phone number" className="rounded-2xl bg-white" />
          <Input
            value={landlordAddressLine1}
            onChange={(event) => setLandlordAddressLine1(event.target.value)}
            placeholder="Address line 1"
            className="rounded-2xl bg-white sm:col-span-2"
          />
          <Input
            value={landlordAddressLine2}
            onChange={(event) => setLandlordAddressLine2(event.target.value)}
            placeholder="Address line 2"
            className="rounded-2xl bg-white sm:col-span-2"
          />
          <Input
            value={landlordCity}
            onChange={(event) => setLandlordCity(event.target.value)}
            placeholder="City"
            className="rounded-2xl bg-white"
          />
          <Input
            value={landlordPostcode}
            onChange={(event) => setLandlordPostcode(event.target.value)}
            placeholder="Postcode"
            className="rounded-2xl bg-white"
          />
        </div>
      </div>

      <div className="rounded-3xl bg-white/70 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold">Property details</p>
          <Button
            type="button"
            variant="outline"
            className="rounded-full text-xs"
            onClick={copyLandlordAddressToJobAddress}
            disabled={!landlordAddressLine1 && !landlordCity && !landlordPostcode}
          >
            Same as landlord address
          </Button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input
            value={propertyReference}
            onChange={(event) => setPropertyReference(event.target.value)}
            placeholder="Property name / reference"
            className="rounded-2xl bg-white sm:col-span-2"
          />
          <div className="relative sm:col-span-2">
            <Input
              required
              value={addressLine1}
              onChange={(event) => {
                setAddressLine1(event.target.value);
                setAddressSearchError(null);
                setSelectedAddressMatchId(null);
              }}
              placeholder="Address line 1"
              className="rounded-2xl bg-white"
            />
            {isAddressLookupPending && !addressSuggestions.length ? (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
                Searching addresses…
              </div>
            ) : null}
            {addressSuggestions.length ? (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                <div className="max-h-72 overflow-y-auto p-2">
                  {addressSuggestions.map((suggestion) => {
                    const isSelected = selectedAddressMatchId === suggestion.id;
                    return (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => void handleAddressSelect(suggestion)}
                        className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                          isSelected ? 'bg-emerald-50 text-slate-950' : 'hover:bg-slate-50'
                        }`}
                      >
                        {suggestion.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {addressSearchError ? <p className="mt-2 text-xs text-red-700">{addressSearchError}</p> : null}
          </div>
          <Input value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} placeholder="Address line 2" className="rounded-2xl bg-white sm:col-span-2" />
          <Input required value={city} onChange={(event) => setCity(event.target.value)} placeholder="City" className="rounded-2xl bg-white" />
          <Input required value={postcode} onChange={(event) => setPostcode(event.target.value)} placeholder="Postcode" className="rounded-2xl bg-white" />
          <Input name="sitePhone" placeholder="Site telephone" className="rounded-2xl bg-white" />
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preferred date</label>
            <Input
              type="date"
              value={preferredDate}
              onChange={(event) => setPreferredDate(event.target.value)}
              className="mt-1 rounded-2xl bg-white"
            />
          </div>
          <Select name="jobType" defaultValue="cp12" className="rounded-2xl bg-white">
            <option value="cp12">Annual gas safety check</option>
            <option value="service">Boiler service</option>
            <option value="both">Gas safety check + boiler service</option>
            <option value="other">Other</option>
          </Select>
        </div>
      </div>

      <div className="rounded-3xl bg-white/70 p-4">
        <p className="text-sm font-semibold">{scopedEngineer ? 'Engineer' : 'Engineer you want to contact'}</p>
        {scopedEngineer ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-950">
              {scopedEngineer.companyName ?? scopedEngineer.engineerName ?? 'Your selected engineer'}
            </p>
            <p className="mt-1">
              {[scopedEngineer.engineerName, scopedEngineer.gasSafeNumber ? `Gas Safe ${scopedEngineer.gasSafeNumber}` : null]
                .filter(Boolean)
                .join(' / ')}
            </p>
            <p className="mt-1">{[scopedEngineer.email, scopedEngineer.phone].filter(Boolean).join(' / ')}</p>
          </div>
        ) : (
          <>
            <p className="mt-1 text-xs text-slate-600">
              Enter your engineer&apos;s email or phone and CertNow will send them the request.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Input name="engineerName" required placeholder="Engineer name" className="rounded-2xl bg-white" />
              <Input name="engineerEmail" type="email" placeholder="Engineer email" className="rounded-2xl bg-white" />
              <Input name="engineerPhone" type="tel" placeholder="Engineer phone" className="rounded-2xl bg-white" />
            </div>
          </>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting} className="rounded-full">
        {isSubmitting ? 'Submitting…' : 'Send job request'}
      </Button>
      {message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p> : null}
      {engineerShareUrl && engineerShareText ? (
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-950">Share with the engineer</p>
          <p className="mt-1">
            If you only have their mobile number, send this request link by WhatsApp so they can open or claim it.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="rounded-full">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(engineerShareText)}`}
                target="_blank"
                rel="noreferrer"
              >
                Share on WhatsApp
              </a>
            </Button>
            <Button asChild variant="secondary" className="rounded-full">
              <a href={engineerShareUrl} target="_blank" rel="noreferrer">
                Open request link
              </a>
            </Button>
          </div>
        </div>
      ) : null}
      {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
    </form>
  );
}
