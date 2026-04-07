'use client';

import { useDeferredValue, useEffect, useMemo, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { createSoloJob } from '@/server/jobs';
import type { ClientListItem } from '@/types/client';
import { JOB_TYPE_LABELS, type JobType } from '@/types/job-records';
import type { AddressLookupSuggestion } from '@/lib/address-lookup';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { buildWizardDraftStorageKey, useWizardDraft } from '@/hooks/use-wizard-draft';

export type SavedPropertyOption = {
  key: string;
  label: string;
  job_address_name: string;
  job_address_line1: string;
  job_address_city: string;
  job_postcode: string;
  job_tel: string;
};

type SoloJobFormProps = {
  clients: ClientListItem[];
  propertiesByClientId: Record<string, SavedPropertyOption[]>;
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

const WIZARD_ROUTE_BY_JOB_TYPE: Record<JobType, string> = {
  safety_check: 'cp12',
  service: 'boiler_service',
  breakdown: 'breakdown',
  installation: 'commissioning',
  warning_notice: 'gas_warning_notice',
  general: 'general_works',
};

const LAUNCH_VISIBLE_JOB_TYPES: readonly JobType[] = ['safety_check'];

const splitAddressParts = (value: string | null | undefined) =>
  String(value ?? '')
    .split(/[\r\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

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

export function SoloJobForm({ clients, propertiesByClientId }: SoloJobFormProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const draftStorageKey = useMemo(() => buildWizardDraftStorageKey('jobs_new', 'create'), []);
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('new');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [selectedPropertyKey, setSelectedPropertyKey] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [sitePhone, setSitePhone] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [jobType, setJobType] = useState<JobType>('safety_check');
  const [inspectionDate, setInspectionDate] = useState('');
  const [jobAddressName, setJobAddressName] = useState('');
  const [jobAddressLine1, setJobAddressLine1] = useState('');
  const [jobAddressLine2, setJobAddressLine2] = useState('');
  const [jobAddressCity, setJobAddressCity] = useState('');
  const [jobAddressPostcode, setJobAddressPostcode] = useState('');
  const [jobAddressTel, setJobAddressTel] = useState('');
  const [landlordName, setLandlordName] = useState('');
  const [landlordCompany, setLandlordCompany] = useState('');
  const [landlordAddressLine1, setLandlordAddressLine1] = useState('');
  const [landlordAddressLine2, setLandlordAddressLine2] = useState('');
  const [landlordCity, setLandlordCity] = useState('');
  const [landlordPostcode, setLandlordPostcode] = useState('');
  const [landlordTel, setLandlordTel] = useState('');
  const [submitMode, setSubmitMode] = useState<'return' | 'continue'>('return');
  const [isJobAddressLookupPending, setIsJobAddressLookupPending] = useState(false);
  const [jobAddressSuggestions, setJobAddressSuggestions] = useState<AddressLookupSuggestion[]>([]);
  const [selectedJobAddressMatchId, setSelectedJobAddressMatchId] = useState<string | null>(null);
  const [jobAddressSearchError, setJobAddressSearchError] = useState<string | null>(null);
  const [isPartyAddressLookupPending, setIsPartyAddressLookupPending] = useState(false);
  const [partyAddressSuggestions, setPartyAddressSuggestions] = useState<AddressLookupSuggestion[]>([]);
  const [selectedPartyAddressMatchId, setSelectedPartyAddressMatchId] = useState<string | null>(null);
  const [partyAddressSearchError, setPartyAddressSearchError] = useState<string | null>(null);
  const isCp12Upcoming = jobType === 'safety_check';
  const demoEnabled = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
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

  useEffect(() => {
    if (!clients.length) {
      setClientMode('new');
    }
  }, [clients.length]);

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
    },
  });

  useEffect(() => {
    if (!isCp12Upcoming) return;
    setClientMode('new');
    setSelectedClientId('');
    setSelectedPropertyKey('');
  }, [isCp12Upcoming]);

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
    setJobAddressLine2('');
    setJobAddressCity(selectedProperty.job_address_city);
    setJobAddressPostcode(selectedProperty.job_postcode);
    setJobAddressTel(selectedProperty.job_tel);
    setPropertyName(nextPropertyName);
    setAddressLine1(selectedProperty.job_address_line1);
    setCity(selectedProperty.job_address_city);
    setPostcode(selectedProperty.job_postcode);
    setSitePhone(selectedProperty.job_tel);
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
        setJobAddressSearchError(error instanceof Error ? error.message : 'Try another search.');
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
        setPartyAddressSearchError(error instanceof Error ? error.message : 'Try another search.');
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
        });
        clearDraft();
        pushToast({
          title: submitMode === 'continue' ? 'Job created, opening next step' : 'Job created',
          variant: 'success',
        });
        if (submitMode === 'continue') {
          const wizardRoute = WIZARD_ROUTE_BY_JOB_TYPE[jobType];
          const shouldSkipFirstWizardStep =
            isCp12Upcoming || jobType === 'service' || jobType === 'warning_notice';
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

  const renderFormActions = () => (
    <div className="flex items-center justify-end gap-3">
      <Button type="button" variant="secondary" onClick={() => router.push('/dashboard')} disabled={isPending}>
        Cancel
      </Button>
      <Button
        type="submit"
        variant="secondary"
        disabled={isPending}
        onClick={() => setSubmitMode('return')}
      >
        {isPending && submitMode === 'return' ? 'Saving…' : 'Save & return later'}
      </Button>
      <Button
        type="submit"
        disabled={isPending}
        onClick={() => setSubmitMode('continue')}
      >
        {isPending && submitMode === 'continue' ? 'Saving…' : 'Save & continue now'}
      </Button>
    </div>
  );

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <Card className="border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-muted">Job type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Job type</label>
          <Select
            value={jobType}
            onChange={(event) => setJobType(event.target.value as JobType)}
            className="mt-1"
            disabled={isPending}
          >
            {LAUNCH_VISIBLE_JOB_TYPES.map((type) => (
              <option key={type} value={type}>
                {JOB_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
          {demoEnabled ? (
            <div className="flex justify-end">
              <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleAutofill} disabled={isPending}>
                Autofill test {JOB_TYPE_LABELS[jobType]}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-muted">Job Address</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
              {scheduleFieldLabel}
            </label>
            <Input
              type={isCp12Upcoming ? 'date' : 'datetime-local'}
              value={isCp12Upcoming ? inspectionDate : scheduledFor}
              onChange={(event) =>
                isCp12Upcoming ? setInspectionDate(event.target.value) : setScheduledFor(event.target.value)
              }
              className="mt-1"
              required
              disabled={isPending}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
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
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
              Address line 1
            </label>
            <div className="relative mt-1">
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
                required
                disabled={isPending}
              />
              {isJobAddressLookupPending && !jobAddressSuggestions.length ? (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-muted shadow-lg">
                  Searching addresses…
                </div>
              ) : null}
              {jobAddressSuggestions.length ? (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-lg">
                  <div className="max-h-72 overflow-y-auto p-2">
                    {jobAddressSuggestions.map((suggestion) => {
                      const isSelected = selectedJobAddressMatchId === suggestion.id;
                      return (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => void handleJobAddressMatchSelect(suggestion)}
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
              {jobAddressSearchError ? <p className="mt-2 text-xs text-red-600">{jobAddressSearchError}</p> : null}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
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
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">City / town</label>
            <Input
              value={jobAddressCity}
              onChange={(event) => setJobAddressCity(event.target.value)}
              placeholder="London"
              className="mt-1"
              required
              disabled={isPending}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Postcode</label>
            <Input
              value={jobAddressPostcode}
              onChange={(event) => setJobAddressPostcode(event.target.value)}
              placeholder="SW1A 1AA"
              className="mt-1"
              required
              disabled={isPending}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Site telephone</label>
            <Input
              value={jobAddressTel}
              onChange={(event) => setJobAddressTel(event.target.value)}
              placeholder="020 7946 0958"
              className="mt-1"
              disabled={isPending}
              required={isCp12Upcoming}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-muted">{partyCardTitle}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Name</label>
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
                  <option
                    key={client.id}
                    value={client.name ?? ''}
                  />
                ))}
              </datalist>
            ) : null}
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Company</label>
            <Input
              value={landlordCompany}
              onChange={(event) => setLandlordCompany(event.target.value)}
              placeholder="Optional"
              className="mt-1"
              disabled={isPending}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
              Address line 1
            </label>
            <div className="relative mt-1">
              <Input
                value={landlordAddressLine1}
                onChange={(event) => {
                  const value = event.target.value;
                  setLandlordAddressLine1(value);
                  setPartyAddressSearchError(null);
                  setSelectedPartyAddressMatchId(null);
                }}
                placeholder="Start typing address or postcode"
                required
                disabled={isPending}
              />
              {isPartyAddressLookupPending && !partyAddressSuggestions.length ? (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-muted shadow-lg">
                  Searching addresses…
                </div>
              ) : null}
              {partyAddressSuggestions.length ? (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-lg">
                  <div className="max-h-72 overflow-y-auto p-2">
                    {partyAddressSuggestions.map((suggestion) => {
                      const isSelected = selectedPartyAddressMatchId === suggestion.id;
                      return (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => void handlePartyAddressMatchSelect(suggestion)}
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
              {partyAddressSearchError ? <p className="mt-2 text-xs text-red-600">{partyAddressSearchError}</p> : null}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
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
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">City / town</label>
            <Input
              value={landlordCity}
              onChange={(event) => setLandlordCity(event.target.value)}
              placeholder="London"
              className="mt-1"
              required
              disabled={isPending}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Postcode</label>
            <Input
              value={landlordPostcode}
              onChange={(event) => setLandlordPostcode(event.target.value)}
              placeholder="SW1A 1AA"
              className="mt-1"
              required
              disabled={isPending}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Tel. No.</label>
            <Input
              value={landlordTel}
              onChange={(event) => setLandlordTel(event.target.value)}
              placeholder="Optional"
              className="mt-1"
              disabled={isPending}
            />
          </div>
        </CardContent>
      </Card>

      {renderFormActions()}
    </form>
  );
}
