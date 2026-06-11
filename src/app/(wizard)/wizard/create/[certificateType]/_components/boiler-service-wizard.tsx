'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react';

import { WizardLayout } from '@/components/certificates/wizard-layout';
import { OfflineDraftBanner } from '@/components/certificates/offline-draft-banner';
import { EvidenceCard } from './evidence-card';
import { SignatureCard } from '@/components/certificates/signature-card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { CollapsibleSection } from '@/components/wizard/layout/collapsible-section';
import { ApplianceStep, type ApplianceStepValues } from '@/components/wizard/steps/appliance-step';
import { UnitNumberInput } from '@/components/wizard/inputs/unit-number-input';
import { Cp12VoiceReadings } from '@/components/cp12/cp12-voice-readings';
import {
  BOILER_SERVICE_DEMO_INFO,
  BOILER_SERVICE_DEMO_DETAILS,
  BOILER_SERVICE_DEMO_CHECKS,
  BOILER_SERVICE_TYPES,
  type BoilerServiceChecks,
  type BoilerServiceDetails,
  type BoilerServiceJobInfo,
  type BoilerServicePhotoCategory,
} from '@/types/boiler-service';
import {
  saveBoilerServiceJobInfo,
  saveBoilerServiceDetails,
  saveBoilerServiceChecks,
  uploadBoilerServicePhoto,
  generateGasServicePdf,
  uploadSignature,
  saveJobFields,
} from '@/server/certificates';
import { tryUpdateJobRecord } from '@/server/jobRecords';
import { mergeJobContextFields, type InitialJobContext } from './initial-job-context';
import { buildWizardDraftStorageKey, useWizardDraft } from '@/hooks/use-wizard-draft';
import { useWizardStepHistory } from '@/hooks/use-wizard-step-history';
import { LimitReachedModal } from '@/components/billing/limit-reached-modal';
import type { AddressLookupResult, AddressLookupSuggestion } from '@/lib/address-lookup';
import type { Cp12VoiceReadingsParsed } from '@/lib/cp12/voice-readings';

type BoilerServiceWizardProps = {
  jobId: string;
  initialFields: Record<string, string | null | undefined>;
  initialJobContext?: InitialJobContext | null;
  initialPhotoPreviews?: Record<string, string>;
  stepOffset?: number;
  startStep?: number;
};

type BoilerServiceJobAddress = {
  job_reference: string;
  job_visit_date: string;
  job_address_name: string;
  job_address_line1: string;
  job_address_line2: string;
  job_address_city: string;
  job_postcode: string;
  job_tel: string;
};

type CheckItem = { key: keyof BoilerServiceChecks; label: string };
type MissingIssueItem = { id: string; label: string; step?: number; href?: string };

const SAFETY_CHECK_ITEMS: CheckItem[] = [
  { key: 'appliance_operating_correctly', label: 'Appliance is operating correctly' },
  { key: 'appliance_conforms_standards', label: 'Appliance conforms to current safety standards' },
  { key: 'appliance_controls_checked', label: 'Appliance/system controls checked/adjusted' },
  { key: 'appliance_flueing_safe', label: 'Appliance flueing is safe' },
  { key: 'appliance_ventilation_safe', label: 'Appliance ventilation is safe' },
  { key: 'emission_combustion_test', label: 'Emission/combustion test' },
  { key: 'burner_pressure_gas_rate_correct', label: 'Burner pressure/Gas rate correct' },
  { key: 'tightness_test_carried_out', label: 'Tightness Test carried out' },
];

const CENTRAL_HEATING_CHECK_ITEMS: CheckItem[] = [
  { key: 'boiler_working_correctly', label: 'Boiler/warm air working correctly' },
  { key: 'cylinder_condition_checked', label: 'Hot water cylinder condition checked and in working order' },
  { key: 'programmer_controls_working', label: 'Programmer/timer and all controls working correctly' },
  { key: 'warm_air_grills_working', label: 'Warm air/outlet grills working correctly' },
  { key: 'pipework_free_from_leaks', label: 'Visible pipework free from water leaks' },
  { key: 'magnetic_filter_fitted', label: 'Magnetic System filter fitted (where applicable)' },
  { key: 'water_quality_acceptable', label: 'Water quality/level of inhibitor acceptable' },
];

const ADVICE_CHECK_ITEMS: CheckItem[] = [
  { key: 'co_alarm_fitted', label: 'Approved audible Carbon Monoxide Alarm fitted*' },
  { key: 'appliance_safe', label: 'Appliance is safe' },
  { key: 'all_functional_parts_available', label: 'All functional parts available' },
];

type BoilerServiceDraftState = {
  step: number;
  completionDate: string;
  jobInfo: BoilerServiceJobInfo;
  jobAddress: BoilerServiceJobAddress;
  details: BoilerServiceDetails;
  checks: BoilerServiceChecks;
  checkComments: Record<string, string>;
  engineerSignature: string;
  engineerSignaturePath: string;
  customerSignature: string;
  customerSignaturePath: string;
  addressSearchQuery: string;
  customerAddressSearchQuery: string;
};

const BOILER_SERVICE_DEMO_JOB_ADDRESS: BoilerServiceJobAddress = {
  job_reference: 'BSR-DEMO-001',
  job_visit_date: '',
  job_address_name: 'Flat 2 - Plant room',
  job_address_line1: '42 Station Road',
  job_address_line2: 'Rear access gate',
  job_address_city: 'London',
  job_postcode: 'E2 2AA',
  job_tel: '020 7000 0000',
};

const EMPTY_CHECKS: BoilerServiceChecks = {
  service_visual_inspection: '',
  service_burner_cleaned: '',
  service_heat_exchanger_cleaned: '',
  service_condensate_trap_checked: '',
  service_seals_checked: '',
  service_filters_cleaned: '',
  service_flue_checked: '',
  service_ventilation_checked: '',
  service_controls_checked: '',
  service_leaks_checked: '',
  operating_pressure_mbar: '',
  inlet_pressure_mbar: '',
  heat_input: '',
  co_ppm: '',
  co2_percent: '',
  high_combustion_co_ppm: '',
  high_combustion_co2: '',
  high_combustion_ratio: '',
  low_combustion_co_ppm: '',
  low_combustion_co2: '',
  low_combustion_ratio: '',
  flue_gas_temp_c: '',
  system_pressure_bar: '',
  appliance_operating_correctly: '',
  appliance_conforms_standards: '',
  appliance_controls_checked: '',
  appliance_flueing_safe: '',
  appliance_ventilation_safe: '',
  emission_combustion_test: '',
  burner_pressure_gas_rate_correct: '',
  tightness_test_carried_out: '',
  boiler_working_correctly: '',
  cylinder_condition_checked: '',
  programmer_controls_working: '',
  co_alarm_fitted: '',
  appliance_safe: '',
  all_functional_parts_available: '',
  warm_air_grills_working: '',
  pipework_free_from_leaks: '',
  magnetic_filter_fitted: '',
  water_quality_acceptable: '',
  warning_notice_explained: '',
  appliance_replacement_recommended: '',
  system_improvements_recommended: '',
  service_summary: '',
  recommendations: '',
  defects_found: '',
  defects_details: '',
  parts_used: '',
  next_service_due: '',
};

const FINAL_EVIDENCE_DEFAULT: BoilerServicePhotoCategory = 'boiler';

const normalizeGasType = (value: string) => {
  const normalized = value.toLowerCase().replace(/\s+/g, '_');
  if (normalized === 'natural_gas') return 'natural_gas';
  if (normalized === 'lpg') return 'lpg';
  return normalized === 'unknown' ? '' : value ? value : '';
};

const denormalizeGasType = (value: string) => {
  if (value === 'natural_gas') return 'natural gas';
  if (value === 'lpg') return 'lpg';
  return value === 'unknown' ? '' : value || '';
};

