'use client';

import { useDeferredValue, useEffect, useMemo, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { createSoloJob, requestLandlordJobPrefill } from '@/server/jobs';
import type { JobRequestPrefill } from '@/server/job-requests';
import type { ClientListItem } from '@/types/client';
import { JOB_TYPE_LABELS, type JobType } from '@/types/job-records';
import type { AddressLookupSuggestion } from '@/lib/address-lookup';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { RequestLandlordDetailsCard } from '@/components/jobs/request-landlord-details-card';
import { buildWizardDraftStorageKey, useWizardDraft } from '@/hooks/use-wizard-draft';

export type SavedPropertyOption = {
  key: string;
  label: string;
  job_address_name: string;
  job_address_line1: string;
  job_address_line2: string;
  job_address_city: string;
  job_postcode: string;
  job_tel: string;
  landlord_name: string;
  landlord_company: string;
  landlord_address_line1: string;
  landlord_address_line2: string;
  landlord_city: string;
  landlord_postcode: string;
  landlord_tel: string;
  landlord_email: string;
};

type SoloJobFormProps = {
  clients: ClientListItem[];
  propertiesByClientId: Record<string, SavedPropertyOption[]>;
  initialRequest?: JobRequestPrefill | null;
  requestUrl?: string | null;
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

type SoloJobDraftState = {
  clientMode: 'existing' | 'new';
  selectedClientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  selectedPropertyKey: string;
  propertyName: string;
  addressLine1: string;
  city: string;
  postcode: string;
  sitePhone: string;
  scheduledFor: string;
  jobType: JobType;
  inspectionDate: string;
  jobAddressName: string;
  jobAddressLine1: string;
  jobAddressLine2: string;
  jobAddressCity: string;
  jobAddressPostcode: string;
  jobAddressTel: string;
  landlordName: string;
  landlordCompany: string;
  landlordAddressLine1: string;
  landlordAddressLine2: string;
  landlordCity: string;
  landlordPostcode: string;
  landlordTel: string;
};

const ADDRESS_SEARCH_MIN_QUERY_LENGTH = 3;
const DEMO_AUTOFILL_VISIBLE = process.env.NEXT_PUBLIC_SHOW_DEMO_AUTOFILL === 'true';

const WIZARD_ROUTE_BY_JOB_TYPE: Record<JobType, string> = {
  safety_check: 'cp12',
  service: 'boiler_service',
  breakdown: 'breakdown',
  installation: 'commissioning',
  warning_notice: 'gas_warning_notice',
  general: 'general_works',
};

const LAUNCH_VISIBLE_JOB_TYPES: readonly JobType[] = ['safety_check', 'service'];

const splitAddressParts = (value: string | null | undefined) =>
  String(value ?? '')
    .split(/[\r\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

const parseRequestAddress = (address: string | null | undefined, postcode: string | null | undefined) => {
  const parts = splitAddressParts(address);
  const normalizedPostcode = String(postcode ?? '').trim();
  const withoutPostcode = normalizedPostcode
    ? parts.filter((part) => part.toLowerCase() !== normalizedPostcode.toLowerCase())
    : parts;
  return {
    line1: withoutPostcode[0] ?? '',
    line2: withoutPostcode.length > 2 ? withoutPostcode.slice(1, -1).join(', ') : '',
    city: withoutPostcode.length > 1 ? withoutPostcode.at(-1) ?? '' : '',
    postcode: normalizedPostcode || parts.at(-1) || '',
  };
};

const firstDateFromPreferredDates = (value: string | null | undefined) => {
  const match = String(value ?? '').match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? '';
};

const getAddressLookupErrorMessage = (error: unknown, fallback: string) => {
  if (
    error instanceof Error &&
    ['Address lookup disabled', 'Address lookup is disabled', 'Address lookup is not configured'].includes(error.message)
  ) {
    return null;
  }

  return error instanceof Error ? error.message : fallback;
};

const JOB_DEMO_VALUES: Record<
  JobType,
  {
    jobAddressName: string;
    jobAddressLine1: string;
    jobAddressLine2: string;
    jobAddressCity: string;
    jobAddressPostcode: string;
    jobAddressTel: string;
    partyName: string;
    partyCompany: string;
    partyAddressLine1: string;
    partyAddressLine2: string;
    partyCity: string;
    partyPostcode: string;
    partyTel: string;
  }
> = {
  safety_check: {
    jobAddressName: 'Flat 2 - Tenant entrance',
    jobAddressLine1: '42 Station Road',
    jobAddressLine2: 'Rear access gate',
    jobAddressCity: 'London',
    jobAddressPostcode: 'E2 2AA',
    jobAddressTel: '020 7000 0000',
    partyName: 'Sam Patel',
    partyCompany: 'Patel Properties',
    partyAddressLine1: '7 Owner Road',
    partyAddressLine2: 'Office 3',
    partyCity: 'London',
    partyPostcode: 'N1 1AA',
    partyTel: '07700 900123',
  },
  service: {
    jobAddressName: 'Boiler room',
    jobAddressLine1: '55 Station Road',
    jobAddressLine2: 'Rear entrance',
    jobAddressCity: 'London',
    jobAddressPostcode: 'E2 2AA',
    jobAddressTel: '020 7000 0000',
    partyName: 'Jordan Smith',
    partyCompany: 'Smith Lettings',
    partyAddressLine1: '9 Office Park',
    partyAddressLine2: 'Floor 2',
    partyCity: 'London',
    partyPostcode: 'SE1 2BB',
    partyTel: '07700 900456',
  },
  breakdown: {
    jobAddressName: 'Ground-floor flat',
    jobAddressLine1: '18 Market Street',
    jobAddressLine2: 'Basement entry',
    jobAddressCity: 'Bristol',
    jobAddressPostcode: 'BS1 4DJ',
    jobAddressTel: '0117 400 1200',
    partyName: 'Chris Turner',
    partyCompany: 'Turner Estates',
    partyAddressLine1: '4 Queen Square',
    partyAddressLine2: 'Suite 6',
    partyCity: 'Bristol',
    partyPostcode: 'BS1 4NT',
    partyTel: '07700 900789',
  },
  installation: {
    jobAddressName: 'New build plot 8',
    jobAddressLine1: '88 Orchard Way',
    jobAddressLine2: 'Site cabin opposite',
    jobAddressCity: 'Leeds',
    jobAddressPostcode: 'LS1 8QP',
    jobAddressTel: '0113 555 0144',
    partyName: 'Maya Khan',
    partyCompany: 'North Build Homes',
    partyAddressLine1: '22 Commerce Park',
    partyAddressLine2: 'Block B',
    partyCity: 'Leeds',
    partyPostcode: 'LS12 3AB',
    partyTel: '07700 900222',
  },
  warning_notice: {
    jobAddressName: 'Ground floor meter cupboard',
    jobAddressLine1: '27 Example Terrace',
    jobAddressLine2: 'Rear access via alley',
    jobAddressCity: 'Liverpool',
    jobAddressPostcode: 'L1 4AB',
    jobAddressTel: '0151 555 0101',
    partyName: 'Taylor Evans',
    partyCompany: 'Evans Property Group',
    partyAddressLine1: '18 Market Lane',
    partyAddressLine2: 'Unit 5',
    partyCity: 'Liverpool',
    partyPostcode: 'L2 8CD',
    partyTel: '07700 900654',
  },
  general: {
    jobAddressName: 'Shop unit rear plant',
    jobAddressLine1: '101 High Street',
    jobAddressLine2: 'Rear delivery yard',
    jobAddressCity: 'Manchester',
    jobAddressPostcode: 'M1 2WX',
    jobAddressTel: '0161 555 0188',
    partyName: 'Ava Hughes',
    partyCompany: 'High Street Retail Ltd',
    partyAddressLine1: '12 King Street',
    partyAddressLine2: 'Suite 4',
    partyCity: 'Manchester',
    partyPostcode: 'M2 6AG',
    partyTel: '07700 900333',
  },
};

export function SoloJobForm({ clients, propertiesByClientId, initialRequest = null, requestUrl = null }: SoloJobFormProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const draftStorageKey = useMemo(() => buildWizardDraftStorageKey('jobs_new', 'create'), []);
  const requestAddress = parseRequestAddress(initialRequest?.propertyAddress, initialRequest?.propertyPostcode);
  const requestPreferredDate = firstDateFromPreferredDates(initialRequest?.preferredDates);
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('new');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientName, setClientName] = useState(initialRequest?.landlordName ?? '');
  const [clientPhone, setClientPhone] = useState(initialRequest?.landlordPhone ?? '');
  const [clientEmail, setClientEmail] = useState(initialRequest?.landlordEmail ?? '');
  const [selectedPropertyKey, setSelectedPropertyKey] = useState('');
  const [propertyName, setPropertyName] = useState(initialRequest ? 'Landlord request' : '');
  const [addressLine1, setAddressLine1] = useState(requestAddress.line1);
  const [city, setCity] = useState(requestAddress.city);
  const [postcode, setPostcode] = useState(requestAddress.postcode);
  const [sitePhone, setSitePhone] = useState(initialRequest?.tenantPhone ?? initialRequest?.landlordPhone ?? '');
  const [scheduledFor, setScheduledFor] = useState(requestPreferredDate ? `${requestPreferredDate}T09:00` : '');
  const [jobType, setJobType] = useState<JobType>(initialRequest?.jobType === 'service' ? 'service' : 'safety_check');
  const [inspectionDate, setInspectionDate] = useState(requestPreferredDate);
  const [jobAddressName, setJobAddressName] = useState(initialRequest ? 'Landlord request' : '');
  const [jobAddressLine1, setJobAddressLine1] = useState(requestAddress.line1);
  const [jobAddressLine2, setJobAddressLine2] = useState(requestAddress.line2);
  const [jobAddressCity, setJobAddressCity] = useState(requestAddress.city);
  const [jobAddressPostcode, setJobAddressPostcode] = useState(requestAddress.postcode);
  const [jobAddressTel, setJobAddressTel] = useState(initialRequest?.tenantPhone ?? initialRequest?.landlordPhone ?? '');
  const [landlordName, setLandlordName] = useState(initialRequest?.landlordName ?? '');
  const [landlordCompany, setLandlordCompany] = useState('');
  const [landlordAddressLine1, setLandlordAddressLine1] = useState(initialRequest?.landlordAddressLine1 ?? '');
  const [landlordAddressLine2, setLandlordAddressLine2] = useState(initialRequest?.landlordAddressLine2 ?? '');
  const [landlordCity, setLandlordCity] = useState(initialRequest?.landlordCity ?? '');
  const [landlordPostcode, setLandlordPostcode] = useState(initialRequest?.landlordPostcode ?? '');
  const [landlordTel, setLandlordTel] = useState(initialRequest?.landlordPhone ?? '');
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(initialRequest ? 4 : 1);
  const [path, setPath] = useState<'self' | 'landlord' | null>(initialRequest ? 'self' : null);
  const [submitMode, setSubmitMode] = useState<'return' | 'continue'>('return');
  const [landlordRequestMessage, setLandlordRequestMessage] = useState<string | null>(null);
  const [landlordRequestError, setLandlordRequestError] = useState<string | null>(null);
  const [isJobAddressLookupPending, setIsJobAddressLookupPending] = useState(false);
  const [jobAddressSuggestions, setJobAddressSuggestions] = useState<AddressLookupSuggestion[]>([]);
  const [selectedJobAddressMatchId, setSelectedJobAddressMatchId] = useState<string | null>(null);
  const [jobAddressSearchError, setJobAddressSearchError] = useState<string | null>(null);
  const [isPartyAddressLookupPending, setIsPartyAddressLookupPending] = useState(false);
  const [partyAddressSuggestions, setPartyAddressSuggestions] = useState<AddressLookupSuggestion[]>([]);
  const [selectedPartyAddressMatchId, setSelectedPartyAddressMatchId] = useState<string | null>(null);
  const [partyAddressSearchError, setPartyAddressSearchError] = useState<string | null>(null);
  const [clientChosen, setClientChosen] = useState(() => !clients.length || !!initialRequest);
  const [propertyChosen, setPropertyChosen] = useState(() => !!initialRequest);
  const isCp12Upcoming = jobType === 'safety_check';
  const demoEnabled = DEMO_AUTOFILL_VISIBLE;
  const scheduleFieldLabel = isCp12Upcoming ? 'Inspection date' : 'Scheduled date and time';
  const partyCardTitle = isCp12Upcoming ? 'Landlord / Property owner' : 'Client';
  const partyNameValue = isCp12Upcoming ? landlordName : clientName;
  const deferredJobAddressSearchQuery = useDeferredValue(jobAddressLine1.trim());
  const deferredPartyAddressSearchQuery = useDeferredValue(landlordAddressLine1.trim());

  const availableProperties = useMemo(
    () => (selectedClientId ? propertiesByClientId[selectedClientId] ?? [] : []),
    [propertiesByClientId, selectedClientId],
  );
  const propertySuggestions = useMemo(
    () =>
      availableProperties.map((property) => ({
        key: property.key,
        value: property.job_address_name.trim() || property.job_address_line1.trim(),
        label: property.label,
      })),
    [availableProperties],
  );

  const canShowContinue = clientChosen && propertyChosen;

  const goBack = () => {
    if (step === 5) {
      setStep(4);
      return;
    }
    if (step === 4) {
      setPath(null);
      setStep(3);
      return;
    }
    if (step === 3 && path) {
      setPath(null);
      return;
    }
    if (step === 3) {
      setStep(2);
      return;
    }
    setStep(1);
  };

  const formatAddressError = (msg: string | null) => {
    if (!msg) return null;
    if (
      msg.startsWith(`Type at least`) ||
      msg === 'No addresses found. Try a postcode or add more detail.'
    ) {
      return msg;
    }
    return 'Address lookup unavailable — enter manually';
  };

  useEffect(() => {
    if (!clients.length) {
      setClientMode('new');
      setClientChosen(true);
      setPropertyChosen(true);
    }
  }, [clients.length]);

  useEffect(() => {
    if (selectedClientId) setClientChosen(true);
  }, [selectedClientId]);

  useEffect(() => {
    if (selectedPropertyKey) setPropertyChosen(true);
  }, [selectedPropertyKey]);

  useEffect(() => {
    if (!selectedClientId) return;
    if (availableProperties.length === 0) {
      setPropertyChosen(true);
    } else if (!selectedPropertyKey) {
      setPropertyChosen(false);
    }
  }, [selectedClientId, availableProperties.length, selectedPropertyKey]);

  useEffect(() => {
    if (!initialRequest) return;
    const address = parseRequestAddress(initialRequest.propertyAddress, initialRequest.propertyPostcode);
    const preferredDate = firstDateFromPreferredDates(initialRequest.preferredDates);
    const siteContact = initialRequest.tenantPhone || initialRequest.landlordPhone;

    setClientMode('new');
    setSelectedClientId('');
    setSelectedPropertyKey('');
    setClientName(initialRequest.landlordName);
    setClientPhone(initialRequest.landlordPhone);
    setClientEmail(initialRequest.landlordEmail);
    setPropertyName('Landlord request');
    setAddressLine1(address.line1);
    setCity(address.city);
    setPostcode(address.postcode);
    setSitePhone(siteContact);
    setScheduledFor(preferredDate ? `${preferredDate}T09:00` : '');
    setInspectionDate(preferredDate);
    setJobType(initialRequest.jobType === 'service' ? 'service' : 'safety_check');
    setJobAddressName('Landlord request');
    setJobAddressLine1(address.line1);
    setJobAddressLine2(address.line2);
    setJobAddressCity(address.city);
    setJobAddressPostcode(address.postcode);
    setJobAddressTel(siteContact);
    setLandlordName(initialRequest.landlordName);
    setLandlordCompany('');
    setLandlordAddressLine1(initialRequest.landlordAddressLine1);
    setLandlordAddressLine2(initialRequest.landlordAddressLine2);
    setLandlordCity(initialRequest.landlordCity);
    setLandlordPostcode(initialRequest.landlordPostcode);
    setLandlordTel(initialRequest.landlordPhone);
  }, [initialRequest]);

  const soloJobDraft = useMemo<SoloJobDraftState>(
    () => ({
      clientMode,
      selectedClientId,
      clientName,
      clientPhone,
      clientEmail,
      selectedPropertyKey,
      propertyName,
      addressLine1,
      city,
      postcode,
      sitePhone,
      scheduledFor,
      jobType,
      inspectionDate,
      jobAddressName,
      jobAddressLine1,
      jobAddressLine2,
      jobAddressCity,
      jobAddressPostcode,
      jobAddressTel,
      landlordName,
      landlordCompany,
      landlordAddressLine1,
      landlordAddressLine2,
      landlordCity,
      landlordPostcode,
      landlordTel,
    }),
    [
      addressLine1,
      city,
      clientEmail,
      clientMode,
      clientName,
      clientPhone,
      inspectionDate,
      jobAddressCity,
      jobAddressLine1,
      jobAddressLine2,
      jobAddressName,
      jobAddressPostcode,
      jobAddressTel,
      jobType,
      landlordAddressLine1,
      landlordAddressLine2,
      landlordCity,
      landlordCompany,
      landlordName,
      landlordPostcode,
      landlordTel,
      postcode,
      propertyName,
      scheduledFor,
      selectedClientId,
      selectedPropertyKey,
      sitePhone,
    ],
  );

  const { clearDraft } = useWizardDraft<SoloJobDraftState>({
    storageKey: draftStorageKey,
    state: soloJobDraft,
    enabled: !initialRequest,
    onRestore: (draft) => {
      setClientMode(draft.clientMode ?? 'new');
      setSelectedClientId(draft.selectedClientId ?? '');
      setClientName(draft.clientName ?? '');
      setClientPhone(draft.clientPhone ?? '');
      setClientEmail(draft.clientEmail ?? '');
      setSelectedPropertyKey(draft.selectedPropertyKey ?? '');
      setPropertyName(draft.propertyName ?? '');
      setAddressLine1(draft.addressLine1 ?? '');
      setCity(draft.city ?? '');
      setPostcode(draft.postcode ?? '');
      setSitePhone(draft.sitePhone ?? '');
      setScheduledFor(draft.scheduledFor ?? '');
      setJobType(draft.jobType ?? 'safety_check');
      setInspectionDate(draft.inspectionDate ?? '');
      setJobAddressName(draft.jobAddressName ?? '');
      setJobAddressLine1(draft.jobAddressLine1 ?? '');
      setJobAddressLine2(draft.jobAddressLine2 ?? '');
      setJobAddressCity(draft.jobAddressCity ?? '');
      setJobAddressPostcode(draft.jobAddressPostcode ?? '');
      setJobAddressTel(draft.jobAddressTel ?? '');
      setLandlordName(draft.landlordName ?? '');
      setLandlordCompany(draft.landlordCompany ?? '');
      setLandlordAddressLine1(draft.landlordAddressLine1 ?? '');
      setLandlordAddressLine2(draft.landlordAddressLine2 ?? '');
      setLandlordCity(draft.landlordCity ?? '');
      setLandlordPostcode(draft.landlordPostcode ?? '');
      setLandlordTel(draft.landlordTel ?? '');
      if (draft.selectedClientId || draft.clientMode === 'new') setClientChosen(true);
    },
  });

  useEffect(() => {
    if (!selectedClientId || availableProperties.length === 0) {
      setSelectedPropertyKey('');
      return;
    }
    if (selectedPropertyKey && !availableProperties.some((property) => property.key === selectedPropertyKey)) {
      setSelectedPropertyKey(availableProperties[0]?.key ?? '');
    }
  }, [availableProperties, selectedClientId, selectedPropertyKey]);

  useEffect(() => {
    const selectedProperty = availableProperties.find((property) => property.key === selectedPropertyKey);
    if (!selectedProperty) return;
    const nextPropertyName = selectedProperty.job_address_name || selectedProperty.job_address_line1;
    setJobAddressName(nextPropertyName);
    setJobAddressLine1(selectedProperty.job_address_line1);
    setJobAddressLine2(selectedProperty.job_address_line2);
    setJobAddressCity(selectedProperty.job_address_city);
    setJobAddressPostcode(selectedProperty.job_postcode);
    setJobAddressTel(selectedProperty.job_tel);
    setPropertyName(nextPropertyName);
    setAddressLine1(selectedProperty.job_address_line1);
    setCity(selectedProperty.job_address_city);
    setPostcode(selectedProperty.job_postcode);
    setSitePhone(selectedProperty.job_tel);
    if (selectedProperty.landlord_name) setLandlordName(selectedProperty.landlord_name);
    if (selectedProperty.landlord_company) setLandlordCompany(selectedProperty.landlord_company);
    if (selectedProperty.landlord_address_line1) setLandlordAddressLine1(selectedProperty.landlord_address_line1);
    if (selectedProperty.landlord_address_line2) setLandlordAddressLine2(selectedProperty.landlord_address_line2);
    if (selectedProperty.landlord_city) setLandlordCity(selectedProperty.landlord_city);
    if (selectedProperty.landlord_postcode) setLandlordPostcode(selectedProperty.landlord_postcode);
    if (selectedProperty.landlord_tel) setLandlordTel(selectedProperty.landlord_tel);
    if (selectedProperty.landlord_email) setClientEmail(selectedProperty.landlord_email);
    if (selectedProperty.landlord_tel) setClientPhone(selectedProperty.landlord_tel);
  }, [availableProperties, selectedPropertyKey]);

  useEffect(() => {
    const selectedClient = clients.find((client) => client.id === selectedClientId);
    if (!selectedClient) return;
    setClientMode('existing');
    setClientName(selectedClient.name ?? '');
    setClientPhone(selectedClient.phone ?? '');
    setClientEmail(selectedClient.email ?? '');
    const counterpartyAddress = isCp12Upcoming
      ? selectedClient.landlord_address ?? selectedClient.address ?? ''
      : selectedClient.address ?? selectedClient.landlord_address ?? '';
    const addressParts = splitAddressParts(counterpartyAddress);
    const line1 = addressParts[0] ?? '';
    const line2 = addressParts.length > 2 ? addressParts.slice(1, -1).join(', ') : '';
    const city = addressParts.length > 1 ? addressParts.at(-1) ?? '' : '';

    setLandlordName(isCp12Upcoming ? selectedClient.landlord_name ?? selectedClient.name ?? '' : selectedClient.name ?? '');
    setLandlordCompany(selectedClient.organization ?? '');
    setLandlordAddressLine1(line1);
    setLandlordAddressLine2(line2);
    setLandlordCity(city);
    setLandlordPostcode(selectedClient.postcode ?? '');
    setLandlordTel(selectedClient.phone ?? '');
  }, [clients, isCp12Upcoming, selectedClientId]);

  useEffect(() => {
    if (!scheduledFor || inspectionDate) return;
    setInspectionDate(scheduledFor.slice(0, 10));
  }, [inspectionDate, scheduledFor]);

  useEffect(() => {
    if (!isCp12Upcoming || !inspectionDate) return;
    setScheduledFor((current) => {
      const currentTime = current.includes('T') ? current.slice(11, 16) : '';
      const next = `${inspectionDate}T${currentTime || '09:00'}`;
      return current === next ? current : next;
    });
  }, [inspectionDate, isCp12Upcoming]);

  useEffect(() => {
    if (!deferredJobAddressSearchQuery) {
      setJobAddressSuggestions([]);
      setSelectedJobAddressMatchId(null);
      setJobAddressSearchError(null);
      setIsJobAddressLookupPending(false);
      return;
    }

    if (deferredJobAddressSearchQuery.length < ADDRESS_SEARCH_MIN_QUERY_LENGTH) {
      setJobAddressSuggestions([]);
      setSelectedJobAddressMatchId(null);
      setJobAddressSearchError(`Type at least ${ADDRESS_SEARCH_MIN_QUERY_LENGTH} characters to search.`);
      setIsJobAddressLookupPending(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsJobAddressLookupPending(true);
      setJobAddressSearchError(null);

      try {
        const query = encodeURIComponent(deferredJobAddressSearchQuery);
        const response = await fetch(`/api/address-search?q=${query}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        const payload = (await response.json()) as AddressLookupApiResponse;
        if (!response.ok) {
          throw new Error(payload.error || 'Lookup failed');
        }

        const suggestions = payload.suggestions ?? [];
        setJobAddressSuggestions(suggestions);
        setSelectedJobAddressMatchId(null);
        setJobAddressSearchError(suggestions.length ? null : 'No addresses found. Try a postcode or add more detail.');
      } catch (error) {
        if (controller.signal.aborted) return;
        setJobAddressSuggestions([]);
        setSelectedJobAddressMatchId(null);
        setJobAddressSearchError(getAddressLookupErrorMessage(error, 'Try another search.'));
      } finally {
        if (!controller.signal.aborted) {
          setIsJobAddressLookupPending(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [deferredJobAddressSearchQuery]);

  useEffect(() => {
    if (!deferredPartyAddressSearchQuery) {
      setPartyAddressSuggestions([]);
      setSelectedPartyAddressMatchId(null);
      setPartyAddressSearchError(null);
      setIsPartyAddressLookupPending(false);
      return;
    }

    if (deferredPartyAddressSearchQuery.length < ADDRESS_SEARCH_MIN_QUERY_LENGTH) {
      setPartyAddressSuggestions([]);
      setSelectedPartyAddressMatchId(null);
      setPartyAddressSearchError(`Type at least ${ADDRESS_SEARCH_MIN_QUERY_LENGTH} characters to search.`);
      setIsPartyAddressLookupPending(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsPartyAddressLookupPending(true);
      setPartyAddressSearchError(null);

      try {
        const query = encodeURIComponent(deferredPartyAddressSearchQuery);
        const response = await fetch(`/api/address-search?q=${query}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        const payload = (await response.json()) as AddressLookupApiResponse;
        if (!response.ok) {
          throw new Error(payload.error || 'Lookup failed');
        }

        const suggestions = payload.suggestions ?? [];
        setPartyAddressSuggestions(suggestions);
        setSelectedPartyAddressMatchId(null);
        setPartyAddressSearchError(suggestions.length ? null : 'No addresses found. Try a postcode or add more detail.');
      } catch (error) {
        if (controller.signal.aborted) return;
        setPartyAddressSuggestions([]);
        setSelectedPartyAddressMatchId(null);
        setPartyAddressSearchError(getAddressLookupErrorMessage(error, 'Try another search.'));
      } finally {
        if (!controller.signal.aborted) {
          setIsPartyAddressLookupPending(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [deferredPartyAddressSearchQuery]);

  const handleClientNameInput = (value: string) => {
    setClientName(value);
    const matchedClient = clients.find((client) => client.name === value);
    if (matchedClient) {
      setSelectedClientId(matchedClient.id);
      return;
    }
    setClientMode('new');
    setSelectedClientId('');
    setClientPhone('');
    setClientEmail('');
    setSelectedPropertyKey('');
  };

  const handleExistingClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedPropertyKey('');
    if (!clientId) {
      setClientMode('new');
      setClientChosen(false);
      setPropertyChosen(false);
      setClientName('');
      setClientPhone('');
      setClientEmail('');
      return;
    }

    setClientChosen(true);
    setPropertyChosen((propertiesByClientId[clientId] ?? []).length === 0);
  };

  const handleExistingPropertySelect = (propertyKey: string) => {
    if (!propertyKey) {
      setSelectedPropertyKey('');
      setPropertyChosen(false);
      return;
    }

    if (propertyKey === '__manual__') {
      setSelectedPropertyKey('');
      setPropertyChosen(true);
      return;
    }

    setSelectedPropertyKey(propertyKey);
    setPropertyChosen(true);
  };

  const handleRequestLandlordPrefill = () => {
    if (!selectedClientId) {
      setLandlordRequestError('Select a client first.');
      return;
    }
    if (!clientEmail.trim()) {
      setLandlordRequestError('Add a landlord email first.');
      return;
    }

    setLandlordRequestMessage(null);
    setLandlordRequestError(null);
    startTransition(async () => {
      try {
        await requestLandlordJobPrefill({
          clientId: selectedClientId,
          jobType,
          landlordEmail: clientEmail,
          scheduledFor: isCp12Upcoming && inspectionDate ? `${inspectionDate}T09:00` : scheduledFor,
        });
        setLandlordRequestMessage('Prefill request sent. The job is waiting on the landlord.');
      } catch (error) {
        setLandlordRequestError(error instanceof Error ? error.message : 'Could not send request.');
      }
    });
  };

  const handleLandlordNameInput = (value: string) => {
    setLandlordName(value);
  };

  const handleCp12PropertyReferenceInput = (value: string) => {
    setJobAddressName(value);
    setPropertyName(value);
  };

  const handlePropertyReferenceInput = (value: string) => {
    setPropertyName(value);
    setJobAddressName(value);
    const matchedProperty = propertySuggestions.find((property) => property.value === value);
    setSelectedPropertyKey(matchedProperty?.key ?? '');
  };

  const handleJobAddressMatchSelect = async (suggestion: AddressLookupSuggestion) => {
    setIsJobAddressLookupPending(true);
    setSelectedJobAddressMatchId(suggestion.id);
    setJobAddressSearchError(null);
    try {
      const response = await fetch(`/api/address-search?id=${encodeURIComponent(suggestion.id)}`, {
        headers: { Accept: 'application/json' },
      });
      const payload = (await response.json()) as AddressLookupApiResponse;
      if (!response.ok || !payload.address) {
        throw new Error(payload.error || 'Lookup failed');
      }
      const address = payload.address;
      setJobAddressName((current) => current.trim() || address.name);
      setPropertyName((current) => current.trim() || address.name);
      setJobAddressLine1(address.line1);
      setJobAddressLine2(address.line2);
      setJobAddressCity(address.city);
      setJobAddressPostcode(address.postcode || '');
      setAddressLine1(address.line1);
      setCity(address.city);
      setPostcode(address.postcode || '');
      setJobAddressSuggestions([]);
      pushToast({ title: 'Address selected', variant: 'success' });
    } catch (error) {
      setSelectedJobAddressMatchId(null);
      setJobAddressSearchError(error instanceof Error ? error.message : 'Try again.');
      pushToast({
        title: 'Address not found',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'error',
      });
    } finally {
      setIsJobAddressLookupPending(false);
    }
  };

  const handlePartyAddressMatchSelect = async (suggestion: AddressLookupSuggestion) => {
    setIsPartyAddressLookupPending(true);
    setSelectedPartyAddressMatchId(suggestion.id);
    setPartyAddressSearchError(null);
    try {
      const response = await fetch(`/api/address-search?id=${encodeURIComponent(suggestion.id)}`, {
        headers: { Accept: 'application/json' },
      });
      const payload = (await response.json()) as AddressLookupApiResponse;
      if (!response.ok || !payload.address) {
        throw new Error(payload.error || 'Lookup failed');
      }
      const address = payload.address;
      setLandlordAddressLine1(address.line1);
      setLandlordAddressLine2(address.line2);
      setLandlordCity(address.city);
      setLandlordPostcode(address.postcode || '');
      setPartyAddressSuggestions([]);
      pushToast({ title: `${partyCardTitle} address selected`, variant: 'success' });
    } catch (error) {
      setSelectedPartyAddressMatchId(null);
      setPartyAddressSearchError(error instanceof Error ? error.message : 'Try again.');
      pushToast({
        title: 'Address not found',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'error',
      });
    } finally {
      setIsPartyAddressLookupPending(false);
    }
  };

  const handleAutofill = () => {
    if (!demoEnabled) return;
    const demo = JOB_DEMO_VALUES[jobType];
    const today = new Date().toISOString().slice(0, 10);
    const futureDateTime = `${today}T10:30`;

    setClientMode('new');
    setSelectedClientId('');
    setSelectedPropertyKey('');
    setClientEmail('');

    setJobAddressName(demo.jobAddressName);
    setJobAddressLine1(demo.jobAddressLine1);
    setJobAddressLine2(demo.jobAddressLine2);
    setJobAddressCity(demo.jobAddressCity);
    setJobAddressPostcode(demo.jobAddressPostcode);
    setJobAddressTel(demo.jobAddressTel);

    setPropertyName(demo.jobAddressName);
    setAddressLine1(demo.jobAddressLine1);
    setCity(demo.jobAddressCity);
    setPostcode(demo.jobAddressPostcode);
    setSitePhone(demo.jobAddressTel);

    setLandlordName(demo.partyName);
    setLandlordCompany(demo.partyCompany);
    setLandlordAddressLine1(demo.partyAddressLine1);
    setLandlordAddressLine2(demo.partyAddressLine2);
    setLandlordCity(demo.partyCity);
    setLandlordPostcode(demo.partyPostcode);
    setLandlordTel(demo.partyTel);

    setClientName(demo.partyName);
    setClientPhone(demo.partyTel);

    if (jobType === 'safety_check') {
      setInspectionDate(today);
    } else {
      setScheduledFor(futureDateTime);
    }

    pushToast({
      title: `${JOB_TYPE_LABELS[jobType]} test data filled`,
      variant: 'success',
    });
  };

  const handleCopyLandlordToJob = () => {
    if (landlordAddressLine1) {
      setJobAddressLine1(landlordAddressLine1);
      setAddressLine1(landlordAddressLine1);
    }
    if (landlordAddressLine2) setJobAddressLine2(landlordAddressLine2);
    if (landlordCity) {
      setJobAddressCity(landlordCity);
      setCity(landlordCity);
    }
    if (landlordPostcode) {
      setJobAddressPostcode(landlordPostcode);
      setPostcode(landlordPostcode);
    }
    if (landlordTel) {
      setJobAddressTel(landlordTel);
      setSitePhone(landlordTel);
    }
    if (landlordName && !jobAddressName) {
      setJobAddressName(landlordName);
      setPropertyName(landlordName);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const derivedScheduledFor =
      isCp12Upcoming && inspectionDate
        ? `${inspectionDate}T${scheduledFor.includes('T') ? scheduledFor.slice(11, 16) || '09:00' : '09:00'}`
        : scheduledFor;

    startTransition(async () => {
      try {
        const { jobId } = await createSoloJob({
          clientMode,
          clientId: clientMode === 'existing' ? selectedClientId : '',
          clientName: isCp12Upcoming ? landlordName : partyNameValue,
          clientPhone: isCp12Upcoming ? clientPhone : landlordTel,
          clientEmail,
          propertyName: isCp12Upcoming ? propertyName : jobAddressName,
          addressLine1: isCp12Upcoming ? addressLine1 : jobAddressLine1,
          city: isCp12Upcoming ? city : jobAddressCity,
          postcode: isCp12Upcoming ? postcode : jobAddressPostcode,
          sitePhone: isCp12Upcoming ? sitePhone : jobAddressTel,
          scheduledFor: derivedScheduledFor,
          jobType,
          inspectionDate,
          jobAddressName,
          jobAddressLine1,
          jobAddressLine2,
          jobAddressCity,
          jobAddressPostcode,
          jobAddressTel,
          landlordName,
          landlordCompany,
          landlordAddressLine1,
          landlordAddressLine2,
          landlordCity,
          landlordPostcode,
          landlordTel,
          selectedPropertyJobId: selectedPropertyKey,
          requestId: initialRequest?.id,
        });
        clearDraft();
        pushToast({
          title: submitMode === 'continue' ? 'Job created, opening next step' : 'Job created',
          variant: 'success',
        });
        if (submitMode === 'continue') {
          const wizardRoute = WIZARD_ROUTE_BY_JOB_TYPE[jobType];
          const shouldSkipFirstWizardStep =
            Boolean(selectedPropertyKey) || isCp12Upcoming || jobType === 'warning_notice';
          const href = shouldSkipFirstWizardStep
            ? `/wizard/create/${wizardRoute}?jobId=${jobId}&startStep=2`
            : `/wizard/create/${wizardRoute}?jobId=${jobId}`;
          router.push(href);
        } else {
          router.push('/dashboard');
        }
        router.refresh();
      } catch (error) {
        pushToast({
          title: 'Could not create job',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {/* Step header */}
      {step > 1 ? (
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="flex items-center gap-1 text-[12px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
            onClick={goBack}
            disabled={isPending}
          >
            <span aria-hidden="true">←</span> Back
          </button>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <span
                key={s}
                className={`h-[5px] w-[5px] rounded-full transition-colors ${
                  s === step
                    ? 'bg-[var(--color-action)]'
                    : s < step
                      ? 'bg-[var(--color-action)]/40'
                      : 'bg-[var(--color-border-secondary)]'
                }`}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* ===== STEP 1: Job type ===== */}
      {step === 1 ? (
        <>
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Job type</p>
            <div className="flex gap-2">
              {LAUNCH_VISIBLE_JOB_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  disabled={isPending}
                  onClick={() => setJobType(type)}
                  className={`flex h-[38px] flex-1 items-center justify-center rounded-[8px] text-[13px] font-medium transition ${
                    jobType === type
                      ? 'bg-[#111] text-white'
                      : 'border-[0.5px] border-[var(--color-border-secondary)] bg-transparent text-[var(--color-text-secondary)]'
                  }`}
                >
                  {JOB_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
            {demoEnabled ? (
              <div className="mt-2 flex justify-end">
                <button type="button" className="text-xs text-[var(--color-text-tertiary)] underline-offset-2 hover:underline" onClick={handleAutofill} disabled={isPending}>
                  Autofill test {JOB_TYPE_LABELS[jobType]}
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            disabled={isPending}
            onClick={() => setStep(2)}
            className="inline-flex h-[44px] w-full items-center justify-center rounded-[12px] bg-[#111] text-[14px] font-medium text-white disabled:opacity-50"
          >
            Continue
          </button>
        </>
      ) : null}

      {/* ===== STEP 2: Who is this for? ===== */}
      {step === 2 ? (
        <>
          <div className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Who is this for?</p>
            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
                  Landlord
                </label>
                <Select
                  value={selectedClientId}
                  onChange={(event) => handleExistingClientSelect(event.target.value)}
                  disabled={isPending || clients.length === 0}
                  className="mt-1.5"
                >
                  <option value="">{clients.length ? 'Select landlord' : 'No saved landlords yet'}</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name ?? 'Unnamed landlord'}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
                  Property
                </label>
                <Select
                  value={selectedPropertyKey || (propertyChosen ? '__manual__' : '')}
                  onChange={(event) => handleExistingPropertySelect(event.target.value)}
                  disabled={isPending || !selectedClientId || availableProperties.length === 0}
                  className="mt-1.5"
                >
                  <option value="">
                    {!selectedClientId
                      ? 'Select landlord first'
                      : availableProperties.length
                        ? 'Select property'
                        : 'No saved properties yet'}
                  </option>
                  <option value="__manual__">New / manual entry</option>
                  {availableProperties.map((property) => (
                    <option key={property.key} value={property.key}>
                      {property.label || [property.job_address_line1, property.job_address_city, property.job_postcode].filter(Boolean).join(', ')}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-4 border-t-[0.5px] border-[var(--color-border-tertiary)] pt-2.5">
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setClientChosen(true);
                  setClientMode('new');
                  setSelectedClientId('');
                  setSelectedPropertyKey('');
                  setPropertyChosen(true);
                  setClientName('');
                  setClientPhone('');
                  setClientEmail('');
                }}
                className="text-[12px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
              >
                + New landlord
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setSelectedPropertyKey('');
                  setPropertyChosen(true);
                }}
                className="text-[12px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
              >
                + New property
              </button>
            </div>
          </div>

          {canShowContinue ? (
            <button
              type="button"
              onClick={() => {
                setPath(null);
                setStep(3);
              }}
              disabled={isPending}
              className="inline-flex h-[44px] w-full items-center justify-center rounded-[12px] bg-[#111] text-[14px] font-medium text-white disabled:opacity-50"
            >
              Continue
            </button>
          ) : null}
        </>
      ) : null}

      {/* ===== STEP 3: Start method ===== */}
      {step === 3 ? (
        <>
          {!path ? (
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">How do you want to start?</p>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setPath('self');
                  setStep(4);
                }}
                className="flex w-full items-center justify-between rounded-[12px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-4 py-3.5 text-left transition-colors hover:border-[var(--color-action)]"
              >
                <div>
                  <p className="text-[14px] font-medium text-[var(--color-text-primary)]">Fill details myself</p>
                  <p className="mt-0.5 text-[12px] text-[var(--color-text-secondary)]">Enter or review the landlord and property details now.</p>
                </div>
                <span className="ml-3 shrink-0 text-[var(--color-text-tertiary)]" aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() => setPath('landlord')}
                className="flex w-full items-center justify-between rounded-[12px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-4 py-3.5 text-left transition-colors hover:border-[var(--color-action)]"
              >
                <div>
                  <p className="text-[14px] font-medium text-[var(--color-text-primary)]">Ask landlord</p>
                  <p className="mt-0.5 text-[12px] text-[var(--color-text-secondary)]">Send a link for the landlord to complete the missing details.</p>
                </div>
                <span className="ml-3 shrink-0 text-[var(--color-text-tertiary)]" aria-hidden="true">→</span>
              </button>
            </div>
          ) : null}

          {path === 'landlord' && selectedClientId ? (
            <div className="space-y-3 rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] p-4">
              <div>
                <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Request details from landlord</p>
                <p className="mt-0.5 text-[12px] text-[var(--color-text-secondary)]">An email will be sent with a secure form link.</p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={clientEmail}
                  onChange={(event) => setClientEmail(event.target.value)}
                  placeholder="Landlord email"
                  type="email"
                  disabled={isPending}
                />
                <button
                  type="button"
                  className="shrink-0 rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-4 text-[13px] text-[var(--color-text-secondary)] disabled:opacity-50"
                  onClick={handleRequestLandlordPrefill}
                  disabled={isPending || !clientEmail.trim()}
                >
                  {isPending ? 'Sending…' : 'Send'}
                </button>
              </div>
              {landlordRequestMessage ? (
                <p className="text-[12px] font-medium text-[var(--color-action)]">{landlordRequestMessage}</p>
              ) : null}
              {landlordRequestError ? (
                <p className="text-[12px] text-[var(--color-red)]">{landlordRequestError}</p>
              ) : null}
            </div>
          ) : null}

          {path === 'landlord' && !selectedClientId && requestUrl ? (
            <RequestLandlordDetailsCard
              requestUrl={requestUrl}
              initialLandlordName={landlordName || clientName}
              initialLandlordEmail={clientEmail}
            />
          ) : null}
        </>
      ) : null}

      {/* ===== STEP 4: Landlord / client details ===== */}
      {step === 4 ? (
        <>
          {initialRequest ? (
            <div className="rounded-[12px] border-[0.5px] border-[var(--color-action)]/30 bg-[var(--color-action-bg)] px-4 py-3">
              <p className="text-[13px] font-medium text-[var(--color-action)]">Landlord request details</p>
              <div className="mt-2 space-y-1">
                <p className="text-[12px] text-[var(--color-text-secondary)]"><span className="font-medium text-[var(--color-text-primary)]">Tenant:</span> {initialRequest.tenantName || 'Not provided'}</p>
                <p className="text-[12px] text-[var(--color-text-secondary)]"><span className="font-medium text-[var(--color-text-primary)]">Phone:</span> {initialRequest.tenantPhone || 'Not provided'}</p>
                <p className="text-[12px] text-[var(--color-text-secondary)]"><span className="font-medium text-[var(--color-text-primary)]">Preferred dates:</span> {initialRequest.preferredDates || 'Not provided'}</p>
                <p className="text-[12px] text-[var(--color-text-secondary)]"><span className="font-medium text-[var(--color-text-primary)]">Access notes:</span> {initialRequest.accessNotes || 'Not provided'}</p>
              </div>
            </div>
          ) : null}

          <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">{partyCardTitle}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Name</label>
                <Input
                  value={partyNameValue}
                  onChange={(event) =>
                    isCp12Upcoming ? handleLandlordNameInput(event.target.value) : handleClientNameInput(event.target.value)
                  }
                  placeholder={isCp12Upcoming ? 'Landlord / Owner name' : 'Client name'}
                  className="mt-1"
                  list={isCp12Upcoming ? undefined : 'job-client-options'}
                  required
                  disabled={isPending}
                />
                {!isCp12Upcoming ? (
                  <datalist id="job-client-options">
                    {clients.map((client) => (
                      <option key={client.id} value={client.name ?? ''} />
                    ))}
                  </datalist>
                ) : null}
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Company</label>
                <Input
                  value={landlordCompany}
                  onChange={(event) => setLandlordCompany(event.target.value)}
                  placeholder="Optional"
                  className="mt-1"
                  disabled={isPending}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
                  Address line 1
                </label>
                <div className="relative mt-1.5">
                  <Input
                    value={landlordAddressLine1}
                    onChange={(event) => {
                      const value = event.target.value;
                      setLandlordAddressLine1(value);
                      setPartyAddressSearchError(null);
                      setSelectedPartyAddressMatchId(null);
                    }}
                    placeholder="Start typing address or postcode"
                    disabled={isPending}
                  />
                  {isPartyAddressLookupPending && !partyAddressSuggestions.length ? (
                    <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-[10px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-3 py-2 text-[13px] text-[var(--color-text-secondary)] shadow-lg">
                      Searching addresses…
                    </div>
                  ) : null}
                  {partyAddressSuggestions.length ? (
                    <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-[10px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] shadow-lg">
                      <div className="max-h-72 overflow-y-auto p-1.5">
                        {partyAddressSuggestions.map((suggestion) => {
                          const isSelected = selectedPartyAddressMatchId === suggestion.id;
                          return (
                            <button
                              key={suggestion.id}
                              type="button"
                              onClick={() => void handlePartyAddressMatchSelect(suggestion)}
                              className={`w-full rounded-[8px] px-3 py-2 text-left transition ${
                                isSelected
                                  ? 'bg-[var(--color-action-bg)] text-[var(--color-action)]'
                                  : 'hover:bg-[var(--color-background-secondary)] text-[var(--color-text-primary)]'
                              }`}
                            >
                              <div className="text-sm font-medium">{suggestion.label}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {partyAddressSearchError ? <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">{formatAddressError(partyAddressSearchError)}</p> : null}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
                  Address line 2
                </label>
                <Input
                  value={landlordAddressLine2}
                  onChange={(event) => setLandlordAddressLine2(event.target.value)}
                  placeholder="Optional"
                  className="mt-1"
                  disabled={isPending}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">City / town</label>
                <Input
                  value={landlordCity}
                  onChange={(event) => setLandlordCity(event.target.value)}
                  placeholder="London"
                  className="mt-1"
                  disabled={isPending}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Postcode</label>
                <Input
                  value={landlordPostcode}
                  onChange={(event) => setLandlordPostcode(event.target.value)}
                  placeholder="SW1A 1AA"
                  className="mt-1"
                  disabled={isPending}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Tel. No.</label>
                <Input
                  value={landlordTel}
                  onChange={(event) => setLandlordTel(event.target.value)}
                  placeholder="Optional"
                  className="mt-1"
                  disabled={isPending}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Email</label>
                <Input
                  value={clientEmail}
                  onChange={(event) => setClientEmail(event.target.value)}
                  type="email"
                  placeholder="landlord@example.com"
                  className="mt-1"
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          {canShowContinue ? (
            <button
              type="button"
              onClick={() => setStep(5)}
              disabled={isPending}
              className="inline-flex h-[44px] w-full items-center justify-center rounded-[12px] bg-[#111] text-[14px] font-medium text-white disabled:opacity-50"
            >
              Continue
            </button>
          ) : null}
        </>
      ) : null}

      {/* ===== STEP 5: Job address ===== */}
      {step === 5 ? (
        <>
          <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Job address</p>
              {landlordAddressLine1 || landlordName ? (
                <button
                  type="button"
                  onClick={handleCopyLandlordToJob}
                  disabled={isPending}
                  className="text-[11px] text-[var(--color-text-tertiary)] underline-offset-2 transition-colors hover:text-[var(--color-action)] hover:underline"
                >
                  ← Copy landlord address
                </button>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
                  {scheduleFieldLabel}
                </label>
                <Input
                  type={isCp12Upcoming ? 'date' : 'datetime-local'}
                  value={isCp12Upcoming ? inspectionDate : scheduledFor}
                  onChange={(event) =>
                    isCp12Upcoming ? setInspectionDate(event.target.value) : setScheduledFor(event.target.value)
                  }
                  className="mt-1.5 rounded-[10px]"
                  required
                  disabled={isPending}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
                  Property name / reference
                </label>
                <Input
                  value={jobAddressName}
                  onChange={(event) =>
                    isCp12Upcoming
                      ? handleCp12PropertyReferenceInput(event.target.value)
                      : handlePropertyReferenceInput(event.target.value)
                  }
                  placeholder="Flat 2 - Tenant entrance"
                  className="mt-1"
                  list={isCp12Upcoming ? undefined : 'job-property-reference-options'}
                  required
                  disabled={isPending}
                />
                {!isCp12Upcoming && propertySuggestions.length ? (
                  <datalist id="job-property-reference-options">
                    {propertySuggestions.map((property) => (
                      <option key={property.key} value={property.value} label={property.label} />
                    ))}
                  </datalist>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
                  Address line 1
                </label>
                <div className="relative mt-1.5">
                  <Input
                    value={jobAddressLine1}
                    onChange={(event) => {
                      const value = event.target.value;
                      setJobAddressLine1(value);
                      setAddressLine1(value);
                      setJobAddressSearchError(null);
                      setSelectedJobAddressMatchId(null);
                    }}
                    placeholder="Start typing address or postcode"
                    required={!initialRequest}
                    disabled={isPending}
                  />
                  {isJobAddressLookupPending && !jobAddressSuggestions.length ? (
                    <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-[10px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-3 py-2 text-[13px] text-[var(--color-text-secondary)] shadow-lg">
                      Searching addresses…
                    </div>
                  ) : null}
                  {jobAddressSuggestions.length ? (
                    <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-[10px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] shadow-lg">
                      <div className="max-h-72 overflow-y-auto p-1.5">
                        {jobAddressSuggestions.map((suggestion) => {
                          const isSelected = selectedJobAddressMatchId === suggestion.id;
                          return (
                            <button
                              key={suggestion.id}
                              type="button"
                              onClick={() => void handleJobAddressMatchSelect(suggestion)}
                              className={`w-full rounded-[8px] px-3 py-2 text-left transition ${
                                isSelected
                                  ? 'bg-[var(--color-action-bg)] text-[var(--color-action)]'
                                  : 'hover:bg-[var(--color-background-secondary)] text-[var(--color-text-primary)]'
                              }`}
                            >
                              <div className="text-sm font-medium">{suggestion.label}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {jobAddressSearchError ? <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">{formatAddressError(jobAddressSearchError)}</p> : null}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
                  Address line 2
                </label>
                <Input
                  value={jobAddressLine2}
                  onChange={(event) => setJobAddressLine2(event.target.value)}
                  placeholder="Optional"
                  className="mt-1"
                  disabled={isPending}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">City / town</label>
                <Input
                  value={jobAddressCity}
                  onChange={(event) => setJobAddressCity(event.target.value)}
                  placeholder="London"
                  className="mt-1"
                  required={!initialRequest}
                  disabled={isPending}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Postcode</label>
                <Input
                  value={jobAddressPostcode}
                  onChange={(event) => setJobAddressPostcode(event.target.value)}
                  placeholder="SW1A 1AA"
                  className="mt-1"
                  required={!initialRequest}
                  disabled={isPending}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Site telephone</label>
                <Input
                  value={jobAddressTel}
                  onChange={(event) => setJobAddressTel(event.target.value)}
                  placeholder="020 7946 0958"
                  className="mt-1"
                  disabled={isPending}
                  required={isCp12Upcoming}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-[40px] rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-transparent px-4 text-[13px] text-[var(--color-text-secondary)] disabled:opacity-50"
              onClick={() => router.push('/dashboard')}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-[40px] flex-1 rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-transparent text-[13px] text-[var(--color-text-secondary)] disabled:opacity-50"
              disabled={isPending}
              onClick={() => setSubmitMode('return')}
            >
              {isPending && submitMode === 'return' ? 'Saving…' : 'Save'}
            </button>
            <button
              type="submit"
              className="h-[40px] flex-[2] rounded-[10px] bg-[#111] text-[13px] font-medium text-white disabled:opacity-50"
              disabled={isPending}
              onClick={() => setSubmitMode('continue')}
            >
              {isPending && submitMode === 'continue' ? 'Saving…' : 'Save & continue'}
            </button>
          </div>
        </>
      ) : null}

    </form>
  );
}
