'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { WizardLayout } from '@/components/certificates/wizard-layout';
import { Mic } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SignatureCard } from '@/components/certificates/signature-card';
import { EvidenceCard } from './evidence-card';
import { ApplianceStep, type ApplianceStepValues } from '@/components/wizard/steps/appliance-step';
import { ChecksStep, type ChecksStepValues } from '@/components/wizard/steps/checks-step';
import { SearchableSelect } from '@/components/wizard/inputs/searchable-select';
import { PassFailToggle } from '@/components/wizard/inputs/pass-fail-toggle';
import { UnitNumberInput } from '@/components/wizard/inputs/unit-number-input';
import { type CertificateType, type Cp12Appliance, type Cp12SafetyClassification, type PhotoCategory } from '@/types/certificates';
import {
  createCp12RemoteSignatureRequest,
  saveCp12JobInfo,
  uploadJobPhoto,
  updateField,
  generateCertificatePdf,
  saveCp12Appliances,
  uploadSignature,
} from '@/server/certificates';
import { useToast } from '@/components/ui/use-toast';
import { getLatestApplianceDefaultsForJob } from '@/server/history';
import { tryUpdateJobRecord } from '@/server/jobRecords';
import {
  CP12_FLUE_TYPES,
  CP12_DEMO_APPLIANCE,
  CP12_DEMO_INFO,
  CP12_EVIDENCE_CONFIG,
} from '@/types/cp12';
import { saveJobFields } from '@/server/certificates';
import { mergeJobContextFields, type InitialJobContext } from './initial-job-context';
import type { AddressLookupResult, AddressLookupSuggestion } from '@/lib/address-lookup';
import { buildWizardDraftStorageKey, useWizardDraft } from '@/hooks/use-wizard-draft';
import { getMakes } from '@/lib/applianceCatalog/ukBoilers';
import { Cp12VoiceReadings } from '@/components/cp12/cp12-voice-readings';
import type { Cp12VoiceReadingsParsed } from '@/lib/cp12/voice-readings';
import { EnumChips } from '@/components/wizard/inputs/enum-chips';

type WizardProps = {
  jobId: string;
  certificateType: CertificateType;
  certificateLabel: string;
  initialInfo?: Record<string, string | null | undefined>;
  initialJobContext?: InitialJobContext | null;
  initialPhotoPreviews?: Record<string, string>;
  initialAppliances?: Cp12Appliance[];
  stepOffset?: number;
  startStep?: number;
  hideBillingCustomerStep?: boolean;
  prepareOnly?: boolean;
};

const emptyAppliance: Cp12Appliance = {
  appliance_type: '',
  location: '',
  make_model: '',
  operating_pressure: '',
  heat_input: '',
  high_co_ppm: '',
  high_co2: '',
  high_ratio: '',
  low_co_ppm: '',
  low_co2: '',
  low_ratio: '',
  co_reading_high: '',
  co_reading_low: '',
  flue_type: '',
  ventilation_provision: '',
  ventilation_satisfactory: '',
  flue_condition: '',
  stability_test: '',
  gas_tightness_test: '',
  co_reading_ppm: '',
  safety_devices_correct: '',
  flue_performance_test: '',
  appliance_serviced: '',
  combustion_notes: '',
  safety_rating: '',
  classification_code: '',
  safety_classification: '',
  defect_notes: '',
  actions_taken: '',
  actions_required: '',
  warning_notice_issued: false,
  appliance_disconnected: false,
  danger_do_not_use_attached: false,
};

const MAX_APPLIANCES = 5;

const KNOWN_MAKES = getMakes()
  .filter((make) => make.toLowerCase() !== 'other')
  .sort((a, b) => b.length - a.length);

const splitMakeModel = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return { make: '', model: '' };
  const knownMake = KNOWN_MAKES.find((make) => trimmed.toLowerCase().startsWith(make.toLowerCase()));
  if (knownMake) {
    return { make: knownMake, model: trimmed.slice(knownMake.length).trim() };
  }
  return { make: trimmed, model: '' };
};

const combineMakeModel = (make: string, model: string) => [make.trim(), model.trim()].filter(Boolean).join(' ').trim();

type Cp12InfoState = {
  customer_name: string;
  customer_phone: string;
  property_address: string;
  postcode: string;
  inspection_date: string;
  landlord_name: string;
  landlord_company: string;
  landlord_address_line1: string;
  landlord_address_line2: string;
  landlord_city: string;
  landlord_postcode: string;
  landlord_tel: string;
  landlord_address: string;
  reg_26_9_confirmed: boolean;
  company_address: string;
  company_postcode: string;
  company_phone: string;
  engineer_phone: string;
};

type Cp12JobAddressState = {
  job_reference: string;
  job_address_name: string;
  job_address_line1: string;
  job_address_line2: string;
  job_address_city: string;
  job_postcode: string;
  job_tel: string;
};

type Cp12DraftState = {
  step: number;
  info: Cp12InfoState;
  jobAddress: Cp12JobAddressState;
  evidenceFields: Record<string, string>;
  appliances: Cp12Appliance[];
  measurementSource: 'manual' | 'tpi';
  combustionOpen: Record<number, boolean>;
  defects: {
    defect_description: string;
    remedial_action: string;
    warning_notice_issued: string;
  };
  completionDate: string;
  engineerSignature: string;
  customerSignature: string;
  addressSearchQuery: string;
  landlordAddressSearchQuery: string;
};

type ChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  hint?: string;
  action?: () => void;
  blocking?: boolean;
};

type AddressLookupApiResponse = {
  suggestions?: AddressLookupSuggestion[];
  address?: AddressLookupResult;
  error?: string;
};

const ADDRESS_SEARCH_MIN_QUERY_LENGTH = 3;

const buildPropertyAddressFromJobAddress = (addr: Cp12JobAddressState) =>
  [addr.job_address_line1, addr.job_address_line2, addr.job_address_city].filter((part) => part && part.trim()).join(', ');

const splitAddressParts = (value: string) =>
  String(value ?? '')
    .split(/[\r\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

const buildLandlordAddress = (line1: string, line2: string, city: string) =>
  [line1, line2, city].filter((part) => part && part.trim()).join(', ');

const deriveJobAddressFromFields = (addr: Cp12JobAddressState, info: Cp12InfoState) => {
  if (addr.job_address_line1.trim() || addr.job_address_line2.trim() || addr.job_address_city.trim()) {
    return {
      line1: addr.job_address_line1,
      line2: addr.job_address_line2,
      city: addr.job_address_city,
    };
  }
  const primaryAddress =
    info.property_address.trim() ||
    buildLandlordAddress(info.landlord_address_line1, info.landlord_address_line2, info.landlord_city).trim() ||
    info.landlord_address.trim();
  const parts = primaryAddress
    ? primaryAddress
        .split(/[\r\n,]+/)
        .map((part) => part.trim())
        .filter(Boolean)
    : [];
  const line1 = parts[0] ?? '';
  const city = parts.length >= 3 ? parts.at(-1) ?? '' : '';
  const line2 = parts.length >= 3 ? parts.slice(1, -1).join(', ') : parts[1] ?? '';
  return { line1, line2, city };
};

const CP12_DEMO_PHOTO_NOTES: Record<string, string> = {
  appliance_photo: ['Worcester Bosch Greenstar 30i', 'Wall-mounted condensing combi boiler', 'Located in kitchen cupboard'].join('\n'),
  serial_label: ['Serial number: WB30I-84736291', 'Gas type: Natural Gas (G20)', 'Year of manufacture: 2019'].join('\n'),
  flue_photo: ['Room-sealed concentric flue', 'Flue terminates externally through rear wall', 'Clearances appear compliant'].join('\n'),
  meter_reading: ['Gas meter reading: 012345 m³', 'Meter type: Metric', 'Meter location: Hallway cupboard'].join('\n'),
  ventilation: ['Permanent ventilation present', 'Vent unobstructed', 'Ventilation size adequate for appliance'].join('\n'),
  issue_photo: 'No safety defects identified at time of inspection.',
};

const FINAL_EVIDENCE_DEFAULT: PhotoCategory = 'site';

const BOILER_TYPE_OPTIONS = [
  { label: 'Combi', value: 'combi' },
  { label: 'System', value: 'system' },
  { label: 'Regular', value: 'regular' },
  { label: 'Other', value: 'other' },
];

const CP12_SAFETY_CLASSIFICATION_OPTIONS: Array<{ label: string; value: Cp12SafetyClassification }> = [
  { label: 'Safe', value: 'safe' },
  { label: 'Not to Current Standards', value: 'ncs' },
  { label: 'At Risk', value: 'ar' },
  { label: 'Immediately Dangerous', value: 'id' },
];

const normalizeSafetyClassification = (value?: string | null): Cp12SafetyClassification | '' => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'safe') return 'safe';
  if (normalized === 'ncs' || normalized === 'not to current standards') return 'ncs';
  if (normalized === 'ar' || normalized === 'at risk' || normalized === 'at_risk') return 'ar';
  if (normalized === 'id' || normalized === 'immediately dangerous' || normalized === 'immediately_dangerous') return 'id';
  return '';
};

const getApplianceSafetyClassification = (appliance: Cp12Appliance): Cp12SafetyClassification | '' =>
  normalizeSafetyClassification(appliance.safety_classification) ||
  normalizeSafetyClassification(appliance.classification_code) ||
  normalizeSafetyClassification(appliance.safety_rating);