const makeDemoSignatureDataUrl = (label: string, stroke: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="90" viewBox="0 0 320 90">
      <rect width="320" height="90" fill="white" fill-opacity="0" />
      <path d="M16 62 C42 24, 78 82, 116 38 S178 78, 214 34 S270 72, 304 30" fill="none" stroke="${stroke}" stroke-width="4" stroke-linecap="round" />
      <text x="18" y="82" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#334155">${label}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

const splitAddressParts = (value: string | null | undefined) =>
  String(value ?? '')
    .split(/[\r\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

const composeAddress = (...parts: Array<string | null | undefined>) =>
  parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(', ');

const normalizeDateOnly = (value: string | null | undefined) => {
  const dateOnly = String(value ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : '';
};

const addOneYear = (dateOnly: string) => {
  const normalized = normalizeDateOnly(dateOnly);
  if (!normalized) return '';
  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return '';
  parsed.setUTCFullYear(parsed.getUTCFullYear() + 1);
  return parsed.toISOString().slice(0, 10);
};

type AddressLookupApiResponse = {
  suggestions?: AddressLookupSuggestion[];
  address?: AddressLookupResult;
  error?: string;
};

const ADDRESS_SEARCH_MIN_QUERY_LENGTH = 3;
const DEMO_AUTOFILL_VISIBLE = process.env.NEXT_PUBLIC_SHOW_DEMO_AUTOFILL === 'true';

const getAddressLookupErrorMessage = (error: unknown, fallback: string) => {
  if (
    error instanceof Error &&
    ['Address lookup disabled', 'Address lookup is disabled', 'Address lookup is not configured'].includes(error.message)
  ) {
    return null;
  }

  return error instanceof Error ? error.message : fallback;
};

// Show the same neutral fallback as /jobs/new instead of the raw provider error
// (e.g. the Ideal Postcodes 402 "temporarily unavailable") in alarming red. Pass through
// the benign guidance messages; collapse everything else to a calm "enter manually" hint.
const formatAddressError = (msg: string | null) => {
  if (!msg) return null;
  if (msg.startsWith('Type at least') || msg === 'No addresses found. Try a postcode or add more detail.') {
    return msg;
  }
  return 'Address lookup unavailable — enter manually';
};

export function BoilerServiceWizard({
  jobId,
  initialFields,
  initialJobContext = null,
  stepOffset = 0,
  startStep = 1,
}: BoilerServiceWizardProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const initialStep = Math.min(4, Math.max(1, startStep - stepOffset));
  const [step, setStep] = useState(initialStep);
  const [isPending, startTransition] = useTransition();
  const [isOfflineDraftSyncing, setIsOfflineDraftSyncing] = useState(false);
  const [offlineDraftSyncError, setOfflineDraftSyncError] = useState<string | null>(null);
  const [offlineDraftSyncErrorCount, setOfflineDraftSyncErrorCount] = useState(0);
  const [queuedIssue, setQueuedIssue] = useState(false);
  const wasOfflineRef = useRef(false);
  const resolvedFields = mergeJobContextFields(initialFields, initialJobContext);
  const [isAddressLookupPending, setIsAddressLookupPending] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressLookupSuggestion[]>([]);
  const [selectedAddressMatchId, setSelectedAddressMatchId] = useState<string | null>(null);
  const [addressSearchQuery, setAddressSearchQuery] = useState(
    resolvedFields.job_address_line1 ?? resolvedFields.property_address ?? '',
  );
  const [addressSearchError, setAddressSearchError] = useState<string | null>(null);
  const [isCustomerAddressLookupPending, setIsCustomerAddressLookupPending] = useState(false);
  const [customerAddressSuggestions, setCustomerAddressSuggestions] = useState<AddressLookupSuggestion[]>([]);
  const [selectedCustomerAddressMatchId, setSelectedCustomerAddressMatchId] = useState<string | null>(null);
  const [customerAddressSearchQuery, setCustomerAddressSearchQuery] = useState(
    resolvedFields.customer_address_line1 ?? resolvedFields.customer_address ?? initialJobContext?.customer?.address ?? '',
  );
  const [customerAddressSearchError, setCustomerAddressSearchError] = useState<string | null>(null);
  const [limitReachedMessage, setLimitReachedMessage] = useState<string | null>(null);
  const deferredAddressSearchQuery = useDeferredValue(addressSearchQuery.trim());
  const deferredCustomerAddressSearchQuery = useDeferredValue(customerAddressSearchQuery.trim());
  const customerAddressParts = splitAddressParts(
    resolvedFields.customer_address ?? initialJobContext?.customer?.address ?? '',
  );
  const customerAddressLine2 =
    resolvedFields.customer_address_line2 ??
    (customerAddressParts.length > 2 ? customerAddressParts.slice(1, -1).join(', ') : '');
  const customerCity =
    resolvedFields.customer_city ??
    (customerAddressParts.length > 1 ? customerAddressParts.at(-1) ?? '' : '');

  const [completionDate, setCompletionDate] = useState(
    resolvedFields.completion_date ? resolvedFields.completion_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
  const initialServiceDate = normalizeDateOnly(
    resolvedFields.service_date ?? resolvedFields.job_visit_date ?? resolvedFields.completion_date,
  );
  const initialNextServiceDue = normalizeDateOnly(resolvedFields.next_service_due) || addOneYear(initialServiceDate);

  const [jobInfo, setJobInfo] = useState<BoilerServiceJobInfo>({
    customer_name: resolvedFields.customer_name ?? '',
    customer_company: resolvedFields.customer_company ?? initialJobContext?.customer?.organization ?? '',
    customer_address_line1: resolvedFields.customer_address_line1 ?? customerAddressParts[0] ?? '',
    customer_address_line2: customerAddressLine2,
    customer_city: customerCity,
    customer_postcode: resolvedFields.customer_postcode ?? initialJobContext?.customer?.postcode ?? '',
    customer_phone: resolvedFields.customer_phone ?? resolvedFields.customer_contact ?? initialJobContext?.customer?.phone ?? '',
    property_address: resolvedFields.property_address ?? '',
    postcode: resolvedFields.postcode ?? '',
    service_date: resolvedFields.service_date ? resolvedFields.service_date.slice(0, 10) : '',
    engineer_name: resolvedFields.engineer_name ?? '',
    gas_safe_number: resolvedFields.gas_safe_number ?? '',
    company_name: resolvedFields.company_name ?? '',
    company_address: resolvedFields.company_address ?? '',
  });

  const [jobAddress, setJobAddress] = useState<BoilerServiceJobAddress>({
    job_reference: resolvedFields.job_reference ?? '',
    job_visit_date: resolvedFields.service_date ? resolvedFields.service_date.slice(0, 10) : '',
    job_address_name: resolvedFields.job_address_name ?? '',
    job_address_line1: resolvedFields.job_address_line1 ?? resolvedFields.property_address ?? '',
    job_address_line2: resolvedFields.job_address_line2 ?? '',
    job_address_city: resolvedFields.job_address_city ?? '',
    job_postcode: resolvedFields.job_postcode ?? resolvedFields.postcode ?? '',
    job_tel: resolvedFields.job_tel ?? resolvedFields.job_phone ?? '',
  });

  const [details, setDetails] = useState<BoilerServiceDetails>({
    boiler_make: resolvedFields.boiler_make ?? '',
    boiler_model: resolvedFields.boiler_model ?? '',
    boiler_type: resolvedFields.boiler_type ?? '',
    boiler_location: resolvedFields.boiler_location ?? '',
    serial_number: resolvedFields.serial_number ?? '',
    gas_type: resolvedFields.gas_type ?? '',
    mount_type: resolvedFields.mount_type ?? '',
    flue_type: resolvedFields.flue_type ?? '',
  });

  const [checks, setChecks] = useState<BoilerServiceChecks>({
    ...EMPTY_CHECKS,
    ...Object.entries(EMPTY_CHECKS).reduce<Record<string, string>>((acc, [key]) => {
      const existing = resolvedFields[key];
      acc[key] = typeof existing === 'boolean' ? String(existing) : (existing as string) ?? '';
      return acc;
    }, {}),
    next_service_due: initialNextServiceDue,
  });

  const [engineerSignature, setEngineerSignature] = useState((resolvedFields.engineer_signature as string) ?? '');
  const [engineerSignaturePath, setEngineerSignaturePath] = useState((resolvedFields.engineer_signature_path as string) ?? '');
  const [customerSignature, setCustomerSignature] = useState((resolvedFields.customer_signature as string) ?? '');
  const [customerSignaturePath, setCustomerSignaturePath] = useState((resolvedFields.customer_signature_path as string) ?? '');
  const [checkComments, setCheckComments] = useState<Record<string, string>>({});
  const demoEnabled = DEMO_AUTOFILL_VISIBLE;
  const totalSteps = 4 + stepOffset;
  const offsetStep = (step: number) => step + stepOffset;
  const draftStorageKey = useMemo(() => buildWizardDraftStorageKey('gas_service', jobId), [jobId]);
  useWizardStepHistory({
    enabled: true,
    key: `gas_service:${jobId}`,
    maxStep: 4,
    setStep,
    step,
  });

  useEffect(() => {
    if (!jobId) return;
    void tryUpdateJobRecord(jobId, {
      resume_certificate_type: 'gas_service',
      resume_step: step + stepOffset,
    });
  }, [jobId, step, stepOffset]);

  const boilerServiceDraft = useMemo<BoilerServiceDraftState>(
    () => ({
      step,
      completionDate,
      jobInfo,
      jobAddress,
      details,
      checks,
      checkComments,
      engineerSignature,
      engineerSignaturePath,
      customerSignature,
      customerSignaturePath,
      addressSearchQuery,
      customerAddressSearchQuery,
    }),
    [
      addressSearchQuery,
      checkComments,
      checks,
      completionDate,
      customerAddressSearchQuery,
      customerSignature,
      customerSignaturePath,
      details,
      engineerSignature,
      engineerSignaturePath,
      jobAddress,
      jobInfo,
      step,
    ],
  );
  // Signatures are intentionally excluded from the sync-dirty snapshot — they upload to
  // storage on draw and are written to the job at issue time, never via the background
  // sync actions. Including them stranded the issue button once the required Step-4
  // signature was drawn (nothing re-syncs a signature change). See the
  // matching note in certificate-wizard.tsx.
  const boilerServiceDraftSyncState = useMemo(
    () => ({
      completionDate,
      jobInfo,
      jobAddress,
      details,
      checks,
    }),
    [checks, completionDate, details, jobAddress, jobInfo],
  );

  const {
    clearDraft,
    hasUnsyncedChanges,
    isOnline,
    isReady: isDraftReady,
    localUpdatedAt,
    markSynced,
  } = useWizardDraft<BoilerServiceDraftState>({
    storageKey: draftStorageKey,
    state: boilerServiceDraft,
    syncState: boilerServiceDraftSyncState,
    onRestore: (draft) => {
      setStep(Math.min(4, Math.max(1, draft.step || initialStep)));
      setCompletionDate(draft.completionDate || completionDate);
      setJobInfo((prev) => ({ ...prev, ...(draft.jobInfo ?? {}) }));
      setJobAddress((prev) => ({ ...prev, ...(draft.jobAddress ?? {}) }));
      setDetails((prev) => ({ ...prev, ...(draft.details ?? {}) }));
      setChecks((prev) => ({ ...prev, ...(draft.checks ?? {}) }));
      setEngineerSignature(draft.engineerSignature ?? '');
      setEngineerSignaturePath(draft.engineerSignaturePath ?? '');
      setCustomerSignature(draft.customerSignature ?? '');
      setCustomerSignaturePath(draft.customerSignaturePath ?? '');
      setCheckComments(draft.checkComments ?? {});
      setAddressSearchQuery(draft.addressSearchQuery ?? '');
      setCustomerAddressSearchQuery(draft.customerAddressSearchQuery ?? '');
    },
  });

  const buildBoilerServiceDraftPersistencePayload = useCallback(() => {
    const serviceDate = jobAddress.job_visit_date || jobInfo.service_date || completionDate;
    const propertyAddress = composeAddress(
      jobAddress.job_address_line1,
      jobAddress.job_address_line2,
      jobAddress.job_address_city,
    );
    const nextInfo = {
      ...jobInfo,
      property_address: propertyAddress || jobInfo.property_address,
      postcode: jobAddress.job_postcode || jobInfo.postcode,
      service_date: serviceDate,
    };

    return {
      info: nextInfo,
      jobFields: {
        job_reference: jobAddress.job_reference,
        job_address_name: jobAddress.job_address_name,
        job_address_line1: jobAddress.job_address_line1,
        job_address_line2: jobAddress.job_address_line2,
        job_address_city: jobAddress.job_address_city,
        job_postcode: jobAddress.job_postcode,
        job_tel: jobAddress.job_tel,
        job_visit_date: serviceDate,
        completion_date: completionDate || serviceDate,
        engineer_signature: engineerSignature || engineerSignaturePath,
        engineer_signature_path: engineerSignaturePath,
        customer_signature: customerSignature || customerSignaturePath,
        customer_signature_path: customerSignaturePath,
      },
    };
  }, [completionDate, customerSignature, customerSignaturePath, engineerSignature, engineerSignaturePath, jobAddress, jobInfo]);

  const syncBoilerServiceOfflineDraft = useCallback(async () => {
    if (isOfflineDraftSyncing) return;
    setIsOfflineDraftSyncing(true);
    setOfflineDraftSyncError(null);

    try {
      const payload = buildBoilerServiceDraftPersistencePayload();
      await saveBoilerServiceJobInfo({ jobId, data: payload.info });
      await saveJobFields({ jobId, fields: payload.jobFields });
      await saveBoilerServiceDetails({ jobId, data: details });
      await saveBoilerServiceChecks({ jobId, data: checks });
      setJobInfo(payload.info);
      markSynced(
        { ...boilerServiceDraft, jobInfo: payload.info },
        { ...boilerServiceDraftSyncState, jobInfo: payload.info },
      );
      setOfflineDraftSyncErrorCount(0);
      pushToast({ title: 'Offline draft synced', variant: 'success' });
    } catch (error) {
      setOfflineDraftSyncError(error instanceof Error ? error.message : 'Could not sync offline draft.');
      setOfflineDraftSyncErrorCount((count) => count + 1);
    } finally {
      setIsOfflineDraftSyncing(false);
    }
  }, [
    buildBoilerServiceDraftPersistencePayload,
    boilerServiceDraft,
    boilerServiceDraftSyncState,
    checks,
    details,
    isOfflineDraftSyncing,
    jobId,
    markSynced,
    pushToast,
  ]);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      return;
    }

    if (!wasOfflineRef.current || !hasUnsyncedChanges || !isDraftReady || isOfflineDraftSyncing) return;
    wasOfflineRef.current = false;
    void syncBoilerServiceOfflineDraft();
  }, [hasUnsyncedChanges, isDraftReady, isOfflineDraftSyncing, isOnline, syncBoilerServiceOfflineDraft]);

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
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        const payload = (await response.json()) as AddressLookupApiResponse;
        if (!response.ok) {
          throw new Error(payload.error || 'Lookup failed');
        }

        const suggestions = payload.suggestions ?? [];
        setAddressSuggestions(suggestions);
        setSelectedAddressMatchId(null);
        setAddressSearchError(suggestions.length ? null : 'No addresses found. Try a postcode or add more detail.');
      } catch (error) {
        if (controller.signal.aborted) return;
        setAddressSuggestions([]);
        setSelectedAddressMatchId(null);
        setAddressSearchError(getAddressLookupErrorMessage(error, 'Try another search.'));
      } finally {
        if (!controller.signal.aborted) {
          setIsAddressLookupPending(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [deferredAddressSearchQuery]);

  useEffect(() => {
    if (!deferredCustomerAddressSearchQuery) {
      setCustomerAddressSuggestions([]);
      setSelectedCustomerAddressMatchId(null);
      setCustomerAddressSearchError(null);
      setIsCustomerAddressLookupPending(false);
      return;
    }

    if (deferredCustomerAddressSearchQuery.length < ADDRESS_SEARCH_MIN_QUERY_LENGTH) {
      setCustomerAddressSuggestions([]);
      setSelectedCustomerAddressMatchId(null);
      setCustomerAddressSearchError(`Type at least ${ADDRESS_SEARCH_MIN_QUERY_LENGTH} characters to search.`);
      setIsCustomerAddressLookupPending(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsCustomerAddressLookupPending(true);
      setCustomerAddressSearchError(null);

      try {
        const response = await fetch(`/api/address-search?q=${encodeURIComponent(deferredCustomerAddressSearchQuery)}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        const payload = (await response.json()) as AddressLookupApiResponse;
        if (!response.ok) {
          throw new Error(payload.error || 'Lookup failed');
        }

        const suggestions = payload.suggestions ?? [];
        setCustomerAddressSuggestions(suggestions);
        setSelectedCustomerAddressMatchId(null);
        setCustomerAddressSearchError(suggestions.length ? null : 'No addresses found. Try a postcode or add more detail.');
      } catch (error) {
        if (controller.signal.aborted) return;
        setCustomerAddressSuggestions([]);
        setSelectedCustomerAddressMatchId(null);
        setCustomerAddressSearchError(getAddressLookupErrorMessage(error, 'Try another search.'));
      } finally {
        if (!controller.signal.aborted) {
          setIsCustomerAddressLookupPending(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [deferredCustomerAddressSearchQuery]);

  const applianceProfile: ApplianceStepValues = {
    type: details.boiler_type ?? '',
    make: details.boiler_make ?? '',
    model: details.boiler_model ?? '',
    location: details.boiler_location ?? '',
    serial: details.serial_number ?? '',
    mountType: details.mount_type ?? '',
    gasType: normalizeGasType(details.gas_type ?? ''),
  };
  const handleApplianceProfileChange = (next: ApplianceStepValues) => {
    setDetails((prev) => ({
      ...prev,
      boiler_type: next.type ?? '',
      boiler_make: next.make ?? '',
      boiler_model: next.model ?? '',
      boiler_location: next.location ?? '',
      serial_number: next.serial ?? '',
      mount_type: next.mountType ?? '',
      gas_type: denormalizeGasType(next.gasType ?? ''),
    }));
  };

  const handleDemoFill = () => {
    if (!demoEnabled) return;
    startTransition(async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const nextServiceDue = checks.next_service_due || addOneYear(today);
        const demoInfo: typeof jobInfo = {
          ...jobInfo,
          ...BOILER_SERVICE_DEMO_INFO,
          customer_name: 'Jordan Smith',
          customer_company: 'Smith Lettings',
          customer_address_line1: '9 Office Park',
          customer_address_line2: 'Floor 2',
          customer_city: 'London',
          customer_postcode: 'SE1 2BB',
          customer_phone: '07700 900456',
          property_address: '42 Station Road',
          postcode: 'E2 2AA',
          service_date: today,
        };
        const demoJobAddress: BoilerServiceJobAddress = {
          ...BOILER_SERVICE_DEMO_JOB_ADDRESS,
          job_visit_date: today,
        };
        const demoDetails = { ...BOILER_SERVICE_DEMO_DETAILS };
        const demoChecks = { ...BOILER_SERVICE_DEMO_CHECKS, next_service_due: nextServiceDue };
        const nextCompletionDate = today;
        const demoEngineerSignature = makeDemoSignatureDataUrl('Engineer signature', '#0f172a');
        const demoCustomerSignature = makeDemoSignatureDataUrl('Customer signature', '#1d4ed8');

        setJobInfo(demoInfo);
        setJobAddress(demoJobAddress);
        setDetails(demoDetails);
        setChecks(demoChecks);
        setCompletionDate(nextCompletionDate);
        setEngineerSignature(demoEngineerSignature);
        setCustomerSignature(demoCustomerSignature);

        await saveBoilerServiceJobInfo({ jobId, data: demoInfo });
        await saveJobFields({
          jobId,
          fields: {
            job_reference: demoJobAddress.job_reference,
            job_address_name: demoJobAddress.job_address_name,
            job_address_line1: demoJobAddress.job_address_line1,
            job_address_line2: demoJobAddress.job_address_line2,
            job_address_city: demoJobAddress.job_address_city,
            job_postcode: demoJobAddress.job_postcode,
            job_tel: demoJobAddress.job_tel,
            job_visit_date: demoJobAddress.job_visit_date,
            completion_date: nextCompletionDate,
            engineer_signature: demoEngineerSignature,
            customer_signature: demoCustomerSignature,
          },
        });
        await saveBoilerServiceDetails({ jobId, data: demoDetails });
        await saveBoilerServiceChecks({ jobId, data: demoChecks });
        pushToast({ title: 'Boiler Service autofill applied', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Could not autofill test data',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleEvidenceUpload =
    (category: BoilerServicePhotoCategory) =>
    (file: File) => {
      startTransition(async () => {
        const data = new FormData();
        data.append('jobId', jobId);
        data.append('category', category);
        data.append('file', file);
        try {
          await uploadBoilerServicePhoto(data);
          pushToast({ title: 'Photo saved', variant: 'success' });
        } catch (error) {
          pushToast({
            title: 'Upload failed',
            description: error instanceof Error ? error.message : 'Please try again.',
            variant: 'error',
          });
        }
      });
    };

  const handleAddressMatchSelect = async (suggestion: AddressLookupSuggestion) => {
    setIsAddressLookupPending(true);
    setSelectedAddressMatchId(suggestion.id);
    setAddressSearchError(null);
    try {
      const response = await fetch(`/api/address-search?id=${encodeURIComponent(suggestion.id)}`, {
        headers: { Accept: 'application/json' },
      });
      const payload = (await response.json()) as AddressLookupApiResponse;
      if (!response.ok || !payload.address) {
        throw new Error(payload.error || 'Lookup failed');
      }
      const address = payload.address;
      setJobAddress((prev) => ({
        ...prev,
        job_address_name: prev.job_address_name.trim() || address.name,
        job_address_line1: address.line1,
        job_address_line2: address.line2,
        job_address_city: address.city,
        job_postcode: address.postcode || prev.job_postcode,
      }));
      setJobInfo((prev) => ({
        ...prev,
        property_address: address.summary || prev.property_address,
        postcode: address.postcode || prev.postcode,
      }));
      setAddressSearchQuery(address.line1 || suggestion.label);
      setAddressSuggestions([]);
      pushToast({ title: 'Address selected', variant: 'success' });
    } catch (error) {
      setSelectedAddressMatchId(null);
      setAddressSearchError(error instanceof Error ? error.message : 'Try again.');
      pushToast({
        title: 'Address not found',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'error',
      });
    } finally {
      setIsAddressLookupPending(false);
    }
  };

  const handleCustomerAddressMatchSelect = async (suggestion: AddressLookupSuggestion) => {
    setIsCustomerAddressLookupPending(true);
    setSelectedCustomerAddressMatchId(suggestion.id);
    setCustomerAddressSearchError(null);
    try {
      const response = await fetch(`/api/address-search?id=${encodeURIComponent(suggestion.id)}`, {
        headers: { Accept: 'application/json' },
      });
      const payload = (await response.json()) as AddressLookupApiResponse;
      if (!response.ok || !payload.address) {
        throw new Error(payload.error || 'Lookup failed');
      }
      const address = payload.address;
      setJobInfo((prev) => ({
        ...prev,
        customer_address_line1: address.line1,
        customer_address_line2: address.line2,
        customer_city: address.city,
        customer_postcode: address.postcode || prev.customer_postcode,
      }));
      setCustomerAddressSearchQuery(address.line1 || suggestion.label);
      setCustomerAddressSuggestions([]);
      pushToast({ title: 'Client address selected', variant: 'success' });
    } catch (error) {
      setSelectedCustomerAddressMatchId(null);
      setCustomerAddressSearchError(error instanceof Error ? error.message : 'Try again.');
      pushToast({
        title: 'Address not found',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'error',
      });
    } finally {
      setIsCustomerAddressLookupPending(false);
    }
  };

  const copyJobAddressToCustomerAddress = () => {
    setJobInfo((prev) => ({
      ...prev,
      customer_address_line1: jobAddress.job_address_line1,
      customer_address_line2: jobAddress.job_address_line2,
      customer_city: jobAddress.job_address_city,
      customer_postcode: jobAddress.job_postcode,
    }));
    setCustomerAddressSearchQuery(jobAddress.job_address_line1);
    setCustomerAddressSearchError(null);
    setSelectedCustomerAddressMatchId(null);
    setCustomerAddressSuggestions([]);
    pushToast({ title: 'Job address copied to landlord details', variant: 'success' });
  };

  const handleJobInfoNext = () => {
    startTransition(async () => {
      try {
        const payload = buildBoilerServiceDraftPersistencePayload();
        if (!isOnline) {
          setJobInfo(payload.info);
          setStep(2);
          pushToast({
            title: 'Saved on this device',
            description: 'You are offline. This service will sync when your connection returns.',
            variant: 'default',
          });
          return;
        }

        await saveBoilerServiceJobInfo({ jobId, data: payload.info });
        await saveJobFields({ jobId, fields: payload.jobFields });
        setJobInfo(payload.info);
        setStep(2);
        markSynced(
          { ...boilerServiceDraft, step: 2, jobInfo: payload.info },
          { ...boilerServiceDraftSyncState, jobInfo: payload.info },
        );
        pushToast({ title: 'Saved job and client details', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Could not save job details',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleDetailsNext = () => {
    startTransition(async () => {
      try {
        if (!isOnline) {
          setStep(3);
          pushToast({
            title: 'Saved on this device',
            description: 'You are offline. Appliance details will sync when your connection returns.',
            variant: 'default',
          });
          return;
        }
        await saveBoilerServiceDetails({ jobId, data: details });
        setStep(3);
        markSynced(
          { ...boilerServiceDraft, step: 3, details },
          { ...boilerServiceDraftSyncState, details },
        );
        pushToast({ title: 'Saved appliance details', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Could not save details',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleChecksNext = () => {
    const commentableItems = [...SAFETY_CHECK_ITEMS, ...ADVICE_CHECK_ITEMS];
    const compiled = commentableItems
      .filter((item) => checks[item.key] === 'no' && checkComments[item.key]?.trim())
      .map((item) => `${item.label}: ${checkComments[item.key].trim()}`)
      .join('\n');
    const nextChecks = compiled && !checks.recommendations.trim()
      ? { ...checks, recommendations: compiled }
      : checks;
    if (nextChecks !== checks) setChecks(nextChecks);

    startTransition(async () => {
      try {
        if (!isOnline) {
          setStep(4);
          pushToast({
            title: 'Saved on this device',
            description: 'You are offline. Checks will sync when your connection returns.',
            variant: 'default',
          });
          return;
        }
        await saveBoilerServiceChecks({ jobId, data: nextChecks });
        setStep(4);
        markSynced(
          { ...boilerServiceDraft, step: 4, checks: nextChecks },
          { ...boilerServiceDraftSyncState, checks: nextChecks },
        );
        pushToast({ title: 'Saved checks', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Could not save checks',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const persistBeforePdf = async () => {
    const serviceDate = completionDate || jobAddress.job_visit_date || jobInfo.service_date;
    const propertyAddress = composeAddress(
      jobAddress.job_address_line1,
      jobAddress.job_address_line2,
      jobAddress.job_address_city,
    );
    const infoToSave = {
      ...jobInfo,
      property_address: propertyAddress || jobInfo.property_address,
      postcode: jobAddress.job_postcode || jobInfo.postcode,
      service_date: serviceDate,
    };
    await saveBoilerServiceJobInfo({ jobId, data: infoToSave });
    await saveJobFields({
      jobId,
      fields: {
        job_reference: jobAddress.job_reference,
        job_address_name: jobAddress.job_address_name,
        job_address_line1: jobAddress.job_address_line1,
        job_address_line2: jobAddress.job_address_line2,
        job_address_city: jobAddress.job_address_city,
        job_postcode: jobAddress.job_postcode,
        job_tel: jobAddress.job_tel,
        job_visit_date: serviceDate,
        completion_date: completionDate || serviceDate,
        engineer_signature: engineerSignature || engineerSignaturePath,
        engineer_signature_path: engineerSignaturePath,
        customer_signature: customerSignature || customerSignaturePath,
        customer_signature_path: customerSignaturePath,
      },
    });
    await saveBoilerServiceDetails({ jobId, data: details });
    await saveBoilerServiceChecks({ jobId, data: checks });
  };

  const goBackOneStep = () => setStep((prev) => Math.max(1, prev - 1));

  const showBoilerValidationError = (error: unknown) => {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (!message.includes('validation failed') && !message.includes('is required')) return false;

    const validationTargets: MissingIssueItem[] = [
      ...boilerMissingItems,
      { id: 'engineer-signature', label: 'Engineer signature', step: 4 },
      { id: 'customer-signature', label: 'Customer signature', step: 4 },
      { id: 'service-summary', label: 'Service summary', step: 4 },
      { id: 'recommendations', label: 'Recommendations', step: 4 },
      { id: 'property-address', label: 'Property address', step: 1 },
      { id: 'service-date', label: 'Service date', step: 1 },
      { id: 'boiler-make', label: 'Boiler make', step: 2 },
      { id: 'boiler-model', label: 'Boiler model', step: 2 },
      { id: 'boiler-location', label: 'Boiler location', step: 2 },
    ];
    const target =
      validationTargets.find((item) => message.includes(item.label.toLowerCase())) ??
      validationTargets.find((item) => message.includes(item.id.replace(/-/g, ' ')));

    pushToast({
      title: 'Complete required item first',
      description: target ? `${target.label} is missing.` : 'Please review the required fields before generating the certificate.',
      variant: 'error',
    });
    if (target?.step) setStep(target.step);
    return true;
  };

  const handleGenerate = () => {
    if (!isOnline) {
      setQueuedIssue(true);
      pushToast({
        title: 'Issue queued',
        description: 'This boiler service record is saved on this device and will continue when you are back online.',
        variant: 'default',
      });
      return;
    }
    startTransition(async () => {
      try {
        if (boilerMissingItems.length > 0) {
          pushToast({
            title: 'Complete required item first',
            description: boilerMissingItems[0]?.label ?? 'Please check the required fields and try again.',
            variant: 'error',
          });
          return;
        }
        await persistBeforePdf();
        const finalInfo = { ...jobInfo, service_date: completionDate || jobInfo.service_date };
        await saveBoilerServiceJobInfo({ jobId, data: finalInfo });
        const result = await generateGasServicePdf({ jobId, previewOnly: false });
        if ('error' in result && result.error === 'limit_reached') {
          setLimitReachedMessage(result.message ?? 'You have reached your monthly certificate limit.');
          return;
        }
        if (!('jobId' in result)) return;
        const { jobId: resultJobId } = result;
        clearDraft();
        pushToast({
          title: 'Boiler Service generated successfully',
          description: (
            <Link href={`/jobs/${resultJobId}/pdf?certificateType=gas_service`} className="text-[var(--action)] underline">
              Open document preview
            </Link>
          ),
          variant: 'success',
        });
        router.push(`/jobs/${resultJobId}/complete`);
      } catch (error) {
        if (showBoilerValidationError(error)) return;
        pushToast({
          title: 'Could not generate PDF',
          description: error instanceof Error ? error.message : 'Please check required fields and try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleGenerateRef = useRef(handleGenerate);
  useEffect(() => {
    handleGenerateRef.current = handleGenerate;
  });

  const setCheckValue = (key: keyof BoilerServiceChecks, value: string) => {
    setChecks((prev) => ({ ...prev, [key]: value }));
  };

  const setCheckComment = (key: string, value: string) => {
    setCheckComments((prev) => ({ ...prev, [key]: value }));
  };

  const applyServiceDate = (value: string) => {
    const nextDue = addOneYear(value);
    setJobAddress((prev) => ({ ...prev, job_visit_date: value }));
    setJobInfo((prev) => ({ ...prev, service_date: value }));
    setCompletionDate(value);
    if (nextDue) {
      setChecks((prev) => ({ ...prev, next_service_due: nextDue }));
    }
  };

  const applyVoiceReadings = (values: Partial<Cp12VoiceReadingsParsed>) => {
    setChecks((prev) => ({
      ...prev,
      operating_pressure_mbar: values.workingPressure ?? prev.operating_pressure_mbar,
      heat_input: values.heatInput ?? prev.heat_input,
      high_combustion_co_ppm: values.highCoPpm ?? values.coPpm ?? prev.high_combustion_co_ppm,
      high_combustion_co2: values.highCo2Percent ?? prev.high_combustion_co2,
      high_combustion_ratio: values.highRatio ?? prev.high_combustion_ratio,
      low_combustion_co_ppm: values.lowCoPpm ?? prev.low_combustion_co_ppm,
      low_combustion_co2: values.lowCo2Percent ?? prev.low_combustion_co2,
      low_combustion_ratio: values.lowRatio ?? prev.low_combustion_ratio,
    }));
  };

  const signatureUpload =
    (role: 'engineer' | 'customer') =>
    (file: File) => {
      const data = new FormData();
      data.append('jobId', jobId);
      data.append('role', role);
      data.append('file', file);
      startTransition(async () => {
        try {
          const { url, path } = await uploadSignature(data);
          if (role === 'engineer') {
            setEngineerSignature(url);
            setEngineerSignaturePath(path);
          }
          if (role === 'customer') {
            setCustomerSignature(url);
            setCustomerSignaturePath(path);
          }
          pushToast({ title: `${role === 'engineer' ? 'Engineer' : 'Customer'} signature saved`, variant: 'success' });
        } catch (error) {
          pushToast({
            title: 'Could not save signature',
            description: error instanceof Error ? error.message : 'Please try again.',
            variant: 'error',
          });
        }
      });
    };

  const combustionReadingFields: Array<keyof BoilerServiceChecks> = [
    'high_combustion_co_ppm',
    'high_combustion_co2',
    'high_combustion_ratio',
    'low_combustion_co_ppm',
    'low_combustion_co2',
    'low_combustion_ratio',
  ];
  const safetyNumericFields: Array<keyof BoilerServiceChecks> = ['operating_pressure_mbar', 'heat_input'];
  const hasValue = useCallback((value: string) => value.trim().length > 0, []);
  const boilerMissingItems = useMemo<MissingIssueItem[]>(() => {
    const items: MissingIssueItem[] = [];
    const add = (id: string, label: string, ok: boolean, step?: number, href?: string) => {
      if (!ok) items.push({ id, label, step, href });
    };
    const serviceDate = completionDate || jobInfo.service_date || jobAddress.job_visit_date;
    const propertyAddressOk =
      hasValue(jobInfo.property_address) || (hasValue(jobAddress.job_address_line1) && hasValue(jobAddress.job_postcode));

    add('property-address', 'Property address', propertyAddressOk, 1);
    add('service-date', 'Service date', hasValue(serviceDate), 1);
    add('engineer-name', 'Engineer name in profile', hasValue(jobInfo.engineer_name), undefined, '/settings');
    add('gas-safe-number', 'Gas Safe number in profile', hasValue(jobInfo.gas_safe_number), undefined, '/settings');
    add('boiler-make', 'Boiler make', hasValue(details.boiler_make), 2);
    add('boiler-model', 'Boiler model', hasValue(details.boiler_model), 2);
    add('boiler-location', 'Boiler location', hasValue(details.boiler_location), 2);
    add('service-summary', 'Service summary', hasValue(checks.service_summary), 4);
    add('recommendations', 'Recommendations', hasValue(checks.recommendations), 4);
    if (checks.defects_found === 'yes') {
      add('defects-details', 'Defect details', hasValue(checks.defects_details), 4);
    }
    add('engineer-signature', 'Engineer signature', hasValue(engineerSignature) || hasValue(engineerSignaturePath), 4);
    add('customer-signature', 'Customer signature', hasValue(customerSignature) || hasValue(customerSignaturePath), 4);
    return items;
  }, [
    checks.defects_details,
    checks.defects_found,
    checks.recommendations,
    checks.service_summary,
    completionDate,
    customerSignature,
    customerSignaturePath,
    details.boiler_location,
    details.boiler_make,
    details.boiler_model,
    engineerSignature,
    engineerSignaturePath,
    hasValue,
    jobAddress.job_address_line1,
    jobAddress.job_postcode,
    jobAddress.job_visit_date,
    jobInfo.engineer_name,
    jobInfo.gas_safe_number,
    jobInfo.property_address,
    jobInfo.service_date,
  ]);
  const firstBoilerMissing = boilerMissingItems[0];

  useEffect(() => {
    if (!queuedIssue || !isOnline || isPending || boilerMissingItems.length > 0) return;
    setQueuedIssue(false);
    handleGenerateRef.current();
  }, [boilerMissingItems.length, isOnline, isPending, queuedIssue]);

  const formatNextServiceDate = (dateStr: string) => {
    if (!dateStr) return dateStr;
    const d = new Date(`${dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const boilerRequiredItemsPanel = boilerMissingItems.length > 0 ? (
    <div className="rounded-[16px] border-[0.5px] border-[rgba(186,117,23,0.4)] bg-[rgba(186,117,23,0.15)] p-4">
      <p className="text-[13px] font-medium text-[#EF9F27]">
        {boilerMissingItems.length} required item{boilerMissingItems.length === 1 ? '' : 's'} missing
      </p>
      <div className="mt-3 space-y-2">
        {boilerMissingItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-[8px] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-[13px]">
            <span className="font-medium text-[var(--color-text-primary)]">{item.label}</span>
            {item.href ? (
              <Link href={item.href} className="rounded-full px-3 py-1 text-[12px] font-medium text-[#1a7a52]">
                Open
              </Link>
            ) : item.step ? (
              <button type="button" className="rounded-full px-3 py-1 text-[12px] font-medium text-[#1a7a52]" onClick={() => setStep(item.step!)}>
                Go
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  ) : (
    <div className="flex items-center gap-2 rounded-[16px] border-[0.5px] border-[var(--color-action)]/20 bg-[var(--color-action-bg)] p-4">
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-action)]">
        <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
      <p className="text-[13px] font-medium text-[var(--color-action)]">All required items complete</p>
    </div>
  );
  const yesNoButtonStyle = (choice: string, currentValue: string): CSSProperties => {
    const isActive = currentValue === choice;
    if (!isActive) {
      return {
        padding: '7px 18px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 400,
        background: 'var(--color-background-tertiary)',
        color: 'var(--color-text-secondary)',
        border: '1px solid var(--color-border-primary)',
      };
    }
    return {
      padding: '7px 18px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 500,
      background: choice === 'yes' ? '#0a3d26' : '#3d0a0a',
      color: choice === 'yes' ? '#5DCAA5' : '#F09595',
      border: choice === 'yes' ? '0.5px solid #1D9E75' : '0.5px solid #A32D2D',
    };
  };

  const renderCheckToggle = (item: CheckItem) => (
    <div
      key={item.key}
      className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-3 py-2"
    >
      <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{item.label}</p>
      <div className="flex gap-2">
        {(['yes', 'no'] as const).map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={() => setCheckValue(item.key, choice)}
            style={yesNoButtonStyle(choice, checks[item.key] ?? '')}
          >
            {choice === 'yes' ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  );
  const renderCheckToggleWithComment = (item: CheckItem) => (
    <div
      key={item.key}
      className="overflow-hidden rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
        <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{item.label}</p>
        <div className="flex gap-2">
          {(['yes', 'no'] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => setCheckValue(item.key, choice)}
              style={yesNoButtonStyle(choice, checks[item.key] ?? '')}
            >
              {choice === 'yes' ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      </div>
      {checks[item.key] === 'no' ? (
        <div className="border-t-[0.5px] border-[var(--color-border-tertiary)] px-3 pb-3 pt-2">
          <Textarea
            value={checkComments[item.key] ?? ''}
            onChange={(e) => setCheckComment(item.key, e.target.value)}
            placeholder="Note the reason — added to recommendations"
            className="min-h-[52px] text-[12px]"
          />
        </div>
      ) : null}
    </div>
  );
  const readingsCompleted = combustionReadingFields.filter((key) => hasValue(checks[key] ?? '')).length;
  const safetyCompleted =
    SAFETY_CHECK_ITEMS.filter((item) => hasValue(checks[item.key] ?? '')).length +
    safetyNumericFields.filter((key) => hasValue(checks[key] ?? '')).length;
  const safetyTotal = SAFETY_CHECK_ITEMS.length + safetyNumericFields.length;
  const centralHeatingCompleted = CENTRAL_HEATING_CHECK_ITEMS.filter((item) => hasValue(checks[item.key] ?? '')).length;
  const adviceCompleted = ADVICE_CHECK_ITEMS.filter((item) => hasValue(checks[item.key] ?? '')).length;
  const summaryComplete = hasValue(checks.service_summary) && hasValue(checks.recommendations);
  const defectsActive = (checks.defects_found ?? '') === 'yes';
  const defectsComplete = !defectsActive || hasValue(checks.defects_details ?? '');
  const nextServiceComplete = hasValue(checks.next_service_due ?? '');
  const sectionOrder = [
    { key: 'readings', complete: readingsCompleted === combustionReadingFields.length },
    { key: 'safety', complete: safetyCompleted === safetyTotal },
    { key: 'central-heating', complete: centralHeatingCompleted === CENTRAL_HEATING_CHECK_ITEMS.length },
    { key: 'advice', complete: adviceCompleted === ADVICE_CHECK_ITEMS.length },
    { key: 'summary', complete: summaryComplete },
    { key: 'defects', complete: defectsComplete },
    { key: 'next', complete: nextServiceComplete },
  ];
  const firstIncompleteKey = sectionOrder.find((section) => !section.complete)?.key ?? 'readings';
  const offlineDraftBanner = (
    <OfflineDraftBanner
      hasUnsyncedChanges={hasUnsyncedChanges}
      isOnline={isOnline}
      isSyncing={isOfflineDraftSyncing}
      lastSavedAt={localUpdatedAt}
      syncError={offlineDraftSyncError}
      syncErrorCount={offlineDraftSyncErrorCount}
    />
  );

  return (
    <>
      {step === 1 ? (
        <WizardLayout
          step={offsetStep(1)}
          total={totalSteps}
          title="Job Address & Client"
          status="Visit details"
          actionsHideWhenVisibleId="boiler-step1-footer-actions"
          actions={
            <button
              type="button"
              onClick={handleJobInfoNext}
              disabled={isPending}
              className="flex items-center gap-[5px] rounded-[8px] bg-[#111] px-[16px] py-[7px] text-[13px] font-medium text-white disabled:opacity-50"
            >
              Next
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          }
        >
          <div className="space-y-4">
            {offlineDraftBanner}
            {demoEnabled ? (
              <div className="flex justify-end">
                <Button type="button" variant="outline" className="rounded-[6px] text-xs" onClick={handleDemoFill} disabled={isPending}>
                  Autofill test Boiler Service
                </Button>
              </div>
            ) : null}
            <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Job Address</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-[11px] tracking-[0.5px] text-[var(--color-text-tertiary)]">
                    Service date
                  </label>
                  <Input
                    type="date"
                    value={jobAddress.job_visit_date || jobInfo.service_date}
                    onChange={(e) => applyServiceDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] tracking-[0.5px] text-[var(--color-text-tertiary)]">
                    Tenant name
                  </label>
                  <Input
                    value={jobAddress.job_address_name}
                    onChange={(e) => setJobAddress((prev) => ({ ...prev, job_address_name: e.target.value }))}
                    placeholder="Tenant name"
                    className="mt-1"
                  />
                </div>
                <div className="relative md:col-span-2">
                  <label className="text-[11px] tracking-[0.5px] text-[var(--color-text-tertiary)]">
                    Address lookup / line 1
                  </label>
                  <Input
                    value={addressSearchQuery}
                    onChange={(e) => {
                      const value = e.target.value;
                      setAddressSearchQuery(value);
                      setAddressSearchError(null);
                      setSelectedAddressMatchId(null);
                      setJobAddress((prev) => ({ ...prev, job_address_line1: value }));
                      setJobInfo((prev) => ({
                        ...prev,
                        property_address: composeAddress(value, jobAddress.job_address_line2, jobAddress.job_address_city),
                      }));
                    }}
                    placeholder="Start typing address or postcode"
                    className="mt-1"
                  />
                  {isAddressLookupPending && !addressSuggestions.length ? (
                    <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-[8px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-3 py-2 text-[13px] text-[var(--color-text-primary)]">
                      Searching addresses…
                    </div>
                  ) : null}
                  {addressSuggestions.length ? (
                    <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-[8px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
                      <div className="max-h-72 overflow-y-auto">
                        {addressSuggestions.map((suggestion) => {
                          const isSelected = selectedAddressMatchId === suggestion.id;
                          return (
                            <button
                              key={suggestion.id}
                              type="button"
                              onClick={() => void handleAddressMatchSelect(suggestion)}
                              className={`w-full border-b-[0.5px] border-[var(--color-border-tertiary)] px-3 py-2 text-left transition last:border-0 ${
                                isSelected
                                  ? 'bg-[var(--color-action-bg)] text-[var(--color-action)]'
                                  : 'hover:bg-[var(--color-action-bg)] text-[var(--color-text-primary)]'
                              }`}
                            >
                              <div className="text-[13px] font-medium">{suggestion.label}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {addressSearchError ? <p className="mt-2 text-[12px] text-[var(--color-text-tertiary)]">{formatAddressError(addressSearchError)}</p> : null}
                </div>
                <div className="md:col-span-2">
                  <label className="text-[11px] tracking-[0.5px] text-[var(--color-text-tertiary)]">
                    Address line 2
                  </label>
                  <Input
                    value={jobAddress.job_address_line2}
                    onChange={(e) => {
                      const value = e.target.value;
                      setJobAddress((prev) => ({ ...prev, job_address_line2: value }));
                      setJobInfo((prev) => ({
                        ...prev,
                        property_address: composeAddress(jobAddress.job_address_line1, value, jobAddress.job_address_city),
                      }));
                    }}
                    placeholder="Optional"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] tracking-[0.5px] text-[var(--color-text-tertiary)]">City / town</label>
                  <Input
                    value={jobAddress.job_address_city}
                    onChange={(e) => {
                      const value = e.target.value;
                      setJobAddress((prev) => ({ ...prev, job_address_city: value }));
                      setJobInfo((prev) => ({
                        ...prev,
                        property_address: composeAddress(jobAddress.job_address_line1, jobAddress.job_address_line2, value),
                      }));
                    }}
                    placeholder="London"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] tracking-[0.5px] text-[var(--color-text-tertiary)]">Postcode</label>
                  <Input
                    value={jobAddress.job_postcode}
                    onChange={(e) => {
                      const value = e.target.value;
                      setJobAddress((prev) => ({ ...prev, job_postcode: value }));
                      setJobInfo((prev) => ({ ...prev, postcode: value }));
                    }}
                    placeholder="SW1A 1AA"
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[11px] tracking-[0.5px] text-[var(--color-text-tertiary)]">Site telephone</label>
                  <Input
                    value={jobAddress.job_tel}
                    onChange={(e) => setJobAddress((prev) => ({ ...prev, job_tel: e.target.value }))}
                    placeholder="020 7946 0958"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
            <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Client / Landlord</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-[6px] text-xs"
                    onClick={copyJobAddressToCustomerAddress}
                    disabled={
                      !jobAddress.job_address_line1 &&
                      !jobAddress.job_address_line2 &&
                      !jobAddress.job_address_city &&
                      !jobAddress.job_postcode
                    }
                  >
                    Copy job address details
                  </Button>
                </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-[11px] tracking-[0.5px] text-[var(--color-text-tertiary)]">Name</label>
                  <Input
                    value={jobInfo.customer_name}
                    onChange={(e) => setJobInfo((prev) => ({ ...prev, customer_name: e.target.value }))}
                    placeholder="Client name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] tracking-[0.5px] text-[var(--color-text-tertiary)]">Company</label>
                  <Input
                    value={jobInfo.customer_company}
                    onChange={(e) => setJobInfo((prev) => ({ ...prev, customer_company: e.target.value }))}
                    placeholder="Optional"
                    className="mt-1"
                  />
                </div>
                <div className="relative md:col-span-2">
                  <label className="text-[11px] tracking-[0.5px] text-[var(--color-text-tertiary)]">
                    Address lookup / line 1
                  </label>
                  <Input
                    value={customerAddressSearchQuery}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCustomerAddressSearchQuery(value);
                      setCustomerAddressSearchError(null);
                      setSelectedCustomerAddressMatchId(null);
                      setJobInfo((prev) => ({ ...prev, customer_address_line1: value }));
                    }}
                    placeholder="Start typing address or postcode"
                    className="mt-1"
                  />
                  {isCustomerAddressLookupPending && !customerAddressSuggestions.length ? (
                    <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-[8px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-3 py-2 text-[13px] text-[var(--color-text-primary)]">
                      Searching addresses…
                    </div>
                  ) : null}
                  {customerAddressSuggestions.length ? (
                    <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-[8px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
                      <div className="max-h-72 overflow-y-auto">
                        {customerAddressSuggestions.map((suggestion) => {
                          const isSelected = selectedCustomerAddressMatchId === suggestion.id;
                          return (
                            <button
                              key={suggestion.id}
                              type="button"
                              onClick={() => void handleCustomerAddressMatchSelect(suggestion)}
                              className={`w-full border-b-[0.5px] border-[var(--color-border-tertiary)] px-3 py-2 text-left transition last:border-0 ${
                                isSelected
                                  ? 'bg-[var(--color-action-bg)] text-[var(--color-action)]'
                                  : 'hover:bg-[var(--color-action-bg)] text-[var(--color-text-primary)]'
                              }`}
                            >
                              <div className="text-[13px] font-medium">{suggestion.label}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {customerAddressSearchError ? <p className="mt-2 text-[12px] text-[var(--color-text-tertiary)]">{formatAddressError(customerAddressSearchError)}</p> : null}
                </div>
                <div className="md:col-span-2">
                  <label className="text-[11px] tracking-[0.5px] text-[var(--color-text-tertiary)]">
                    Address line 2
                  </label>
                  <Input
                    value={jobInfo.customer_address_line2}
                    onChange={(e) => setJobInfo((prev) => ({ ...prev, customer_address_line2: e.target.value }))}
                    placeholder="Optional"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] tracking-[0.5px] text-[var(--color-text-tertiary)]">City / town</label>
                  <Input
                    value={jobInfo.customer_city}
                    onChange={(e) => setJobInfo((prev) => ({ ...prev, customer_city: e.target.value }))}
                    placeholder="London"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] tracking-[0.5px] text-[var(--color-text-tertiary)]">Postcode</label>
                  <Input
                    value={jobInfo.customer_postcode}
                    onChange={(e) => setJobInfo((prev) => ({ ...prev, customer_postcode: e.target.value }))}
                    placeholder="SW1A 1AA"
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[11px] tracking-[0.5px] text-[var(--color-text-tertiary)]">Tel. No.</label>
                  <Input
                    value={jobInfo.customer_phone}
                    onChange={(e) => setJobInfo((prev) => ({ ...prev, customer_phone: e.target.value }))}
                    placeholder="Optional"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </div>
          <div id="boiler-step1-footer-actions" className="sticky bottom-0 z-10 mt-6 border-t-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-4 py-3">
            <button
              type="button"
              onClick={handleJobInfoNext}
              disabled={isPending}
              className="flex h-[44px] w-full items-center justify-center gap-[6px] rounded-[10px] bg-[#111] text-[14px] font-medium text-white disabled:opacity-50"
            >
              Next → Appliance details
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </WizardLayout>
      ) : null}

      {step === 2 ? (
        <WizardLayout
          step={offsetStep(2)}
          total={totalSteps}
          title="Appliance details"
          status="Appliance profile"
          onBack={goBackOneStep}
          actionsHideWhenVisibleId="boiler-step2-footer-actions"
          actions={
            <button
              type="button"
              onClick={handleDetailsNext}
              disabled={isPending}
              className="flex items-center gap-[5px] rounded-[8px] bg-[#111] px-[16px] py-[7px] text-[13px] font-medium text-white disabled:opacity-50"
            >
              Next
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          }
        >
          <div className="space-y-4">
            {offlineDraftBanner}
            {demoEnabled ? (
              <div className="flex justify-end">
                <Button type="button" variant="outline" className="rounded-[6px] text-xs" onClick={handleDemoFill} disabled={isPending}>
                  Autofill test Boiler Service
                </Button>
              </div>
            ) : null}
            <ApplianceStep
              appliance={applianceProfile}
              onApplianceChange={handleApplianceProfileChange}
              typeOptions={[...BOILER_SERVICE_TYPES]}
              allowMultiple={false}
              showExtendedFields={false}
              showYear={false}
              applyExtendedDefaults={false}
              inlineEditor
            />
          </div>
          <div id="boiler-step2-footer-actions" className="sticky bottom-0 z-10 mt-6 flex gap-[8px] border-t-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-4 py-3">
            <button
              type="button"
              onClick={goBackOneStep}
              disabled={isPending}
              className="flex h-[44px] flex-1 items-center justify-center rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-transparent text-[14px] text-[var(--color-text-secondary)] disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleDetailsNext}
              disabled={isPending}
              className="flex h-[44px] flex-[2] items-center justify-center gap-[6px] rounded-[10px] bg-[#111] text-[14px] font-medium text-white disabled:opacity-50"
            >
              Next → Checks
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </WizardLayout>
      ) : null}

      {step === 3 ? (
        <WizardLayout
          step={offsetStep(3)}
          total={totalSteps}
          title="Checks & Readings"
          status="On-site checks"
          onBack={goBackOneStep}
          actionsHideWhenVisibleId="boiler-step3-footer-actions"
          actions={
            <button
              type="button"
              onClick={handleChecksNext}
              disabled={isPending}
              className="flex items-center gap-[5px] rounded-[8px] bg-[#111] px-[16px] py-[7px] text-[13px] font-medium text-white disabled:opacity-50"
            >
              Next
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          }
        >
          <div className="space-y-4">
          {offlineDraftBanner}
          {demoEnabled ? (
            <div className="mb-3 flex justify-end">
              <Button type="button" variant="outline" className="rounded-[6px] text-xs" onClick={handleDemoFill} disabled={isPending}>
                Autofill test Boiler Service
              </Button>
            </div>
          ) : null}
          <CollapsibleSection
            title="High / Low combustion readings"
            subtitle={`${readingsCompleted}/${combustionReadingFields.length} readings`}
            defaultOpen={firstIncompleteKey === 'readings'}
          >
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.5px] text-[rgba(255,255,255,0.38)]">FGA readings</p>
              <Cp12VoiceReadings
                jobId={jobId}
                scope="high"
                buttonLabel="Speak high"
                buttonClassName="h-7 rounded-[6px] px-3 text-[11px]"
                onApply={applyVoiceReadings}
              />
            </div>
            <p className="mb-3 text-[11px] leading-[1.5] text-[rgba(255,255,255,0.28)]">Speak readings in order with small pauses between each value.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <UnitNumberInput
                label="CO ppm"
                value={checks.high_combustion_co_ppm}
                onChange={(value) => setCheckValue('high_combustion_co_ppm', value)}
                unit="ppm"
              />
              <UnitNumberInput
                label="CO₂ %"
                value={checks.high_combustion_co2}
                onChange={(value) => setCheckValue('high_combustion_co2', value)}
                unit="%"
              />
              <UnitNumberInput
                label="Ratio"
                value={checks.high_combustion_ratio}
                onChange={(value) => setCheckValue('high_combustion_ratio', value)}
                unit="ratio"
              />
              <UnitNumberInput
                label="CO ppm"
                value={checks.low_combustion_co_ppm}
                onChange={(value) => setCheckValue('low_combustion_co_ppm', value)}
                unit="ppm"
                labelAction={
                  <Cp12VoiceReadings
                    jobId={jobId}
                    scope="low"
                    buttonLabel="Speak low"
                    buttonClassName="h-7 rounded-[6px] px-3 text-[11px]"
                    onApply={applyVoiceReadings}
                  />
                }
              />
              <UnitNumberInput
                label="CO₂ %"
                value={checks.low_combustion_co2}
                onChange={(value) => setCheckValue('low_combustion_co2', value)}
                unit="%"
              />
              <UnitNumberInput
                label="Ratio"
                value={checks.low_combustion_ratio}
                onChange={(value) => setCheckValue('low_combustion_ratio', value)}
                unit="ratio"
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Safety checks"
            subtitle={`${safetyCompleted}/${safetyTotal} complete`}
            defaultOpen={firstIncompleteKey === 'safety'}
          >
            <div className="space-y-2">
              {SAFETY_CHECK_ITEMS.slice(0, 3).map(renderCheckToggleWithComment)}
              <div className="grid gap-3 sm:grid-cols-2">
                <UnitNumberInput
                  label="Operating pressure"
                  value={checks.operating_pressure_mbar}
                  onChange={(value) => setCheckValue('operating_pressure_mbar', value)}
                  unit="mbar"
                  labelAction={
                    <Cp12VoiceReadings
                      jobId={jobId}
                      scope="pressure"
                      buttonLabel="Speak pressure/input"
                      buttonClassName="h-7 rounded-[6px] px-3 text-[11px]"
                      onApply={applyVoiceReadings}
                    />
                  }
                />
                <UnitNumberInput
                  label="Heat input"
                  value={checks.heat_input}
                  onChange={(value) => setCheckValue('heat_input', value)}
                  unit="kW"
                />
              </div>
              {SAFETY_CHECK_ITEMS.slice(3).map(renderCheckToggleWithComment)}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Central heating Annual Service and Plumbing Inspection"
            subtitle={`${centralHeatingCompleted}/${CENTRAL_HEATING_CHECK_ITEMS.length} complete`}
            defaultOpen={firstIncompleteKey === 'central-heating'}
          >
            <div className="space-y-2">{CENTRAL_HEATING_CHECK_ITEMS.map(renderCheckToggle)}</div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Appliance / system advice and recommendations"
            subtitle={`${adviceCompleted}/${ADVICE_CHECK_ITEMS.length} complete`}
            defaultOpen={firstIncompleteKey === 'advice'}
          >
            <div className="space-y-2">{ADVICE_CHECK_ITEMS.map(renderCheckToggleWithComment)}</div>
          </CollapsibleSection>

          </div>
          <div id="boiler-step3-footer-actions" className="sticky bottom-0 z-10 mt-6 flex gap-[8px] border-t-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-4 py-3">
            <button
              type="button"
              onClick={goBackOneStep}
              disabled={isPending}
              className="flex h-[44px] flex-1 items-center justify-center rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-transparent text-[14px] text-[var(--color-text-secondary)] disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleChecksNext}
              disabled={isPending}
              className="flex h-[44px] flex-[2] items-center justify-center gap-[6px] rounded-[10px] bg-[#111] text-[14px] font-medium text-white disabled:opacity-50"
            >
              Next → Summary
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </WizardLayout>
      ) : null}

      {step === 4 ? (
        <WizardLayout
          step={offsetStep(4)}
          total={totalSteps}
          title="Summary, Next Service & Signatures"
          status="Finish"
          onBack={goBackOneStep}
          actionsHideWhenVisibleId="boiler-step4-footer-actions"
          actions={
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex h-[30px] items-center rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-transparent px-[14px] text-[13px] text-[var(--color-text-secondary)]"
            >
              Edit
            </button>
          }
        >
          <div className="space-y-4">
            {offlineDraftBanner}
            {boilerRequiredItemsPanel}
            {demoEnabled ? (
              <div className="flex justify-end">
                <Button type="button" variant="outline" className="rounded-[6px] text-xs" onClick={handleDemoFill} disabled={isPending}>
                  Autofill test Boiler Service
                </Button>
              </div>
            ) : null}
            <CollapsibleSection
              title="Summary & recommendations"
              subtitle={summaryComplete ? 'Required notes complete' : 'Required notes missing'}
              defaultOpen={firstIncompleteKey === 'summary'}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Textarea
                  value={checks.service_summary}
                  onChange={(e) => setCheckValue('service_summary', e.target.value)}
                  placeholder="Service summary (required)"
                  className="min-h-[80px]"
                />
                <Textarea
                  value={checks.recommendations}
                  onChange={(e) => setCheckValue('recommendations', e.target.value)}
                  placeholder="Recommendations (required)"
                  className="min-h-[80px]"
                />
              </div>
            </CollapsibleSection>
            <CollapsibleSection
              title="Defects & parts"
              subtitle={checks.defects_found === 'yes' ? 'Defects recorded' : 'No defects'}
              defaultOpen={firstIncompleteKey === 'defects'}
            >
              <div className="space-y-3">
                <div className="rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-3">
                  <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Defects found?</p>
                  <div className="mt-2 flex gap-2">
                    {(['yes', 'no'] as const).map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => setCheckValue('defects_found', choice)}
                        style={yesNoButtonStyle(choice, checks.defects_found ?? '')}
                      >
                        {choice === 'yes' ? 'Yes' : 'No'}
                      </button>
                    ))}
                  </div>
                </div>
                {defectsActive ? (
                  <div className="grid gap-3 sm:grid-cols-[1fr,1fr]">
                    <Textarea
                      value={checks.defects_details}
                      onChange={(e) => setCheckValue('defects_details', e.target.value)}
                      placeholder="Defect details (required if yes)"
                      className="min-h-[70px]"
                    />
                    <Textarea
                      value={checks.parts_used}
                      onChange={(e) => setCheckValue('parts_used', e.target.value)}
                      placeholder="Parts used (optional)"
                      className="min-h-[70px]"
                    />
                  </div>
                ) : (
                  <p className="text-[12px] text-[var(--color-text-tertiary)]">No defects recorded for this service.</p>
                )}
              </div>
            </CollapsibleSection>
            <CollapsibleSection
              title="Next service due"
              subtitle={checks.next_service_due ? formatNextServiceDate(checks.next_service_due) : 'Set a reminder'}
              defaultOpen={firstIncompleteKey === 'next'}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  type="date"
                  value={checks.next_service_due}
                  onChange={(e) => setCheckValue('next_service_due', e.target.value)}
                  min={jobInfo.service_date || jobAddress.job_visit_date || completionDate || undefined}
                />
              </div>
            </CollapsibleSection>
            <div className="grid gap-4 sm:grid-cols-2">
              <SignatureCard label="Customer" existingUrl={customerSignature} onUpload={signatureUpload('customer')} />
              <SignatureCard label="Engineer" existingUrl={engineerSignature} onUpload={signatureUpload('engineer')} />
            </div>
            <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Completion</p>
              <Input
                type="date"
                value={completionDate}
                onChange={(e) => applyServiceDate(e.target.value)}
                className="mt-2"
              />
            </div>
            <details className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
              <summary className="cursor-pointer text-[13px] font-medium text-[var(--color-text-primary)]">Internal evidence (optional)</summary>
              <div className="mt-3">
                <EvidenceCard
                  title="Upload photos"
                  fields={[]}
                  values={{}}
                  onChange={() => null}
                  onPhotoUpload={handleEvidenceUpload(FINAL_EVIDENCE_DEFAULT)}
                />
              </div>
            </details>
          </div>
          <div id="boiler-step4-footer-actions" className="sticky bottom-0 z-10 mt-6 flex gap-[8px] border-t-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-4 py-3">
            <button
              type="button"
              onClick={goBackOneStep}
              disabled={isPending}
              className="flex h-[44px] flex-1 items-center justify-center rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-transparent text-[14px] text-[var(--color-text-secondary)] disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isPending || boilerMissingItems.length > 0}
              className="flex min-h-[44px] flex-[2] items-center justify-center gap-[6px] rounded-[10px] bg-[var(--color-action)] px-2 text-center text-[14px] font-medium leading-tight text-white disabled:opacity-50"
            >
              {queuedIssue
                ? 'Issue queued'
                : !isOnline
                  ? 'Queue issue'
                  : hasUnsyncedChanges || isOfflineDraftSyncing
                    ? 'Save & generate'
                    : firstBoilerMissing
                      ? `Complete: ${firstBoilerMissing.label}`
                      : isPending
                        ? 'Generating…'
                        : 'Generate Boiler Service'}
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </WizardLayout>
      ) : null}
      {limitReachedMessage && (
        <LimitReachedModal message={limitReachedMessage} onDismiss={() => setLimitReachedMessage(null)} />
      )}
    </>
  );
}