const legacySafetyFromClassification = (classification: Cp12SafetyClassification | '') => {
  if (classification === 'safe') return { safety_rating: 'safe', classification_code: '' };
  if (classification === 'ncs') return { safety_rating: 'ncs', classification_code: 'NCS' };
  if (classification === 'ar') return { safety_rating: 'at risk', classification_code: 'AR' };
  if (classification === 'id') return { safety_rating: 'immediately dangerous', classification_code: 'ID' };
  return { safety_rating: '', classification_code: '' };
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

export function CertificateWizard({
  jobId,
  certificateType,
  certificateLabel,
  initialInfo = {},
  initialJobContext = null,
  initialPhotoPreviews = {},
  initialAppliances = [],
  stepOffset = 0,
  startStep = 1,
  prepareOnly = false,
}: WizardProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [step, setStep] = useState(() => Math.max(startStep, 1));
  const [isPending, startTransition] = useTransition();
  const resolvedInitialInfo = mergeJobContextFields(initialInfo, initialJobContext);
  const [isPostcodeLookupPending, setIsPostcodeLookupPending] = useState(false);
  const [postcodeSuggestions, setPostcodeSuggestions] = useState<AddressLookupSuggestion[]>([]);
  const [selectedPostcodeMatchId, setSelectedPostcodeMatchId] = useState<string | null>(null);
  const [addressSearchQuery, setAddressSearchQuery] = useState(
    resolvedInitialInfo.job_address_line1 ?? resolvedInitialInfo.property_address ?? '',
  );
  const [addressSearchError, setAddressSearchError] = useState<string | null>(null);
  const [isLandlordLookupPending, setIsLandlordLookupPending] = useState(false);
  const [landlordAddressSuggestions, setLandlordAddressSuggestions] = useState<AddressLookupSuggestion[]>([]);
  const [selectedLandlordMatchId, setSelectedLandlordMatchId] = useState<string | null>(null);
  const [landlordAddressSearchQuery, setLandlordAddressSearchQuery] = useState(
    resolvedInitialInfo.landlord_address_line1 ?? resolvedInitialInfo.landlord_address ?? '',
  );
  const [landlordAddressSearchError, setLandlordAddressSearchError] = useState<string | null>(null);
  const demoEnabled = certificateType === 'cp12' || process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const deferredAddressSearchQuery = useDeferredValue(addressSearchQuery.trim());
  const deferredLandlordAddressSearchQuery = useDeferredValue(landlordAddressSearchQuery.trim());
  const initialLandlordAddressParts = splitAddressParts(String(resolvedInitialInfo.landlord_address ?? ''));
  const initialLandlordLine1 = resolvedInitialInfo.landlord_address_line1 ?? initialLandlordAddressParts[0] ?? '';
  const initialLandlordLine2 =
    resolvedInitialInfo.landlord_address_line2 ??
    (initialLandlordAddressParts.length > 2 ? initialLandlordAddressParts.slice(1, -1).join(', ') : '');
  const initialLandlordCity =
    resolvedInitialInfo.landlord_city ??
    resolvedInitialInfo.landlord_town ??
    (initialLandlordAddressParts.length > 1 ? initialLandlordAddressParts.at(-1) ?? '' : '');
  const initialLandlordPostcode = resolvedInitialInfo.landlord_postcode ?? '';
  const initialLandlordTel = resolvedInitialInfo.landlord_tel ?? '';
  const initialLandlordAddress =
    resolvedInitialInfo.landlord_address ?? buildLandlordAddress(initialLandlordLine1, initialLandlordLine2, initialLandlordCity);

  const [info, setInfo] = useState<Cp12InfoState>({
    customer_name: resolvedInitialInfo.customer_name ?? '',
    customer_phone: resolvedInitialInfo.customer_phone ?? resolvedInitialInfo.job_phone ?? '',
    property_address: resolvedInitialInfo.property_address ?? '',
    postcode: resolvedInitialInfo.postcode ?? '',
    inspection_date: resolvedInitialInfo.inspection_date ?? '',
    landlord_name: resolvedInitialInfo.landlord_name ?? '',
    landlord_company: resolvedInitialInfo.landlord_company ?? '',
    landlord_address_line1: initialLandlordLine1,
    landlord_address_line2: initialLandlordLine2,
    landlord_city: initialLandlordCity,
    landlord_postcode: initialLandlordPostcode,
    landlord_tel: initialLandlordTel,
    landlord_address: initialLandlordAddress,
    reg_26_9_confirmed: (() => {
      const value = String(resolvedInitialInfo.reg_26_9_confirmed ?? '').toLowerCase();
      return value === 'true' || value === 'yes';
    })(),
    company_address: resolvedInitialInfo.company_address ?? '',
    company_postcode: resolvedInitialInfo.company_postcode ?? '',
    company_phone: resolvedInitialInfo.company_phone ?? '',
    engineer_phone: resolvedInitialInfo.engineer_phone ?? '',
  });

  const [jobAddress, setJobAddress] = useState<Cp12JobAddressState>({
    job_reference: resolvedInitialInfo.job_reference ?? '',
    job_address_name: resolvedInitialInfo.job_address_name ?? '',
    job_address_line1: resolvedInitialInfo.job_address_line1 ?? resolvedInitialInfo.property_address ?? '',
    job_address_line2: resolvedInitialInfo.job_address_line2 ?? '',
    job_address_city: resolvedInitialInfo.job_address_city ?? '',
    job_postcode: resolvedInitialInfo.job_postcode ?? resolvedInitialInfo.postcode ?? '',
    job_tel: resolvedInitialInfo.job_tel ?? resolvedInitialInfo.job_phone ?? '',
  });

  const [evidenceFields, setEvidenceFields] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(resolvedInitialInfo).map(([key, value]) => [
        key,
        value === null || value === undefined ? '' : String(value),
      ]),
    ),
  );
  const sanitizeAppliance = (appliance: Cp12Appliance): Cp12Appliance => ({
    appliance_type: appliance.appliance_type ?? '',
    location: appliance.location ?? '',
    make_model: appliance.make_model ?? '',
    operating_pressure: appliance.operating_pressure ?? '',
    heat_input: appliance.heat_input ?? '',
    high_co_ppm: appliance.high_co_ppm ?? '',
    high_co2: appliance.high_co2 ?? '',
    high_ratio: appliance.high_ratio ?? '',
    low_co_ppm: appliance.low_co_ppm ?? '',
    low_co2: appliance.low_co2 ?? '',
    low_ratio: appliance.low_ratio ?? '',
    co_reading_high: appliance.co_reading_high ?? '',
    co_reading_low: appliance.co_reading_low ?? '',
    flue_type: appliance.flue_type ?? '',
    ventilation_provision: appliance.ventilation_provision ?? '',
    ventilation_satisfactory: appliance.ventilation_satisfactory ?? '',
    flue_condition: appliance.flue_condition ?? '',
    stability_test: appliance.stability_test ?? '',
    gas_tightness_test: appliance.gas_tightness_test ?? '',
    co_reading_ppm: appliance.co_reading_ppm ?? '',
    safety_devices_correct: appliance.safety_devices_correct ?? '',
    flue_performance_test: appliance.flue_performance_test ?? '',
    appliance_serviced: appliance.appliance_serviced ?? '',
    combustion_notes: appliance.combustion_notes ?? '',
    safety_rating: appliance.safety_rating ?? '',
    classification_code: appliance.classification_code ?? '',
    safety_classification:
      normalizeSafetyClassification(appliance.safety_classification) ||
      normalizeSafetyClassification(appliance.classification_code ?? appliance.safety_rating),
    defect_notes: appliance.defect_notes ?? '',
    actions_taken: appliance.actions_taken ?? '',
    actions_required: appliance.actions_required ?? '',
    warning_notice_issued: appliance.warning_notice_issued ?? false,
    appliance_disconnected: appliance.appliance_disconnected ?? false,
    danger_do_not_use_attached: appliance.danger_do_not_use_attached ?? false,
  });

  const [appliances, setAppliances] = useState<Cp12Appliance[]>(
    initialAppliances.length
      ? initialAppliances.slice(0, MAX_APPLIANCES).map(sanitizeAppliance)
      : [emptyAppliance],
  );
  const [measurementSource, setMeasurementSource] = useState<'manual' | 'tpi'>('manual');
  const [combustionOpen, setCombustionOpen] = useState<Record<number, boolean>>({});
  const [defects, setDefects] = useState({
    defect_description: resolvedInitialInfo.defect_description ?? '',
    remedial_action: resolvedInitialInfo.remedial_action ?? '',
    warning_notice_issued: resolvedInitialInfo.warning_notice_issued ?? 'NO',
  });
  const [completionDate, setCompletionDate] = useState(resolvedInitialInfo.completion_date ?? new Date().toISOString().slice(0, 10));
  const [engineerSignature, setEngineerSignature] = useState(resolvedInitialInfo.engineer_signature ?? '');
  const [engineerSignaturePath, setEngineerSignaturePath] = useState(resolvedInitialInfo.engineer_signature_path ?? '');
  const [customerSignature, setCustomerSignature] = useState(resolvedInitialInfo.customer_signature ?? '');
  const [remoteSignatureLink, setRemoteSignatureLink] = useState(
    resolvedInitialInfo.cp12_remote_signature_token
      ? `/sign/cp12/${resolvedInitialInfo.cp12_remote_signature_token}`
      : '',
  );
  const prefillAppliedRef = useRef(false);
  const applianceRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const prevApplianceCountRef = useRef(appliances.length);

  const isCp12 = useMemo(() => certificateType === 'cp12', [certificateType]);
  const totalSteps = (isCp12 ? 4 : 4) + stepOffset;
  const baseOffset = stepOffset;
  const firstStep = 1;
  const offsetStep = (step: number) => step + baseOffset;
  const draftStorageKey = useMemo(() => buildWizardDraftStorageKey(certificateType, jobId), [certificateType, jobId]);

  useEffect(() => {
    if (!isCp12 || prefillAppliedRef.current) return;
    prefillAppliedRef.current = true;
    startTransition(async () => {
      try {
        const defaults = await getLatestApplianceDefaultsForJob(jobId);
        if (!defaults) return;

        setAppliances((prev) => {
          if (!prev.length) return prev;
          const current = prev[0];
          const next = { ...current };
          const makeModel = combineMakeModel(defaults.appliance.make, defaults.appliance.model);
          if (!next.appliance_type && defaults.appliance.type) next.appliance_type = defaults.appliance.type;
          if (!next.location && defaults.appliance.location) next.location = defaults.appliance.location;
          if (!next.make_model && makeModel) next.make_model = makeModel;
          if (!next.flue_type && defaults.appliance.flueType) next.flue_type = defaults.appliance.flueType;
          if (!next.operating_pressure && defaults.readings.operatingPressure) next.operating_pressure = defaults.readings.operatingPressure;
          if (!next.heat_input && defaults.readings.heatInput) next.heat_input = defaults.readings.heatInput;
          if (!next.co_reading_ppm && defaults.readings.coReadingPpm) next.co_reading_ppm = defaults.readings.coReadingPpm;
          if (!next.ventilation_satisfactory && defaults.readings.ventilationSatisfactory) {
            next.ventilation_satisfactory = defaults.readings.ventilationSatisfactory;
          }
          if (!next.flue_condition && defaults.readings.flueCondition) next.flue_condition = defaults.readings.flueCondition;
          if (!next.gas_tightness_test && defaults.readings.gasTightnessTest) next.gas_tightness_test = defaults.readings.gasTightnessTest;
          if (!next.safety_rating && defaults.readings.safetyRating) next.safety_rating = defaults.readings.safetyRating;
          if (!next.classification_code && defaults.readings.classificationCode) next.classification_code = defaults.readings.classificationCode;
          const updated = [...prev];
          updated[0] = next;
          return updated;
        });

        setEvidenceFields((prev) => {
          const next = { ...prev };
          if (!next.boiler_make && defaults.appliance.make) next.boiler_make = defaults.appliance.make;
          if (!next.boiler_model && defaults.appliance.model) next.boiler_model = defaults.appliance.model;
          if (!next.location && defaults.appliance.location) next.location = defaults.appliance.location;
          if (!next.serial_number && defaults.appliance.serial) next.serial_number = defaults.appliance.serial;
          if (!next.flue_type && defaults.appliance.flueType) next.flue_type = defaults.appliance.flueType;
          return next;
        });
      } catch (error) {
        console.error('CP12 history defaults failed', error);
      }
    });
  }, [isCp12, jobId]);

  useEffect(() => {
    if (appliances.length > prevApplianceCountRef.current) {
      const lastIndex = appliances.length - 1;
      const node = applianceRefs.current[lastIndex];
      if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const focusable = node.querySelector('input, select, textarea') as HTMLElement | null;
        focusable?.focus();
      }
    }
    prevApplianceCountRef.current = appliances.length;
  }, [appliances.length, appliances]);

  useEffect(() => {
    if (!jobId) return;
    void tryUpdateJobRecord(jobId, {
      resume_certificate_type: certificateType,
      resume_step: step + stepOffset,
    });
  }, [certificateType, jobId, step, stepOffset]);

  const cp12Draft = useMemo<Cp12DraftState>(
    () => ({
      step,
      info,
      jobAddress,
      evidenceFields,
      appliances,
      measurementSource,
      combustionOpen,
      defects,
      completionDate,
      engineerSignature,
      customerSignature,
      addressSearchQuery,
      landlordAddressSearchQuery,
    }),
    [
      addressSearchQuery,
      appliances,
      combustionOpen,
      completionDate,
      customerSignature,
      defects,
      engineerSignature,
      evidenceFields,
      info,
      jobAddress,
      landlordAddressSearchQuery,
      measurementSource,
      step,
    ],
  );

  const { clearDraft } = useWizardDraft<Cp12DraftState>({
    storageKey: draftStorageKey,
    state: cp12Draft,
    onRestore: (draft) => {
      setStep(Math.min(4, Math.max(1, draft.step || startStep)));
      setInfo((prev) => ({ ...prev, ...(draft.info ?? {}) }));
      setJobAddress((prev) => ({ ...prev, ...(draft.jobAddress ?? {}) }));
      setEvidenceFields((prev) => ({ ...prev, ...(draft.evidenceFields ?? {}) }));
      if (Array.isArray(draft.appliances) && draft.appliances.length) {
        setAppliances(draft.appliances.slice(0, MAX_APPLIANCES).map(sanitizeAppliance));
      }
      setMeasurementSource(draft.measurementSource === 'tpi' ? 'tpi' : 'manual');
      setCombustionOpen(draft.combustionOpen ?? {});
      setDefects((prev) => ({ ...prev, ...(draft.defects ?? {}) }));
      setCompletionDate(draft.completionDate || completionDate);
      setEngineerSignature(draft.engineerSignature ?? '');
      setCustomerSignature(draft.customerSignature ?? '');
      setAddressSearchQuery(draft.addressSearchQuery ?? '');
      setLandlordAddressSearchQuery(draft.landlordAddressSearchQuery ?? '');
    },
  });

  useEffect(() => {
    if (!isCp12) return;

    if (!deferredAddressSearchQuery) {
      setPostcodeSuggestions([]);
      setSelectedPostcodeMatchId(null);
      setAddressSearchError(null);
      setIsPostcodeLookupPending(false);
      return;
    }

    if (deferredAddressSearchQuery.length < ADDRESS_SEARCH_MIN_QUERY_LENGTH) {
      setPostcodeSuggestions([]);
      setSelectedPostcodeMatchId(null);
      setAddressSearchError(`Type at least ${ADDRESS_SEARCH_MIN_QUERY_LENGTH} characters to search.`);
      setIsPostcodeLookupPending(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsPostcodeLookupPending(true);
      setAddressSearchError(null);

      try {
        const query = encodeURIComponent(deferredAddressSearchQuery);
        const response = await fetch(`/api/address-search?q=${query}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        const payload = (await response.json()) as AddressLookupApiResponse;
        if (!response.ok) {
          throw new Error(payload.error || 'Lookup failed');
        }

        const suggestions = payload.suggestions ?? [];
        setPostcodeSuggestions(suggestions);
        setSelectedPostcodeMatchId(null);
        setAddressSearchError(suggestions.length ? null : 'No addresses found. Try a postcode or add more detail.');
      } catch (error) {
        if (controller.signal.aborted) return;
        setPostcodeSuggestions([]);
        setSelectedPostcodeMatchId(null);
        setAddressSearchError(error instanceof Error ? error.message : 'Try another search.');
      } finally {
        if (!controller.signal.aborted) {
          setIsPostcodeLookupPending(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [deferredAddressSearchQuery, isCp12]);

  useEffect(() => {
    if (!isCp12) return;

    if (!deferredLandlordAddressSearchQuery) {
      setLandlordAddressSuggestions([]);
      setSelectedLandlordMatchId(null);
      setLandlordAddressSearchError(null);
      setIsLandlordLookupPending(false);
      return;
    }

    if (deferredLandlordAddressSearchQuery.length < ADDRESS_SEARCH_MIN_QUERY_LENGTH) {
      setLandlordAddressSuggestions([]);
      setSelectedLandlordMatchId(null);
      setLandlordAddressSearchError(`Type at least ${ADDRESS_SEARCH_MIN_QUERY_LENGTH} characters to search.`);
      setIsLandlordLookupPending(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLandlordLookupPending(true);
      setLandlordAddressSearchError(null);

      try {
        const query = encodeURIComponent(deferredLandlordAddressSearchQuery);
        const response = await fetch(`/api/address-search?q=${query}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        const payload = (await response.json()) as AddressLookupApiResponse;
        if (!response.ok) {
          throw new Error(payload.error || 'Lookup failed');
        }

        const suggestions = payload.suggestions ?? [];
        setLandlordAddressSuggestions(suggestions);
        setSelectedLandlordMatchId(null);
        setLandlordAddressSearchError(suggestions.length ? null : 'No addresses found. Try a postcode or add more detail.');
      } catch (error) {
        if (controller.signal.aborted) return;
        setLandlordAddressSuggestions([]);
        setSelectedLandlordMatchId(null);
        setLandlordAddressSearchError(error instanceof Error ? error.message : 'Try another search.');
      } finally {
        if (!controller.signal.aborted) {
          setIsLandlordLookupPending(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [deferredLandlordAddressSearchQuery, isCp12]);

  const handleDemoFill = () => {
    if (!isCp12 || !demoEnabled) return;
    startTransition(async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const nextInspectionDue = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const demoEngineerSignature = makeDemoSignatureDataUrl('Engineer signature', '#0f172a');
        const demoCustomerSignature = makeDemoSignatureDataUrl('Customer signature', '#1d4ed8');
        const demoLandlordAddressParts = splitAddressParts(CP12_DEMO_INFO.landlord_address);
        const demoLandlordLine1 = info.landlord_address_line1 || CP12_DEMO_INFO.landlord_address_line1 || demoLandlordAddressParts[0] || '';
        const demoLandlordLine2 =
          info.landlord_address_line2 ||
          CP12_DEMO_INFO.landlord_address_line2 ||
          (demoLandlordAddressParts.length > 2 ? demoLandlordAddressParts.slice(1, -1).join(', ') : '');
        const demoLandlordCity =
          info.landlord_city ||
          CP12_DEMO_INFO.landlord_city ||
          (demoLandlordAddressParts.length > 1 ? demoLandlordAddressParts.at(-1) ?? '' : '');
        const demoLandlordPostcode = info.landlord_postcode || CP12_DEMO_INFO.landlord_postcode || CP12_DEMO_INFO.postcode;
        const demoLandlordAddress = buildLandlordAddress(demoLandlordLine1, demoLandlordLine2, demoLandlordCity);
        const demoInfo: Cp12InfoState = {
          ...info,
          customer_name: info.customer_name || CP12_DEMO_INFO.customer_name,
          customer_phone: info.customer_phone || CP12_DEMO_INFO.customer_phone || '',
          property_address:
            info.property_address ||
            buildPropertyAddressFromJobAddress({
              ...jobAddress,
              job_address_line1: jobAddress.job_address_line1 || CP12_DEMO_INFO.job_address_line1,
              job_address_line2: jobAddress.job_address_line2 || CP12_DEMO_INFO.job_address_line2,
              job_address_city: jobAddress.job_address_city || CP12_DEMO_INFO.job_address_city,
            }) ||
            CP12_DEMO_INFO.property_address,
          postcode: info.postcode || jobAddress.job_postcode || CP12_DEMO_INFO.job_postcode || CP12_DEMO_INFO.postcode,
          inspection_date: info.inspection_date || (typeof CP12_DEMO_INFO.inspection_date === 'function' ? CP12_DEMO_INFO.inspection_date() : today),
          landlord_name: info.landlord_name || CP12_DEMO_INFO.landlord_name,
          landlord_company: info.landlord_company || CP12_DEMO_INFO.landlord_company || '',
          landlord_address_line1: demoLandlordLine1,
          landlord_address_line2: demoLandlordLine2,
          landlord_city: demoLandlordCity,
          landlord_postcode: demoLandlordPostcode,
          landlord_tel: info.landlord_tel || CP12_DEMO_INFO.landlord_tel || '',
          landlord_address: demoLandlordAddress || CP12_DEMO_INFO.landlord_address,
          reg_26_9_confirmed: true,
          company_address: info.company_address || CP12_DEMO_INFO.company_address || '',
          company_postcode: info.company_postcode || CP12_DEMO_INFO.company_postcode || '',
          company_phone: info.company_phone || CP12_DEMO_INFO.company_phone || '',
          engineer_phone: info.engineer_phone || CP12_DEMO_INFO.engineer_phone || '',
        };
        const demoJobInfo = {
          ...demoInfo,
          engineer_name: CP12_DEMO_INFO.engineer_name,
          gas_safe_number: CP12_DEMO_INFO.gas_safe_number,
          company_name: CP12_DEMO_INFO.company_name,
          job_tel: jobAddress.job_tel || demoInfo.customer_phone || CP12_DEMO_INFO.job_tel || '',
        };

        const demoAppliance: Cp12Appliance = { ...emptyAppliance, ...CP12_DEMO_APPLIANCE };
        setInfo(demoInfo);
        setAddressSearchQuery(jobAddress.job_address_line1 || CP12_DEMO_INFO.job_address_line1 || CP12_DEMO_INFO.property_address || '');
        setLandlordAddressSearchQuery(demoLandlordLine1);
        setJobAddress((prev) => ({
          ...prev,
          job_address_name: prev.job_address_name || CP12_DEMO_INFO.job_address_name || 'Flat 2 - Tenant entrance',
          job_address_line1: prev.job_address_line1 || CP12_DEMO_INFO.job_address_line1 || CP12_DEMO_INFO.property_address || '',
          job_address_line2: prev.job_address_line2 || CP12_DEMO_INFO.job_address_line2 || '',
          job_address_city: prev.job_address_city || CP12_DEMO_INFO.job_address_city || '',
          job_postcode: prev.job_postcode || CP12_DEMO_INFO.job_postcode || CP12_DEMO_INFO.postcode || '',
          job_tel: prev.job_tel || demoInfo.customer_phone || CP12_DEMO_INFO.job_tel || '',
        }));
        setAppliances([demoAppliance]);
        setCompletionDate(today);
        setEngineerSignature(demoEngineerSignature);
        setCustomerSignature(demoCustomerSignature);
        setDefects({
          defect_description: CP12_DEMO_INFO.defect_description,
          remedial_action: CP12_DEMO_INFO.remedial_action,
          warning_notice_issued: CP12_DEMO_INFO.warning_notice_issued ?? 'NO',
        });
        const evidenceDemo: Record<string, string> = { ...evidenceFields };
        CP12_EVIDENCE_CONFIG.forEach((cfg) => {
          Object.entries(cfg.demo ?? {}).forEach(([k, v]) => {
            evidenceDemo[k] = v;
          });
        });
        evidenceDemo.comments = evidenceFields.comments || CP12_DEMO_INFO.comments || '';
        evidenceDemo.emergency_control_accessible =
          evidenceFields.emergency_control_accessible || CP12_DEMO_INFO.emergency_control_accessible || 'yes';
        evidenceDemo.gas_tightness_satisfactory =
          evidenceFields.gas_tightness_satisfactory || CP12_DEMO_INFO.gas_tightness_satisfactory || 'yes';
        evidenceDemo.pipework_visual_satisfactory =
          evidenceFields.pipework_visual_satisfactory || CP12_DEMO_INFO.pipework_visual_satisfactory || 'yes';
        evidenceDemo.equipotential_bonding_satisfactory =
          evidenceFields.equipotential_bonding_satisfactory || CP12_DEMO_INFO.equipotential_bonding_satisfactory || 'yes';
        evidenceDemo.co_alarm_fitted = evidenceFields.co_alarm_fitted || CP12_DEMO_INFO.co_alarm_fitted || 'yes';
        evidenceDemo.co_alarm_tested = evidenceFields.co_alarm_tested || CP12_DEMO_INFO.co_alarm_tested || 'yes';
        evidenceDemo.co_alarm_satisfactory =
          evidenceFields.co_alarm_satisfactory || CP12_DEMO_INFO.co_alarm_satisfactory || 'yes';
        evidenceDemo.next_inspection_due =
          evidenceFields.next_inspection_due || CP12_DEMO_INFO.next_inspection_due || nextInspectionDue;
        evidenceDemo.engineer_id_card_number =
          evidenceFields.engineer_id_card_number || CP12_DEMO_INFO.engineer_id_card_number || '';
        evidenceDemo.engineer_signature = demoEngineerSignature;
        evidenceDemo.customer_signature = demoCustomerSignature;
        evidenceDemo.completion_date = today;
        setEvidenceFields(evidenceDemo);

        await saveCp12JobInfo({ jobId, data: demoJobInfo });
        await saveCp12Appliances({
          jobId,
          appliances: [demoAppliance],
          defects: {
            defect_description: CP12_DEMO_INFO.defect_description,
            remedial_action: CP12_DEMO_INFO.remedial_action,
            warning_notice_issued: CP12_DEMO_INFO.warning_notice_issued ?? 'NO',
          },
        });
        await Promise.all(
          Object.entries(CP12_DEMO_PHOTO_NOTES).map(([key, value]) =>
            updateField({ jobId, key: `photo_note_${key}`, value }),
          ),
        );
        await saveJobFields({ jobId, fields: evidenceDemo });
        router.refresh();
        pushToast({ title: 'CP12 demo filled', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Could not fill demo data',
          description: error instanceof Error ? error.message : 'Try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleEvidenceUpload =
    (category: PhotoCategory) =>
    (file: File) => {
      startTransition(async () => {
        const data = new FormData();
        data.append('jobId', jobId);
        data.append('category', category);
        data.append('file', file);
        try {
          await uploadJobPhoto(data);
          pushToast({ title: 'Photo saved', variant: 'success' });
        } catch (error) {
          pushToast({
            title: 'Upload failed',
            description: error instanceof Error ? error.message : 'Try again.',
            variant: 'error',
          });
        }
      });
    };

  const handleAddressMatchSelect = async (suggestion: AddressLookupSuggestion) => {
    setIsPostcodeLookupPending(true);
    setSelectedPostcodeMatchId(suggestion.id);
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
      setInfo((prev) => ({
        ...prev,
        property_address: address.summary || prev.property_address,
        postcode: address.postcode || prev.postcode,
      }));
      setAddressSearchQuery(address.line1 || suggestion.label);
      setPostcodeSuggestions([]);
      pushToast({ title: 'Address selected', variant: 'success' });
    } catch (error) {
      setSelectedPostcodeMatchId(null);
      setAddressSearchError(error instanceof Error ? error.message : 'Try again.');
      pushToast({
        title: 'Address not found',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'error',
      });
    } finally {
      setIsPostcodeLookupPending(false);
    }
  };

  const handleLandlordAddressMatchSelect = async (suggestion: AddressLookupSuggestion) => {
    setIsLandlordLookupPending(true);
    setSelectedLandlordMatchId(suggestion.id);
    setLandlordAddressSearchError(null);
    try {
      const response = await fetch(`/api/address-search?id=${encodeURIComponent(suggestion.id)}`, {
        headers: { Accept: 'application/json' },
      });
      const payload = (await response.json()) as AddressLookupApiResponse;
      if (!response.ok || !payload.address) {
        throw new Error(payload.error || 'Lookup failed');
      }
      const address = payload.address;
      setInfo((prev) => ({
        ...prev,
        landlord_address_line1: address.line1,
        landlord_address_line2: address.line2,
        landlord_city: address.city,
        landlord_postcode: address.postcode || prev.landlord_postcode,
        landlord_address: buildLandlordAddress(address.line1, address.line2, address.city),
      }));
      setLandlordAddressSearchQuery(address.line1 || suggestion.label);
      setLandlordAddressSuggestions([]);
      pushToast({ title: 'Landlord address selected', variant: 'success' });
    } catch (error) {
      setSelectedLandlordMatchId(null);
      setLandlordAddressSearchError(error instanceof Error ? error.message : 'Try again.');
      pushToast({
        title: 'Address not found',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'error',
      });
    } finally {
      setIsLandlordLookupPending(false);
    }
  };

  const handleInfoNext = () => {
    if (!isCp12) {
      setStep(2);
      return;
    }
    startTransition(async () => {
      try {
        const derivedAddress = deriveJobAddressFromFields(jobAddress, info);
        const nextJobAddress = { ...jobAddress };
        if (!nextJobAddress.job_address_line1.trim()) {
          nextJobAddress.job_address_line1 = derivedAddress.line1;
        }
        if (!nextJobAddress.job_address_line2.trim() && derivedAddress.line2) {
          nextJobAddress.job_address_line2 = derivedAddress.line2;
        }
        if (!nextJobAddress.job_address_city.trim() && derivedAddress.city) {
          nextJobAddress.job_address_city = derivedAddress.city;
        }
        if (!nextJobAddress.job_postcode.trim()) {
          nextJobAddress.job_postcode = info.postcode.trim();
        }
        if (!nextJobAddress.job_tel.trim()) {
          nextJobAddress.job_tel = info.customer_phone.trim();
        }
        if (!nextJobAddress.job_address_name.trim()) {
          throw new Error('Property name / reference is required');
        }
        if (!info.landlord_name.trim()) {
          throw new Error('Landlord / owner name is required');
        }
        if (!info.landlord_address_line1.trim()) {
          throw new Error('Landlord address line 1 is required');
        }
        if (!info.landlord_city.trim()) {
          throw new Error('Landlord city / town is required');
        }
        if (!info.landlord_postcode.trim()) {
          throw new Error('Landlord postcode is required');
        }

        const combinedPropertyAddress = buildPropertyAddressFromJobAddress(nextJobAddress);
        const combinedLandlordAddress = buildLandlordAddress(
          info.landlord_address_line1,
          info.landlord_address_line2,
          info.landlord_city,
        );
        const data = {
          ...info,
          inspection_date: info.inspection_date || completionDate,
          property_address: combinedPropertyAddress,
          postcode: nextJobAddress.job_postcode || info.postcode,
          landlord_address: combinedLandlordAddress,
        };
        const jobPayload = {
          ...data,
          engineer_name: resolvedInitialInfo.engineer_name ?? '',
          gas_safe_number: resolvedInitialInfo.gas_safe_number ?? '',
          company_name: resolvedInitialInfo.company_name ?? '',
          company_address: resolvedInitialInfo.company_address ?? '',
          company_postcode: resolvedInitialInfo.company_postcode ?? '',
          company_phone: resolvedInitialInfo.company_phone ?? '',
          engineer_phone: resolvedInitialInfo.engineer_phone ?? '',
          job_tel: nextJobAddress.job_tel ?? '',
        };
        await saveCp12JobInfo({ jobId, data: jobPayload });
        await saveJobFields({
          jobId,
          fields: {
            job_reference: nextJobAddress.job_reference,
            job_address_name: nextJobAddress.job_address_name,
            job_address_line1: nextJobAddress.job_address_line1,
            job_address_line2: nextJobAddress.job_address_line2,
            job_address_city: nextJobAddress.job_address_city,
            job_postcode: nextJobAddress.job_postcode,
            job_tel: nextJobAddress.job_tel,
          },
        });
        setJobAddress(nextJobAddress);
        setInfo(data);
        if (prepareOnly) {
          clearDraft();
          router.push('/dashboard');
          return;
        }
        setStep(2);
      } catch (error) {
        pushToast({
          title: 'Could not save job info',
          description: error instanceof Error ? error.message : 'Try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleChecksNext = () => {
    startTransition(async () => {
      try {
        await saveCp12Appliances({ jobId, appliances, defects });
        setStep(4);
      } catch (error) {
        pushToast({
          title: 'Could not save CP12 checks',
          description: error instanceof Error ? error.message : 'Try again.',
          variant: 'error',
        });
      }
    });
  };

  const persistCp12IssueState = async () => {
    if (!isCp12) return;

    const engineerName = resolvedInitialInfo.engineer_name || CP12_DEMO_INFO.engineer_name || '';
    const gasSafeNumber = resolvedInitialInfo.gas_safe_number || CP12_DEMO_INFO.gas_safe_number || '';
    const companyName = resolvedInitialInfo.company_name || CP12_DEMO_INFO.company_name || '';
    const companyAddress = resolvedInitialInfo.company_address || CP12_DEMO_INFO.company_address || '';
    const companyPostcode = resolvedInitialInfo.company_postcode || CP12_DEMO_INFO.company_postcode || '';
    const companyPhone = resolvedInitialInfo.company_phone || CP12_DEMO_INFO.company_phone || '';

    const data = {
      ...info,
      inspection_date: info.inspection_date || completionDate,
      landlord_address: buildLandlordAddress(info.landlord_address_line1, info.landlord_address_line2, info.landlord_city),
    };
    const jobPayload = {
      ...data,
      engineer_name: engineerName,
      gas_safe_number: gasSafeNumber,
      company_name: companyName,
      company_address: companyAddress,
      company_postcode: companyPostcode,
      company_phone: companyPhone,
      job_tel: jobAddress.job_tel || info.customer_phone || '',
    };
    await saveCp12JobInfo({ jobId, data: jobPayload });
    setInfo(data);
    await saveCp12Appliances({ jobId, appliances, defects });
    const cp12SafetyFieldsPayload = {
      emergency_control_accessible: evidenceFields.emergency_control_accessible ?? '',
      gas_tightness_satisfactory: evidenceFields.gas_tightness_satisfactory ?? '',
      pipework_visual_satisfactory: evidenceFields.pipework_visual_satisfactory ?? '',
      equipotential_bonding_satisfactory: evidenceFields.equipotential_bonding_satisfactory ?? '',
      next_inspection_due: evidenceFields.next_inspection_due ?? '',
    };
    await saveJobFields({ jobId, fields: cp12SafetyFieldsPayload });
    await updateField({ jobId, key: 'completion_date', value: completionDate });
  };

  const validateCurrentCp12 = (options: { requireCustomerSignature?: boolean } = {}) => {
    if (!isCp12) return [];
    const requireCustomerSignature = options.requireCustomerSignature ?? true;
    const normalizedInfo = {
      ...info,
      inspection_date: info.inspection_date || completionDate,
      landlord_address: buildLandlordAddress(info.landlord_address_line1, info.landlord_address_line2, info.landlord_city),
    };
    return validateCp12AgainstSpec(
      normalizedInfo,
      appliances,
      defects,
      engineerSignature,
      requireCustomerSignature ? customerSignature : '',
      {
        engineerName: resolvedInitialInfo.engineer_name || CP12_DEMO_INFO.engineer_name || '',
        gasSafeNumber: resolvedInitialInfo.gas_safe_number || CP12_DEMO_INFO.gas_safe_number || '',
        engineerIdCard: resolvedInitialInfo.engineer_id_card_number || '',
        companyName: resolvedInitialInfo.company_name || CP12_DEMO_INFO.company_name || '',
        companyAddress: resolvedInitialInfo.company_address || CP12_DEMO_INFO.company_address || '',
        companyPostcode: resolvedInitialInfo.company_postcode || CP12_DEMO_INFO.company_postcode || '',
        companyPhone: resolvedInitialInfo.company_phone || CP12_DEMO_INFO.company_phone || '',
      },
      { requireCustomerSignature },
    );
  };

  const handleGenerate = () => {
    startTransition(async () => {
      let targetJobId = jobId;
      try {
        const { blockingMissing } = checklist;
        if (blockingMissing > 0) {
          pushToast({
            title: 'Complete required items first',
            description: 'Review the checklist before issuing the certificate.',
            variant: 'error',
          });
          return;
        }
        if (isCp12) {
          await persistCp12IssueState();
        }
        if (isCp12) {
          const errors = validateCurrentCp12();
          if (errors.length) {
            pushToast({
              title: 'CP12 requirements missing',
              description: errors.join('; '),
              variant: 'error',
            });
            return;
          }
        }
        const result = await generateCertificatePdf({
          jobId,
          certificateType,
          previewOnly: false,
          fields: {
            engineer_signature: engineerSignature,
            engineer_signature_path: engineerSignaturePath,
            customer_signature: customerSignature,
            completion_date: completionDate,
            next_inspection_due: evidenceFields.next_inspection_due ?? '',
          },
        });
        const { jobId: resultJobId } = result;
        targetJobId = resultJobId;
        clearDraft();
        const gasWarningNoticeJobs =
          certificateType === 'cp12' && 'gasWarningNoticeJobs' in result && Array.isArray(result.gasWarningNoticeJobs)
            ? result.gasWarningNoticeJobs
            : [];
        pushToast({
          title: `${certificateLabel} generated successfully`,
          description: (
            <Link href={`/jobs/${resultJobId}/pdf?certificateType=${certificateType}`} className="text-[var(--action)] underline">
              Open document preview
            </Link>
          ),
          variant: 'success',
        });
        if (gasWarningNoticeJobs.length) {
          const firstWarningJob = gasWarningNoticeJobs[0] as { href?: string; jobId?: string };
          const href = firstWarningJob.href ?? (firstWarningJob.jobId ? `/wizard/create/gas_warning_notice?jobId=${firstWarningJob.jobId}` : null);
          if (href) {
            pushToast({
              title: 'Gas Warning Notice draft created',
              description: (
                <Link href={href} className="text-[var(--action)] underline">
                  Issue Gas Warning Notice
                </Link>
              ),
              variant: 'success',
            });
          }
        }
      } catch (error) {
        pushToast({
          title: 'Could not generate PDF',
          description: error instanceof Error ? error.message : 'Try again.',
          variant: 'error',
        });
      } finally {
        router.push(`/jobs/${targetJobId}/pdf?certificateType=${certificateType}`);
      }
    });
  };

  const handleCreateRemoteSignatureLink = () => {
    startTransition(async () => {
      try {
        if (isCp12) {
          await persistCp12IssueState();
          const errors = validateCurrentCp12({ requireCustomerSignature: false });
          if (errors.length) {
            pushToast({
              title: 'CP12 requirements missing',
              description: errors.join('; '),
              variant: 'error',
            });
            return;
          }
        }

        const result = await createCp12RemoteSignatureRequest({
          jobId,
          fields: {
            engineer_signature: engineerSignature,
            engineer_signature_path: engineerSignaturePath || undefined,
            completion_date: completionDate,
            next_inspection_due: evidenceFields.next_inspection_due ?? '',
          },
        });
        const absoluteUrl =
          result.shareUrl.startsWith('http') || typeof window === 'undefined'
            ? result.shareUrl
            : new URL(result.shareUrl, window.location.origin).toString();
        setRemoteSignatureLink(absoluteUrl);
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(absoluteUrl);
        }
        clearDraft();
        pushToast({
          title: 'Remote signature link created',
          description: 'The link has been copied to your clipboard.',
          variant: 'success',
        });
      } catch (error) {
        pushToast({
          title: 'Could not create signature link',
          description: error instanceof Error ? error.message : 'Try again.',
          variant: 'error',
        });
      }
    });
  };

  const goBackOneStep = () => setStep((prev) => Math.max(firstStep, prev - 1));

  const setApplianceField = (index: number, key: keyof Cp12Appliance, value: string) => {
    setAppliances((prev) => {
      const next = [...prev];
      const current = { ...next[index] };
      if (key === 'safety_rating') {
        const classification = normalizeSafetyClassification(value);
        const legacy = legacySafetyFromClassification(classification);
        current.safety_rating = legacy.safety_rating || value;
        current.safety_classification = classification;
        current.classification_code = legacy.classification_code;
      } else if (key === 'classification_code') {
        if ((current.safety_rating || '').toLowerCase() === 'safe') {
          current.classification_code = '';
        } else {
          const classification = normalizeSafetyClassification(value);
          const legacy = legacySafetyFromClassification(classification);
          current.classification_code = legacy.classification_code || value.toUpperCase();
          current.safety_classification = classification || normalizeSafetyClassification(current.safety_classification);
        }
      } else {
        (current as Record<keyof Cp12Appliance, Cp12Appliance[keyof Cp12Appliance]>)[key] = value;
      }
      next[index] = current;
      return next;
    });
  };

  const setApplianceBooleanField = (index: number, key: keyof Cp12Appliance, value: boolean) => {
    setAppliances((prev) => {
      const next = [...prev];
      const current = { ...next[index] };
      (current as Record<keyof Cp12Appliance, Cp12Appliance[keyof Cp12Appliance]>)[key] = value;
      next[index] = current;
      return next;
    });
  };

  const setApplianceSafetyClassification = (index: number, classification: Cp12SafetyClassification) => {
    setAppliances((prev) => {
      const next = [...prev];
      const current = { ...next[index] };
      const legacy = legacySafetyFromClassification(classification);
      current.safety_classification = classification;
      current.safety_rating = legacy.safety_rating;
      current.classification_code = legacy.classification_code;
      if (classification === 'safe') {
        current.warning_notice_issued = false;
        current.appliance_disconnected = false;
        current.danger_do_not_use_attached = false;
      }
      next[index] = current;
      return next;
    });
  };

  const applyVoiceReadings = (index: number, values: Partial<Cp12VoiceReadingsParsed>) => {
    setAppliances((prev) => {
      const next = [...prev];
      const current = { ...(next[index] ?? emptyAppliance) };

      if (values.workingPressure) current.operating_pressure = values.workingPressure;
      if (values.heatInput) current.heat_input = values.heatInput;
      if (values.coPpm) current.co_reading_ppm = values.coPpm;
      if (values.highCoPpm) current.high_co_ppm = values.highCoPpm;
      if (values.highCo2Percent) current.high_co2 = values.highCo2Percent;
      if (values.highRatio) current.high_ratio = values.highRatio;
      if (values.lowCoPpm) current.low_co_ppm = values.lowCoPpm;
      if (values.lowCo2Percent) current.low_co2 = values.lowCo2Percent;
      if (values.lowRatio) current.low_ratio = values.lowRatio;

      next[index] = current;
      return next;
    });

    if (values.highCoPpm || values.highCo2Percent || values.highRatio || values.lowCoPpm || values.lowCo2Percent || values.lowRatio) {
      setCombustionOpen((prev) => ({ ...prev, [index]: true }));
    }

    pushToast({
      title: 'Voice readings ready',
      description: 'Review the values in the form before saving.',
      variant: 'success',
    });
  };

  const addAppliance = () =>
    setAppliances((prev) => {
      if (prev.length >= MAX_APPLIANCES) {
        pushToast({
          title: 'Max 5 appliances',
          description: 'The CP12 PDF table fits five appliances. Create another certificate for more.',
          variant: 'default',
        });
        return prev;
      }
      return [...prev, { ...emptyAppliance }];
    });
  const handleEvidenceFieldsUpdate = (updates: Record<string, string>) => {
    setEvidenceFields((prev) => ({ ...prev, ...updates }));
    startTransition(async () => {
      try {
        await saveJobFields({ jobId, fields: updates });
      } catch (error) {
        pushToast({
          title: 'Could not save field',
          description: error instanceof Error ? error.message : 'Try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleSafetyFieldUpdate = (key: string, value: string) => {
    // Normalize pass/fail toggles to YES/NO for PDF mapping.
    const normalized = value === 'pass' ? 'YES' : value === 'fail' ? 'NO' : value;
    setEvidenceFields((prev) => ({ ...prev, [key]: normalized }));
    startTransition(async () => {
      try {
        await saveJobFields({ jobId, fields: { [key]: normalized } });
      } catch (error) {
        pushToast({
          title: 'Could not save field',
          description: error instanceof Error ? error.message : 'Try again.',
          variant: 'error',
        });
      }
    });
  };

  const applianceProfiles = useMemo<ApplianceStepValues[]>(
    () =>
      (appliances.length ? appliances : [emptyAppliance]).map((appliance) => {
        const { make, model } = splitMakeModel(appliance.make_model ?? '');
        return {
          type: appliance.appliance_type ?? '',
          make,
          model,
          location: appliance.location ?? '',
          serial: evidenceFields.serial_number ?? '',
        };
      }),
    [appliances, evidenceFields.serial_number],
  );

  const handleApplianceProfilesChange = (nextProfiles: ApplianceStepValues[]) => {
    const normalizedProfiles = nextProfiles.length ? nextProfiles : [{ type: '', make: '', model: '', location: '', serial: '' }];
    setAppliances(
      normalizedProfiles.map((profile, index) => {
        const current = appliances[index] ?? { ...emptyAppliance };
        return {
          ...current,
          appliance_type: profile.type ?? '',
          location: profile.location ?? '',
          make_model: combineMakeModel(profile.make ?? '', profile.model ?? ''),
        };
      }),
    );
    if (normalizedProfiles[0]) {
      setEvidenceFields((prev) => ({
        ...prev,
        serial_number: normalizedProfiles[0].serial ?? prev.serial_number ?? '',
      }));
    }
  };

  const handleApplianceChecksChange = (index: number, updates: Partial<ChecksStepValues>) => {
    const mapField = (key: keyof ChecksStepValues, value: string | undefined) => {
      if (typeof value !== 'string') return;
      if (key === 'ventilation_satisfactory') setApplianceField(index, 'ventilation_satisfactory', value);
      if (key === 'flue_condition') setApplianceField(index, 'flue_condition', value);
      if (key === 'stability_test') setApplianceField(index, 'stability_test', value);
      if (key === 'gas_tightness_test') setApplianceField(index, 'gas_tightness_test', value);
      if (key === 'operating_pressure') setApplianceField(index, 'operating_pressure', value);
      if (key === 'heat_input') setApplianceField(index, 'heat_input', value);
      if (key === 'co_reading_high') setApplianceField(index, 'co_reading_high', value);
      if (key === 'co_reading_low') setApplianceField(index, 'co_reading_low', value);
      if (key === 'co_reading_ppm') setApplianceField(index, 'co_reading_ppm', value);
      if (key === 'safety_rating') setApplianceField(index, 'safety_rating', value);
      if (key === 'classification_code') setApplianceField(index, 'classification_code', value);
      if (key === 'safety_devices_correct') setApplianceField(index, 'safety_devices_correct', value);
      if (key === 'flue_performance_test') {
        setApplianceField(index, 'flue_performance_test', value);
        // Keep legacy field populated without exposing a separate flue-condition input.
        setApplianceField(index, 'flue_condition', value);
      }
      if (key === 'appliance_serviced') setApplianceField(index, 'appliance_serviced', value);
    };

    (Object.entries(updates) as Array<[keyof ChecksStepValues, string | undefined]>).forEach(([key, value]) =>
      mapField(key, value),
    );
  };

  const VoiceButton = ({ onClick }: { onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white/60 text-muted hover:bg-white"
      aria-label="Voice capture"
    >
      <Mic className="h-3.5 w-3.5" />
    </button>
  );

  const checklist = useMemo(() => {
    const items: ChecklistItem[] = [];

    const engineerName = resolvedInitialInfo.engineer_name || CP12_DEMO_INFO.engineer_name || '';
    const gasSafeNumber = resolvedInitialInfo.gas_safe_number || CP12_DEMO_INFO.gas_safe_number || '';
    const companyName = resolvedInitialInfo.company_name || CP12_DEMO_INFO.company_name || '';
    const engineerIdCard = resolvedInitialInfo.engineer_id_card_number || '';
    const companyAddress = resolvedInitialInfo.company_address || '';
    const companyPostcode = resolvedInitialInfo.company_postcode || '';
    const companyPhone = resolvedInitialInfo.company_phone || '';

    items.push({
      id: 'installer',
      label: 'Engineer & company details present',
      ok:
        hasValue(engineerName) &&
        hasValue(gasSafeNumber) &&
        hasValue(companyName) &&
        hasValue(engineerIdCard) &&
        hasValue(companyAddress) &&
        hasValue(companyPostcode) &&
        hasValue(companyPhone),
      hint: 'Set in Settings',
      blocking: true,
    });

    const addrOk =
      hasValue(jobAddress.job_address_name) && hasValue(jobAddress.job_address_line1) && hasValue(jobAddress.job_postcode) && hasValue(jobAddress.job_tel);
    items.push({
      id: 'job-address',
      label: 'Property reference, job address, postcode, and site telephone',
      ok: addrOk,
      hint: 'Add in People & location',
      action: () => setStep(1),
      blocking: true,
    });

    const landlordOk =
      hasValue(info.landlord_name) &&
      hasValue(info.landlord_address_line1) &&
      hasValue(info.landlord_city) &&
      hasValue(info.landlord_postcode);
    items.push({
      id: 'landlord',
      label: 'Landlord / owner details complete',
      ok: landlordOk,
      hint: 'Fill in People & location',
      action: () => setStep(1),
      blocking: true,
    });

    const applianceChecks: ChecklistItem[] = appliances.map((app, index) => {
      const identityOk = hasValue(app.location) && hasValue(app.appliance_type) && hasValue(app.make_model);
      const readingsOk =
        hasValue(app.operating_pressure) &&
        hasValue(app.heat_input) &&
        hasValue(app.ventilation_satisfactory) &&
        hasValue(app.gas_tightness_test) &&
        hasValue(app.stability_test) &&
        hasValue(app.safety_devices_correct) &&
        hasValue(app.flue_performance_test) &&
        hasValue(app.appliance_serviced) &&
        hasValue(app.safety_rating);
      const ok = identityOk && readingsOk;
      return {
        id: `appliance-${index}`,
        label: `Appliance #${index + 1}: identity + readings complete`,
        ok,
        hint: ok
          ? undefined
          : !identityOk
            ? 'Edit identity in Photos'
            : 'Add checks in Appliance checks',
        action: () => setStep(identityOk ? 3 : 2),
        blocking: true,
      };
    });
    items.push(...applianceChecks);

    items.push({
      id: 'reg26',
      label: 'Regulation 26(9) confirmed',
      ok: booleanFromField(info.reg_26_9_confirmed),
      action: () => setStep(1),
      blocking: true,
    });

    items.push({
      id: 'signatures',
      label: 'Engineer and customer signatures',
      ok: hasValue(engineerSignature) && hasValue(customerSignature),
      action: () => setStep(4),
      blocking: true,
    });

    items.push({
      id: 'completion',
      label: 'Issue date set',
      ok: hasValue(completionDate),
      blocking: true,
    });

    // Non-blocking reminders for fields not yet captured in UI
    items.push({
      id: 'co-alarms',
      label: 'CO alarms fitted & tested',
      ok: hasValue(evidenceFields.co_alarm_fitted) && hasValue(evidenceFields.co_alarm_tested),
      hint: 'Not captured in app yet',
      blocking: false,
    });
    items.push({
      id: 'next-inspection',
      label: 'Next inspection due date',
      ok: hasValue(evidenceFields.next_inspection_due) || hasValue(evidenceFields.next_inspection_date) || hasValue(completionDate),
      hint: 'Defaults to completion date',
      blocking: false,
    });

    const blockingMissing = items.filter((item) => item.blocking !== false && !item.ok).length;
    return { items, blockingMissing };
  }, [
    appliances,
    completionDate,
    resolvedInitialInfo.company_address,
    resolvedInitialInfo.company_phone,
    resolvedInitialInfo.company_postcode,
    resolvedInitialInfo.engineer_id_card_number,
    evidenceFields.co_alarm_fitted,
    evidenceFields.co_alarm_tested,
    evidenceFields.next_inspection_date,
    evidenceFields.next_inspection_due,
    info.landlord_address_line1,
    info.landlord_city,
    info.landlord_postcode,
    info.landlord_name,
    info.reg_26_9_confirmed,
    jobAddress.job_address_name,
    jobAddress.job_address_line1,
    jobAddress.job_postcode,
    jobAddress.job_tel,
    resolvedInitialInfo.company_name,
    resolvedInitialInfo.engineer_name,
    resolvedInitialInfo.gas_safe_number,
    engineerSignature,
    customerSignature,
  ]);


  const StepOne = (
    <WizardLayout
      step={offsetStep(1)}
      total={totalSteps}
      title="People & location"
      status={certificateLabel}
      actionsHideWhenVisibleId="cp12-step1-footer-actions"
      actions={
        <div className="flex justify-end">
          <Button
            onClick={handleInfoNext}
            disabled={isPending}
            className="rounded-full px-6"
            data-testid="cp12-step1-next"
          >
            {isPending ? 'Saving…' : prepareOnly ? 'Save & return' : 'Next → Appliances'}
          </Button>
        </div>
      }
    >
      {isCp12 ? (
        <div className="space-y-3">
          {demoEnabled ? (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-full text-xs"
                onClick={handleDemoFill}
                disabled={isPending}
                data-testid="cp12-demo-fill"
              >
                Fill demo CP12
              </Button>
            </div>
          ) : null}
          <p className="text-sm text-muted">Engineer and company details are pulled from account settings.</p>
          <div className="grid gap-3 rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
            <p className="text-sm font-semibold text-muted">Job location</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                type="date"
                value={info.inspection_date}
                onChange={(e) => setInfo((prev) => ({ ...prev, inspection_date: e.target.value }))}
                placeholder="Inspection date"
                className="rounded-2xl"
              />
              <Input
                value={jobAddress.job_address_name}
                onChange={(e) => setJobAddress((prev) => ({ ...prev, job_address_name: e.target.value }))}
                placeholder="Property name / reference"
                required
                className="rounded-2xl"
              />
              <p className="text-xs text-muted-foreground/70 sm:col-span-2">
                Shown as “Name” in the Job Address section of the certificate.
              </p>
              <div className="relative sm:col-span-2">
                <Input
                  value={addressSearchQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    setAddressSearchQuery(value);
                    setAddressSearchError(null);
                    setSelectedPostcodeMatchId(null);
                    setJobAddress((prev) => ({ ...prev, job_address_line1: value }));
                    setInfo((prev) => ({
                      ...prev,
                      property_address: buildPropertyAddressFromJobAddress({ ...jobAddress, job_address_line1: value }),
                    }));
                  }}
                  placeholder="Start typing address or postcode"
                  className="rounded-2xl"
                />
                {isPostcodeLookupPending && !postcodeSuggestions.length ? (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-muted shadow-lg">
                    Searching addresses…
                  </div>
                ) : null}
                {postcodeSuggestions.length ? (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-lg">
                    <div className="max-h-72 overflow-y-auto p-2">
                      {postcodeSuggestions.map((suggestion) => {
                        const isSelected = selectedPostcodeMatchId === suggestion.id;
                        return (
                          <button
                            key={suggestion.id}
                            type="button"
                            onClick={() => void handleAddressMatchSelect(suggestion)}
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
                {addressSearchError ? <p className="mt-2 text-xs text-red-600">{addressSearchError}</p> : null}
              </div>
              <Input
                value={jobAddress.job_address_line2}
                onChange={(e) => setJobAddress((prev) => ({ ...prev, job_address_line2: e.target.value }))}
                placeholder="Job address line 2"
                className="rounded-2xl sm:col-span-2"
              />
              <Input
                value={jobAddress.job_address_city}
                onChange={(e) => setJobAddress((prev) => ({ ...prev, job_address_city: e.target.value }))}
                placeholder="City / Town"
                className="rounded-2xl"
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={jobAddress.job_postcode}
                  onChange={(e) => {
                    const value = e.target.value;
                    setJobAddress((prev) => ({ ...prev, job_postcode: value }));
                    setInfo((prev) => ({ ...prev, postcode: value }));
                  }}
                  placeholder="Postcode"
                  className="rounded-2xl sm:flex-1"
                />
              </div>
              <Input
                value={jobAddress.job_tel}
                onChange={(e) => setJobAddress((prev) => ({ ...prev, job_tel: e.target.value }))}
                placeholder="Site telephone number"
                className="rounded-2xl"
              />
              <p className="text-xs text-muted-foreground/70 sm:col-span-2">
                Shown as &apos;Tel. No&apos; in the Job Address section of the certificate.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
            <p className="text-sm font-semibold text-muted">Landlord / Property owner</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Required for CP12. This is the property owner, not the billable agent.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input
                value={info.landlord_name}
                onChange={(e) => setInfo((prev) => ({ ...prev, landlord_name: e.target.value }))}
                placeholder="Landlord / Owner name"
                className="rounded-2xl"
                data-testid="cp12-landlord-name"
              />
              <Input
                value={info.landlord_company}
                onChange={(e) => setInfo((prev) => ({ ...prev, landlord_company: e.target.value }))}
                placeholder="Company (optional)"
                className="rounded-2xl"
              />
              <div className="relative sm:col-span-2">
                <Input
                  value={landlordAddressSearchQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    setLandlordAddressSearchQuery(value);
                    setLandlordAddressSearchError(null);
                    setSelectedLandlordMatchId(null);
                    setInfo((prev) => ({
                      ...prev,
                      landlord_address_line1: value,
                      landlord_address: buildLandlordAddress(value, prev.landlord_address_line2, prev.landlord_city),
                    }));
                  }}
                  placeholder="Start typing address or postcode"
                  className="rounded-2xl"
                />
                {isLandlordLookupPending && !landlordAddressSuggestions.length ? (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-muted shadow-lg">
                    Searching addresses…
                  </div>
                ) : null}
                {landlordAddressSuggestions.length ? (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-lg">
                    <div className="max-h-72 overflow-y-auto p-2">
                      {landlordAddressSuggestions.map((suggestion) => {
                        const isSelected = selectedLandlordMatchId === suggestion.id;
                        return (
                          <button
                            key={suggestion.id}
                            type="button"
                            onClick={() => void handleLandlordAddressMatchSelect(suggestion)}
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
                {landlordAddressSearchError ? <p className="mt-2 text-xs text-red-600">{landlordAddressSearchError}</p> : null}
              </div>
              <Input
                value={info.landlord_address_line2}
                onChange={(e) =>
                  setInfo((prev) => ({
                    ...prev,
                    landlord_address_line2: e.target.value,
                    landlord_address: buildLandlordAddress(prev.landlord_address_line1, e.target.value, prev.landlord_city),
                  }))
                }
                placeholder="Address line 2 (optional)"
                className="rounded-2xl sm:col-span-2"
              />
              <Input
                value={info.landlord_city}
                onChange={(e) =>
                  setInfo((prev) => ({
                    ...prev,
                    landlord_city: e.target.value,
                    landlord_address: buildLandlordAddress(prev.landlord_address_line1, prev.landlord_address_line2, e.target.value),
                  }))
                }
                placeholder="City / Town"
                className="rounded-2xl"
              />
              <Input
                value={info.landlord_postcode}
                onChange={(e) => setInfo((prev) => ({ ...prev, landlord_postcode: e.target.value }))}
                placeholder="Postcode"
                className="rounded-2xl"
              />
              <Input
                value={info.landlord_tel}
                onChange={(e) => setInfo((prev) => ({ ...prev, landlord_tel: e.target.value }))}
                placeholder="Tel. No. (optional)"
                className="rounded-2xl sm:col-span-2"
              />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-white/40 bg-white/70 p-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-[var(--accent)]"
              checked={info.reg_26_9_confirmed}
              onChange={(e) => setInfo((prev) => ({ ...prev, reg_26_9_confirmed: e.target.checked }))}
            />
            <div>
              <p className="text-sm font-semibold text-muted">Regulation 26(9) confirmed</p>
              <p className="text-xs text-muted-foreground/70">Required before issuing a CP12 (see docs/specs/cp12.md).</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground/70">Non-CP12 certificates currently use the simplified flow.</p>
      )}
      <div id="cp12-step1-footer-actions" className="mt-6 flex justify-end">
        <Button
          onClick={handleInfoNext}
          disabled={isPending}
          className="rounded-full px-6"
          data-testid="cp12-step1-next"
        >
          {isPending ? 'Saving…' : prepareOnly ? 'Save & return' : 'Next → Appliances'}
        </Button>
      </div>
    </WizardLayout>
  );

  const StepTwo = (
    <WizardLayout
      step={offsetStep(2)}
      total={totalSteps}
      title="Appliance details"
      status="Identity & photos"
      onBack={goBackOneStep}
      actionsHideWhenVisibleId="cp12-step2-footer-actions"
      actions={
        <div className="flex justify-end">
          <Button onClick={() => setStep(3)} disabled={isPending} className="rounded-full px-6">
            Next → Checks
          </Button>
        </div>
      }
    >
      {demoEnabled ? (
        <div className="flex justify-end">
          <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
            Fill demo CP12
          </Button>
        </div>
      ) : null}
      <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
        <p className="text-sm font-semibold text-muted">Appliance profile</p>
        <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm space-y-3">
          <ApplianceStep
            appliances={applianceProfiles}
            onAppliancesChange={handleApplianceProfilesChange}
            typeOptions={BOILER_TYPE_OPTIONS}
            allowMultiple
            showExtendedFields={false}
            showYear={false}
            applyExtendedDefaults={false}
            inlineEditor
          />
          <div className="mt-3 flex flex-col items-end gap-1">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={addAppliance}
              disabled={appliances.length >= MAX_APPLIANCES}
            >
              + Add another appliance
            </Button>
            {appliances.length >= MAX_APPLIANCES ? (
              <p className="text-xs text-muted-foreground/70">
                CP12 PDF fits up to five appliances. Start another certificate for more.
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {CP12_EVIDENCE_CONFIG.filter(
          (category) =>
            ![
              'flue_photo',
              'meter_reading',
              'issue_photo',
              'appliance_photo',
              'ventilation',
              'serial_label',
            ].includes(category.key),
        ).map((category) => (
          <EvidenceCard
            key={category.key}
            title={category.title}
            fields={category.fields}
            values={evidenceFields}
            onChange={(key, value) => {
              handleEvidenceFieldsUpdate({ [key]: value });
            }}
            photoPreview={initialPhotoPreviews[category.key]}
            onPhotoUpload={(file) => {
              startTransition(async () => {
                const data = new FormData();
                data.append('jobId', jobId);
                data.append('category', category.key);
                data.append('file', file);
                try {
                  await uploadJobPhoto(data);
                  pushToast({ title: `${category.title} photo saved`, variant: 'success' });
                } catch (error) {
                  pushToast({
                    title: 'Upload failed',
                    description: error instanceof Error ? error.message : 'Try again.',
                    variant: 'error',
                  });
                }
              });
            }}
            onVoice={() =>
              pushToast({
                title: 'Voice capture',
                description: 'Whisper capture coming soon. Add a quick text note for now.',
                variant: 'default',
              })
            }
            onText={() => {
              // Inputs are already editable; keep for parity with other actions
              pushToast({ title: 'Manual entry', description: 'Edit the fields directly above.', variant: 'default' });
            }}
          />
        ))}
      </div>
      <div id="cp12-step2-footer-actions" className="mt-6 flex justify-end">
        <Button onClick={() => setStep(3)} disabled={isPending} className="rounded-full px-6">
          Next → Checks
        </Button>
      </div>
    </WizardLayout>
  );

  const StepThree = (
    <WizardLayout
      step={offsetStep(3)}
      total={totalSteps}
      title="Appliance checks"
      status="On-site checks"
      onBack={goBackOneStep}
      actionsHideWhenVisibleId="cp12-step3-footer-actions"
      actions={
        <div className="mt-6 flex justify-end">
          <Button onClick={handleChecksNext} disabled={isPending} className="rounded-full px-6">
            Next → Sign
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {demoEnabled && (
          <div className="flex justify-end">
            <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
              Fill demo CP12
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-white/20 bg-white/80 p-3">
          <p className="text-sm font-semibold text-muted">Measurement source</p>
          <div className="flex gap-2">
            {(['manual', 'tpi'] as const).map((source) => (
              <Button
                key={source}
                type="button"
                variant={measurementSource === source ? 'primary' : 'outline'}
                className="rounded-full text-xs"
                onClick={() => setMeasurementSource(source)}
              >
                {source === 'manual' ? 'Manual entry' : 'TPI connected'}
              </Button>
            ))}
          </div>
          {measurementSource === 'tpi' ? (
            <p className="text-xs text-muted-foreground/70">Readings are locked and treated as captured from the meter.</p>
          ) : (
            <p className="text-xs text-muted-foreground/70">Default: enter measurements by hand.</p>
          )}
        </div>
        <div className="space-y-4">
          {appliances.map((appliance, index) => (
            <div
              key={`checks-${index}`}
              ref={(el) => {
                applianceRefs.current[index] = el;
              }}
              className="rounded-3xl border border-white/40 bg-white p-4 shadow-md"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-muted">Appliance #{index + 1} checks</p>
                <Cp12VoiceReadings
                  jobId={jobId}
                  disabled={measurementSource === 'tpi'}
                  onApply={(values) => applyVoiceReadings(index, values)}
                />
              </div>
              <div className="mt-4">
                <div className="mb-4">
                  <SearchableSelect
                    label={`Appliance ${index + 1} flue type`}
                    value={appliance.flue_type ?? ''}
                    options={[...CP12_FLUE_TYPES]}
                    placeholder="Select or type"
                    onChange={(val) => setApplianceField(index, 'flue_type', val)}
                  />
                </div>
                <ChecksStep
                  values={{
                    ventilation_satisfactory: appliance.ventilation_satisfactory ?? '',
                    stability_test: appliance.stability_test ?? '',
                    gas_tightness_test: appliance.gas_tightness_test ?? '',
                    operating_pressure: appliance.operating_pressure ?? '',
                    heat_input: appliance.heat_input ?? '',
                    co_reading_ppm: appliance.co_reading_ppm ?? '',
                    safety_devices_correct: appliance.safety_devices_correct ?? '',
                    flue_performance_test: appliance.flue_performance_test ?? '',
                    appliance_serviced: appliance.appliance_serviced ?? '',
                  }}
                  onChange={(updates) => handleApplianceChecksChange(index, updates)}
                  measurementSource={measurementSource}
                  measurementReadOnly={measurementSource === 'tpi'}
                />
                {(() => {
                  const classification = getApplianceSafetyClassification(appliance);
                  const showUnsafeFields = classification && classification !== 'safe';
                  return (
                    <div className="mt-4 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-3 shadow-sm">
                      <EnumChips
                        label="Safety classification"
                        value={classification}
                        options={CP12_SAFETY_CLASSIFICATION_OPTIONS}
                        onChange={(val) => setApplianceSafetyClassification(index, val as Cp12SafetyClassification)}
                      />
                      {showUnsafeFields ? (
                        <div className="mt-4 space-y-3">
                          <Textarea
                            value={appliance.defect_notes ?? ''}
                            onChange={(e) => setApplianceField(index, 'defect_notes', e.target.value)}
                            placeholder="Defect notes"
                            className="min-h-[80px] bg-white"
                          />
                          <Textarea
                            value={appliance.actions_taken ?? ''}
                            onChange={(e) => setApplianceField(index, 'actions_taken', e.target.value)}
                            placeholder="Actions taken"
                            className="min-h-[80px] bg-white"
                          />
                          <Textarea
                            value={appliance.actions_required ?? ''}
                            onChange={(e) => setApplianceField(index, 'actions_required', e.target.value)}
                            placeholder="Actions required"
                            className="min-h-[80px] bg-white"
                          />
                          <div className="grid gap-2 text-sm text-muted sm:grid-cols-3">
                            <label className="flex items-start gap-2 rounded-2xl bg-white/80 p-3">
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4 accent-[var(--accent)]"
                                checked={appliance.warning_notice_issued ?? false}
                                onChange={(e) => setApplianceBooleanField(index, 'warning_notice_issued', e.target.checked)}
                              />
                              <span>Warning notice issued</span>
                            </label>
                            <label className="flex items-start gap-2 rounded-2xl bg-white/80 p-3">
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4 accent-[var(--accent)]"
                                checked={appliance.appliance_disconnected ?? false}
                                onChange={(e) => setApplianceBooleanField(index, 'appliance_disconnected', e.target.checked)}
                              />
                              <span>Appliance disconnected</span>
                            </label>
                            <label className="flex items-start gap-2 rounded-2xl bg-white/80 p-3">
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4 accent-[var(--accent)]"
                                checked={appliance.danger_do_not_use_attached ?? false}
                                onChange={(e) => setApplianceBooleanField(index, 'danger_do_not_use_attached', e.target.checked)}
                              />
                              <span>Danger Do Not Use attached</span>
                            </label>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground/70">
                          Use NCS, AR, or ID to record defect notes and unsafe-state actions for this appliance.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="mt-4 rounded-2xl border border-white/30 bg-white/75 p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Combustion readings</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full px-3 py-1 text-xs"
                    onClick={() =>
                      setCombustionOpen((prev) => ({
                        ...prev,
                        [index]: !(prev[index] ?? false),
                      }))
                    }
                  >
                    {combustionOpen[index] ? 'Hide' : 'Show'}
                  </Button>
                </div>
                {combustionOpen[index] ? (
                  <div className="mt-3 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/25 bg-white/80 p-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">High combustion reading</p>
                        <div className="mt-2 grid gap-3 sm:grid-cols-3">
                          <UnitNumberInput
                            label="CO ppm"
                            unit="ppm"
                            value={appliance.high_co_ppm ?? ''}
                            onChange={(val) => setApplianceField(index, 'high_co_ppm', val)}
                            disabled={measurementSource === 'tpi'}
                            note={measurementSource === 'tpi' ? 'Captured from meter' : undefined}
                          />
                          <UnitNumberInput
                            label="CO2 %"
                            unit="%"
                            value={appliance.high_co2 ?? ''}
                            onChange={(val) => setApplianceField(index, 'high_co2', val)}
                            disabled={measurementSource === 'tpi'}
                            note={measurementSource === 'tpi' ? 'Captured from meter' : undefined}
                          />
                          <UnitNumberInput
                            label="Ratio"
                            unit="ratio"
                            value={appliance.high_ratio ?? ''}
                            onChange={(val) => setApplianceField(index, 'high_ratio', val)}
                            disabled={measurementSource === 'tpi'}
                            note={measurementSource === 'tpi' ? 'Captured from meter' : undefined}
                          />
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/25 bg-white/80 p-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Low combustion reading</p>
                        <div className="mt-2 grid gap-3 sm:grid-cols-3">
                          <UnitNumberInput
                            label="CO ppm"
                            unit="ppm"
                            value={appliance.low_co_ppm ?? ''}
                            onChange={(val) => setApplianceField(index, 'low_co_ppm', val)}
                            disabled={measurementSource === 'tpi'}
                            note={measurementSource === 'tpi' ? 'Captured from meter' : undefined}
                          />
                          <UnitNumberInput
                            label="CO2 %"
                            unit="%"
                            value={appliance.low_co2 ?? ''}
                            onChange={(val) => setApplianceField(index, 'low_co2', val)}
                            disabled={measurementSource === 'tpi'}
                            note={measurementSource === 'tpi' ? 'Captured from meter' : undefined}
                          />
                          <UnitNumberInput
                            label="Ratio"
                            unit="ratio"
                            value={appliance.low_ratio ?? ''}
                            onChange={(val) => setApplianceField(index, 'low_ratio', val)}
                            disabled={measurementSource === 'tpi'}
                            note={measurementSource === 'tpi' ? 'Captured from meter' : undefined}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                        <span>Combustion notes (optional)</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="flex items-center gap-1 rounded-md border border-white/30 bg-white/80 px-3 py-1 text-[11px] font-semibold text-muted shadow-sm transition hover:border-[var(--accent)]"
                            onClick={() =>
                              pushToast({
                                title: 'Photo',
                                description: 'Attach FGA screenshots via Photos on the next step.',
                                variant: 'default',
                              })
                            }
                          >
                            📷 Photo
                          </button>
                          <VoiceButton
                            onClick={() =>
                              pushToast({
                                title: 'Voice capture',
                                description: 'Whisper capture will drop notes here soon.',
                                variant: 'default',
                              })
                            }
                          />
                          <button
                            type="button"
                            className="flex items-center gap-1 rounded-md border border-white/30 bg-white/80 px-3 py-1 text-[11px] font-semibold text-muted shadow-sm transition hover:border-[var(--accent)]"
                            onClick={() =>
                              pushToast({
                                title: 'Text',
                                description: 'Add any notes below.',
                                variant: 'default',
                              })
                            }
                          >
                            ⌨️ Text
                          </button>
                        </div>
                      </div>
                      <Textarea
                        value={appliance.combustion_notes ?? ''}
                        onChange={(e) => setApplianceField(index, 'combustion_notes', e.target.value)}
                        placeholder="Any combustion notes or analyser references"
                        className="min-h-[90px]"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
          <p className="text-sm font-semibold text-muted">Whole-house safety</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <PassFailToggle
              label="Emergency control accessible"
              value={booleanFromField(evidenceFields.emergency_control_accessible) ? 'pass' : null}
              onChange={(val) => handleSafetyFieldUpdate('emergency_control_accessible', val ?? '')}
            />
            <PassFailToggle
              label="Gas tightness satisfactory"
              value={booleanFromField(evidenceFields.gas_tightness_satisfactory) ? 'pass' : null}
              onChange={(val) => handleSafetyFieldUpdate('gas_tightness_satisfactory', val ?? '')}
            />
            <PassFailToggle
              label="Pipework visual inspection satisfactory"
              value={booleanFromField(evidenceFields.pipework_visual_satisfactory) ? 'pass' : null}
              onChange={(val) => handleSafetyFieldUpdate('pipework_visual_satisfactory', val ?? '')}
            />
            <PassFailToggle
              label="Equipotential bonding satisfactory"
              value={booleanFromField(evidenceFields.equipotential_bonding_satisfactory) ? 'pass' : null}
              onChange={(val) => handleSafetyFieldUpdate('equipotential_bonding_satisfactory', val ?? '')}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
          <p className="text-sm font-semibold text-muted">CO alarms</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <PassFailToggle
              label="CO alarm fitted"
              value={booleanFromField(evidenceFields.co_alarm_fitted) ? 'pass' : null}
              onChange={(val) => handleSafetyFieldUpdate('co_alarm_fitted', val ?? '')}
            />
            <PassFailToggle
              label="CO alarm tested"
              value={booleanFromField(evidenceFields.co_alarm_tested) ? 'pass' : null}
              onChange={(val) => handleSafetyFieldUpdate('co_alarm_tested', val ?? '')}
            />
            <PassFailToggle
              label="CO alarm satisfactory"
              value={booleanFromField(evidenceFields.co_alarm_satisfactory) ? 'pass' : null}
              onChange={(val) => handleSafetyFieldUpdate('co_alarm_satisfactory', val ?? '')}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm font-semibold text-muted">
            <span>Comments (optional)</span>
            <VoiceButton
              onClick={() =>
                pushToast({ title: 'Voice capture', description: 'Whisper will fill this soon.', variant: 'default' })
              }
            />
          </div>
          <Textarea
            className="mt-3 min-h-[90px]"
            value={evidenceFields.comments ?? ''}
            onChange={(e) => handleEvidenceFieldsUpdate({ comments: e.target.value })}
            placeholder="Site notes or comments that appear on the CP12"
          />
        </div>

        
      </div>
      <div id="cp12-step3-footer-actions" className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" className="rounded-full" onClick={goBackOneStep} disabled={isPending}>
          Back
        </Button>
        <Button onClick={handleChecksNext} disabled={isPending} className="rounded-full px-6">
          Next → Sign
        </Button>
      </div>
    </WizardLayout>
  );

  const StepFour = (
    <WizardLayout
      step={offsetStep(4)}
      total={totalSteps}
      title="Signatures & PDF"
      status="Finish"
      onBack={goBackOneStep}
      actionsHideWhenVisibleId="cp12-step4-footer-actions"
          actions={
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="rounded-full" onClick={() => setStep(1)}>
            Edit before send
          </Button>
          <Button
            className="rounded-full bg-[var(--action)] px-6 text-white"
            disabled={isPending || checklist.blockingMissing > 0}
            onClick={handleGenerate}
            data-testid="cp12-issue"
          >
            {isPending ? 'Issuing…' : 'Issue Certificate'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted">Ready to issue?</p>
            <p className="text-xs text-muted-foreground/70">
              {checklist.blockingMissing > 0 ? `${checklist.blockingMissing} required item(s) missing` : 'All required items complete'}
            </p>
          </div>
          <div className="mt-3 space-y-2">
            {checklist.items.map((item) => (
              <div
                key={item.id}
                className={`flex items-start gap-2 rounded-2xl px-3 py-2 text-sm ${
                  item.ok ? 'bg-[var(--muted)]/40 text-muted' : item.blocking !== false ? 'bg-amber-50 text-amber-900' : 'bg-white/60 text-muted'
                }`}
              >
                <span className="mt-1 text-base">{item.ok ? '✅' : item.blocking === false ? 'ℹ️' : '⚠️'}</span>
                <div className="flex-1">
                  <p className="font-semibold">{item.label}</p>
                  {!item.ok && item.hint ? <p className="text-xs text-muted-foreground/80">{item.hint}</p> : null}
                </div>
                {!item.ok && item.action ? (
                  <Button type="button" variant="ghost" className="rounded-full px-3 py-1 text-xs" onClick={item.action}>
                    Go
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <SignatureCard
          label="Customer"
          existingUrl={customerSignature as string}
          onUpload={(file) => {
            const data = new FormData();
            data.append('jobId', jobId);
            data.append('role', 'customer');
            data.append('file', file);
            startTransition(async () => {
              try {
                const { url } = await uploadSignature(data);
                setCustomerSignature(url);
                pushToast({ title: 'Customer signature saved', variant: 'success' });
              } catch (error) {
                pushToast({
                  title: 'Could not save signature',
                  description: error instanceof Error ? error.message : 'Try again.',
                  variant: 'error',
                });
              }
            });
          }}
        />
        <SignatureCard
          label="Engineer"
          existingUrl={engineerSignature as string}
          onUpload={(file) => {
            const data = new FormData();
            data.append('jobId', jobId);
            data.append('role', 'engineer');
            data.append('file', file);
            startTransition(async () => {
              try {
                const { url, path } = await uploadSignature(data);
                setEngineerSignature(url);
                setEngineerSignaturePath(path);
                pushToast({ title: 'Engineer signature saved', variant: 'success' });
              } catch (error) {
                pushToast({
                  title: 'Could not save signature',
                  description: error instanceof Error ? error.message : 'Try again.',
                  variant: 'error',
                });
              }
            });
          }}
        />
        {remoteSignatureLink ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm">
            <p className="text-sm font-semibold text-emerald-900">Remote landlord signature link ready</p>
            <p className="mt-1 text-xs text-emerald-800/80">
              Share this link with the landlord or responsible person to review and sign the CP12 remotely.
            </p>
            <div className="mt-3 rounded-2xl border border-emerald-200 bg-white/90 px-3 py-2 text-xs text-emerald-950">
              {remoteSignatureLink}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={async () => {
                  if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(remoteSignatureLink);
                    pushToast({ title: 'Signature link copied', variant: 'success' });
                  }
                }}
              >
                Copy link
              </Button>
              <Link
                href={remoteSignatureLink}
                target="_blank"
                className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-medium text-emerald-900 ring-1 ring-emerald-200"
              >
                Open signature page
              </Link>
            </div>
          </div>
        ) : null}
        <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
          <p className="text-sm font-semibold text-muted">Completion</p>
          <Input
            type="date"
            value={completionDate}
            onChange={(e) => setCompletionDate(e.target.value)}
            className="mt-2"
          />
        </div>
        <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
          <p className="text-sm font-semibold text-muted">Next inspection due</p>
          <Input
            type="date"
            value={evidenceFields.next_inspection_due ?? ''}
            onChange={(e) => handleEvidenceFieldsUpdate({ next_inspection_due: e.target.value })}
            className="mt-2"
          />
        </div>
        <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
          <p className="text-sm font-semibold text-muted">Evidence photos (optional)</p>
          <div className="mt-3">
            <EvidenceCard
              title="Upload photos"
              fields={[]}
              values={{}}
              onChange={() => null}
              photoPreview={initialPhotoPreviews[FINAL_EVIDENCE_DEFAULT]}
              onPhotoUpload={handleEvidenceUpload(FINAL_EVIDENCE_DEFAULT)}
            />
          </div>
        </div>
      </div>
      <div id="cp12-step4-footer-actions" className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" className="rounded-full" onClick={() => setStep(1)}>
          Edit before send
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={isPending}
          onClick={handleCreateRemoteSignatureLink}
        >
          {isPending ? 'Preparing link…' : 'Send to landlord for signature'}
        </Button>
        <Button
          className="rounded-full bg-[var(--action)] px-6 text-white"
          disabled={isPending || checklist.blockingMissing > 0}
          onClick={handleGenerate}
          data-testid="cp12-issue"
        >
          {isPending ? 'Issuing…' : 'Issue Certificate'}
        </Button>
      </div>
    </WizardLayout>
  );

  if (step === 1) return StepOne;
  if (step === 2) return StepTwo;
  if (step === 3) return StepThree;
  return StepFour;
}

const CP12_REQUIRED_FIELDS = ['property_address', 'inspection_date', 'landlord_name'] as const;

const hasValue = (val: unknown) => typeof val === 'string' && val.trim().length > 0;
const booleanFromField = (val: unknown) => val === true || val === 'true' || val === 'YES' || val === 'yes';

// Client-side guardrails that mirror docs/specs/cp12.md; server enforces the same before PDF generation.
function validateCp12AgainstSpec(
  info: Cp12InfoState,
  appliances: Cp12Appliance[],
  defects: { defect_description?: string | null; remedial_action?: string | null; warning_notice_issued?: string | null },
  engineerSignature: string,
  customerSignature: string,
  profileDefaults: {
    engineerName?: string;
    gasSafeNumber?: string;
    engineerIdCard?: string;
    companyName?: string;
    companyAddress?: string;
    companyPostcode?: string;
    companyPhone?: string;
  },
  options: { requireCustomerSignature?: boolean } = {},
) {
  const requireCustomerSignature = options.requireCustomerSignature ?? true;
  const errors: string[] = [];
  CP12_REQUIRED_FIELDS.forEach((key) => {
    if (!hasValue(info[key])) errors.push(`${key.replace(/_/g, ' ')} is required`);
  });
  if (!hasValue(info.landlord_address_line1)) {
    errors.push('landlord address line 1 is required');
  }
  if (!hasValue(info.landlord_city)) {
    errors.push('landlord city is required');
  }
  if (!hasValue(info.landlord_postcode)) {
    errors.push('landlord postcode is required');
  }
  const propertyAddress = (info.property_address ?? '').trim();
  const landlordAddress = buildLandlordAddress(info.landlord_address_line1, info.landlord_address_line2, info.landlord_city).trim();
  if (propertyAddress && landlordAddress && propertyAddress === landlordAddress) {
    errors.push('Landlord address must be different from the property address');
  }
  if (!hasValue(profileDefaults.engineerName)) {
    errors.push('Engineer name is required (set it in Settings)');
  }
  if (!hasValue(profileDefaults.gasSafeNumber)) {
    errors.push('Gas Safe registration number is required (set it in Settings)');
  }
  if (!hasValue(profileDefaults.engineerIdCard)) {
    errors.push('Engineer ID card number is required (set it in Settings)');
  }
  if (!hasValue(profileDefaults.companyName)) {
    errors.push('Company name is required (set it in Settings)');
  }
  if (!hasValue(profileDefaults.companyAddress)) {
    errors.push('Company address is required (set it in Settings)');
  }
  if (!hasValue(profileDefaults.companyPostcode)) {
    errors.push('Company postcode is required (set it in Settings)');
  }
  if (!hasValue(profileDefaults.companyPhone)) {
    errors.push('Company phone is required (set it in Settings)');
  }
  // Engineer/company details are sourced from account settings and signatures; no field entry required here.
  if (!booleanFromField(info.reg_26_9_confirmed)) {
    errors.push('Regulation 26(9) confirmation is required');
  }
  if ((appliances ?? []).length > MAX_APPLIANCES) {
    errors.push(`Only ${MAX_APPLIANCES} appliances can be added to a single CP12`);
  }

  const applianceRows = (appliances ?? []).filter(
    (app) => hasValue(app?.appliance_type) || hasValue(app?.location),
  );
  if (!applianceRows.length) {
    errors.push('At least one appliance with location and description is required');
  } else if (applianceRows.some((app) => !hasValue(app?.location) || !hasValue(app?.appliance_type))) {
    errors.push('Each appliance must include location and description');
  }
  applianceRows.forEach((app, index) => {
    const missing: string[] = [];
    if (!hasValue(app.operating_pressure)) missing.push('operating pressure');
    if (!hasValue(app.heat_input)) missing.push('heat input');
    if (!hasValue(app.safety_devices_correct)) missing.push('safety devices check');
    if (!hasValue(app.ventilation_satisfactory)) missing.push('ventilation check');
    if (!hasValue(app.flue_performance_test)) missing.push('flue performance test');
    if (!hasValue(app.appliance_serviced)) missing.push('appliance serviced');
    if (!getApplianceSafetyClassification(app)) missing.push('safety classification');
    if (!hasValue(app.gas_tightness_test)) missing.push('gas tightness');
    if (!hasValue(app.stability_test)) missing.push('stability test');
    if (missing.length) errors.push(`Appliance #${index + 1}: ${missing.join(', ')} required`);
  });
  applianceRows.forEach((app) => {
    if (hasValue(app.classification_code) && (app.safety_rating ?? '').toLowerCase() === 'safe') {
      errors.push('Classification code should only be set when safety classification is not safe');
    }
  });
  if (!hasValue(engineerSignature)) errors.push('Engineer signature is required');
  if (requireCustomerSignature && !hasValue(customerSignature)) errors.push('Customer signature is required');
  return errors;
}
