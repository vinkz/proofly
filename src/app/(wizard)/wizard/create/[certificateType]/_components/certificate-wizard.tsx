'use client';

import { Fragment, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { WizardLayout } from '@/components/certificates/wizard-layout';
import { OfflineDraftBanner } from '@/components/certificates/offline-draft-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SignatureCard } from '@/components/certificates/signature-card';
import { EvidenceCard } from './evidence-card';
import { ApplianceStep, type ApplianceStepValues } from '@/components/wizard/steps/appliance-step';
import { SearchableSelect } from '@/components/wizard/inputs/searchable-select';
import { PassFailToggle } from '@/components/wizard/inputs/pass-fail-toggle';
import { visibleCp12ApplianceChecks } from '@/lib/cp12/applianceChecks';
import type { ClientListItem } from '@/types/client';

/** Answer set for checks that record whether something was done, not tested. */
const YES_NO_OPTIONS = [
  { label: 'Yes', value: 'Yes' },
  { label: 'No', value: 'No' },
];
import { UnitNumberInput } from '@/components/wizard/inputs/unit-number-input';
import { type CertificateType, type Cp12Appliance, type Cp12SafetyClassification, type PhotoCategory } from '@/types/certificates';
import {
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
  CP12_GAS_TYPES,
  DEFAULT_CP12_FLUE_TYPE,
  CP12_DEMO_APPLIANCE,
  CP12_DEMO_INFO,
  CP12_EVIDENCE_CONFIG,
} from '@/types/cp12';
import { saveJobFields } from '@/server/certificates';
import { mergeJobContextFields, type InitialJobContext } from './initial-job-context';
import type { AddressLookupResult, AddressLookupSuggestion } from '@/lib/address-lookup';
import { buildWizardDraftStorageKey, useWizardDraft } from '@/hooks/use-wizard-draft';
import { useWizardStepHistory } from '@/hooks/use-wizard-step-history';
import { getMakes } from '@/lib/applianceCatalog/ukBoilers';
import { getApplianceCatalog } from '@/lib/applianceCatalog/ukAppliances';
import { Cp12VoiceReadings } from '@/components/cp12/cp12-voice-readings';
import type { Cp12VoiceReadingsParsed } from '@/lib/cp12/voice-readings';
import { validateCp12TierOne } from '@/lib/cp12/validation';
import { UnsafeSituationFields } from '@/components/cp12/unsafe-situation';
import {
  giuspFieldKey,
  readGiuspAnswers,
  type GiuspAnswerKey,
} from '@/lib/cp12/giusp';
import { composeCp12DefectSummary, cp12ApplianceHasFailedCheck, cp12FailedChecks } from '@/lib/cp12/defect-summary';
import {
  ACTION_REQUIRED_PRESETS,
  ACTION_TAKEN_PRESETS,
  UNSAFE_SITUATION_PRESETS,
  appendPresetSnippet,
} from '@/lib/gas-safety/unsafe-presets';
import { EnumChips } from '@/components/wizard/inputs/enum-chips';
import { LimitReachedModal } from '@/components/billing/limit-reached-modal';
import {
  CP12_APPLIANCE_CATEGORIES,
  CP12_BOILER_SUBTYPES,
  DEFAULT_CP12_CATEGORY,
  cp12FieldVisible,
  cp12FieldVisibility,
  resolveCp12Category,
  resolveCp12Subtype,
  type Cp12ApplianceCategory,
} from '@/lib/cp12/applianceConfig';
import { toUserMessage } from '@/lib/user-errors';

type WizardProps = {
  jobId: string;
  certificateType: CertificateType;
  certificateLabel: string;
  initialInfo?: Record<string, string | null | undefined>;
  initialJobContext?: InitialJobContext | null;
  initialPhotoPreviews?: Record<string, string>;
  initialAppliances?: Cp12Appliance[];
  /**
   * Saved landlords, offered as prefill at the top of the single-page layout.
   *
   * Choosing one used to be a separate route into the wizard — a picker screen
   * before the form. It is not a different way of making a certificate, only a
   * faster way of filling one in, so on one page it belongs on the page.
   */
  clients?: ClientListItem[];
  stepOffset?: number;
  startStep?: number;
  hideBillingCustomerStep?: boolean;
  prepareOnly?: boolean;
  invoiceReadiness?: {
    ready: boolean;
    hasStandardRates: boolean;
    hasBankTransferDetails: boolean;
    missingFields: string[];
  };
};

const emptyAppliance: Cp12Appliance = {
  appliance_type: DEFAULT_CP12_CATEGORY,
  appliance_subtype: '',
  cooker_stability: '',
  landlords_appliance: 'Yes',
  appliance_inspected: 'Yes',
  location: '',
  gc_number: '',
  gas_type: '',
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
  // See DEFAULT_CP12_FLUE_TYPE: an unset flue type offers the room-sealed test
  // and the open-flued pair simultaneously.
  flue_type: DEFAULT_CP12_FLUE_TYPE,
  flue_location: '',
  ventilation_provision: '',
  ventilation_satisfactory: '',
  flue_condition: '',
  stability_test: '',
  gas_tightness_test: '',
  co_reading_ppm: '',
  safety_devices_correct: '',
  flue_performance_test: '',
  flue_integrity_test: '',
  flue_integrity_co2_high: '',
  flue_integrity_co2_low: '',
  spillage_test: '',
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
  reg_26_9_confirmed: false,
};

const MAX_APPLIANCES = 5;
const DEMO_FILL_VISIBLE = process.env.NEXT_PUBLIC_SHOW_DEMO_AUTOFILL === 'true';

const KNOWN_MAKES = getMakes()
  .filter((make) => make.toLowerCase() !== 'other')
  .sort((a, b) => b.length - a.length);

// A CP12 is valid for 12 months, so the next inspection defaults to one year after
// completion. Returns '' for unparseable input so callers can fall back gracefully.
const addOneYearDateOnly = (value: string | null | undefined): string => {
  const dateOnly = String(value ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return '';
  const date = new Date(`${dateOnly}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
};

const splitMakeModel = (value: string, category: Cp12ApplianceCategory = 'boiler') => {
  const trimmed = value.trim();
  if (!trimmed) return { make: '', model: '' };
  // The appliance editor lets the user pick from a category-specific catalog (hob/cooker,
  // gas fire, water heater, etc. each have their own makes), so the split has to check
  // those makes too — not just the boiler-only KNOWN_MAKES — or non-boiler makes fall
  // through to the "unrecognised" branch and the whole string lands in `make` with `model`
  // left blank.
  const categoryMakes = getApplianceCatalog(category)
    .getMakes()
    .filter((make) => make.toLowerCase() !== 'other');
  const candidateMakes = Array.from(new Set([...categoryMakes, ...KNOWN_MAKES])).sort((a, b) => b.length - a.length);
  const knownMake = candidateMakes.find((make) => trimmed.toLowerCase().startsWith(make.toLowerCase()));
  if (knownMake) {
    return { make: knownMake, model: trimmed.slice(knownMake.length).trim() };
  }
  return { make: trimmed, model: '' };
};

const combineMakeModel = (make: string, model: string) => [make.trim(), model.trim()].filter(Boolean).join(' ').trim();

const getAddressLookupErrorMessage = (error: unknown, fallback: string) => {
  if (
    error instanceof Error &&
    ['Address lookup disabled', 'Address lookup is disabled', 'Address lookup is not configured'].includes(error.message)
  ) {
    return null;
  }

  return toUserMessage(error, fallback);
};

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
  landlord_email: string;
  landlord_mobile: string;
  landlord_address: string;
  reg_26_9_confirmed: boolean;
  company_address: string;
  company_postcode: string;
  company_phone: string;
  engineer_phone: string;
  tenant_email: string;
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
  defects: {
    defect_description: string;
    remedial_action: string;
    warning_notice_issued: string;
  };
  completionDate: string;
  engineerSignature: string;
  engineerSignaturePath: string;
  customerSignature: string;
  customerSignaturePath: string;
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

// Quick-select presets for unsafe-appliance capture live in a shared module so the CP12
// wizard and the Gas Warning Notice wizard stay consistent. Tapping a chip appends it to
// the free-text field; the engineer can still type/edit freely.
const CP12_DEFECT_PRESETS = UNSAFE_SITUATION_PRESETS;
const CP12_ACTION_TAKEN_PRESETS = ACTION_TAKEN_PRESETS;
const CP12_ACTION_REQUIRED_PRESETS = ACTION_REQUIRED_PRESETS;

// Where each completion-checklist "Go" link should land focus once its step is
// shown. Appliance items focus their card via applianceRefs instead.
const CP12_CHECKLIST_FOCUS_SELECTORS: Record<string, string> = {
  landlord: '[data-testid="cp12-landlord-name"]',
  'job-address': '#cp12-job-address-name',
  signatures: '#cp12-signatures',
};

const CP12_SAFETY_CLASSIFICATION_OPTIONS: Array<{ label: string; value: Cp12SafetyClassification }> = [
  { label: 'Safe', value: 'safe' },
  { label: 'Not to Current Standards', value: 'ncs' },
  { label: 'At Risk', value: 'ar' },
  { label: 'Immediately Dangerous', value: 'id' },
];

type YesNoValue = 'yes' | 'no' | '';

const CP12_YES_NO_OPTIONS: Array<{ label: string; value: Exclude<YesNoValue, ''> }> = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
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

const normalizeYesNoValue = (value?: string | null): YesNoValue => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'yes' || normalized === 'y' || normalized === 'true') return 'yes';
  if (normalized === 'no' || normalized === 'n' || normalized === 'false') return 'no';
  return '';
};

const yesNoLabel = (value: YesNoValue) => {
  if (value === 'yes') return 'Yes';
  if (value === 'no') return 'No';
  return '';
};

const getApplianceSafeToUse = (appliance: Cp12Appliance): YesNoValue => {
  const classification = getApplianceSafetyClassification(appliance);
  if (classification === 'safe' || classification === 'ncs') return 'yes';
  if (classification === 'ar' || classification === 'id') return 'no';
  return '';
};

const getCp12ClassificationOptions = (safeToUse: YesNoValue) => {
  if (safeToUse === 'yes') {
    return CP12_SAFETY_CLASSIFICATION_OPTIONS.filter((option) => option.value === 'safe' || option.value === 'ncs');
  }
  if (safeToUse === 'no') {
    return CP12_SAFETY_CLASSIFICATION_OPTIONS.filter((option) => option.value === 'ar' || option.value === 'id');
  }
  return CP12_SAFETY_CLASSIFICATION_OPTIONS;
};

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
  clients = [],
  stepOffset = 0,
  startStep = 1,
  prepareOnly = false,
  invoiceReadiness,
}: WizardProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [step, setStep] = useState(() => Math.max(startStep, 1));
  // Step 1 ("People & location") is split into two pages to avoid a long scroll:
  // 0 = landlord / property owner, 1 = tenant + job location.
  const [infoSubStep, setInfoSubStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const resolvedInitialInfo = mergeJobContextFields(initialInfo, initialJobContext);
  const [issuedJobId] = useState<string | null>(null);
  const [boilerServiceDecision, setBoilerServiceDecision] = useState<'yes' | 'no' | null>(null);
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
  const demoEnabled = DEMO_FILL_VISIBLE;
  const deferredAddressSearchQuery = useDeferredValue(addressSearchQuery.trim());
  const deferredLandlordAddressSearchQuery = useDeferredValue(landlordAddressSearchQuery.trim());
  // Filling an address line from a chosen suggestion would otherwise re-trigger the
  // search effect and immediately re-open the dropdown (it "gets stuck"). These record
  // the just-filled value so each effect skips exactly that one search.
  const skipAddressSearchForRef = useRef<string | null>(null);
  const skipLandlordAddressSearchForRef = useRef<string | null>(null);
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
  const initialLandlordEmail = resolvedInitialInfo.landlord_email ?? resolvedInitialInfo.customer_email ?? '';
  const initialLandlordMobile =
    resolvedInitialInfo.landlord_mobile ?? resolvedInitialInfo.customer_mobile ?? resolvedInitialInfo.customer_phone ?? '';
  const initialLandlordAddress =
    resolvedInitialInfo.landlord_address ?? buildLandlordAddress(initialLandlordLine1, initialLandlordLine2, initialLandlordCity);
  const initialJobAddressName =
    resolvedInitialInfo.job_address_name?.trim().toLowerCase() === 'landlord request'
      ? ''
      : resolvedInitialInfo.job_address_name ?? '';

  const [info, setInfo] = useState<Cp12InfoState>({
    customer_name: resolvedInitialInfo.customer_name ?? '',
    customer_phone: resolvedInitialInfo.customer_phone ?? resolvedInitialInfo.job_phone ?? '',
    property_address: resolvedInitialInfo.property_address ?? '',
    postcode: resolvedInitialInfo.postcode ?? '',
    // Default to today when unset OR blank ('' is common from job fields, and `??`
    // would leave it empty, forcing a manual pick).
    inspection_date: resolvedInitialInfo.inspection_date || new Date().toISOString().slice(0, 10),
    landlord_name: resolvedInitialInfo.landlord_name ?? '',
    landlord_company: resolvedInitialInfo.landlord_company ?? '',
    landlord_address_line1: initialLandlordLine1,
    landlord_address_line2: initialLandlordLine2,
    landlord_city: initialLandlordCity,
    landlord_postcode: initialLandlordPostcode,
    landlord_tel: initialLandlordTel,
    landlord_email: initialLandlordEmail,
    landlord_mobile: initialLandlordMobile,
    landlord_address: initialLandlordAddress,
    reg_26_9_confirmed: (() => {
      const value = String(resolvedInitialInfo.reg_26_9_confirmed ?? '').toLowerCase();
      return value === 'true' || value === 'yes';
    })(),
    company_address: resolvedInitialInfo.company_address ?? '',
    company_postcode: resolvedInitialInfo.company_postcode ?? '',
    company_phone: resolvedInitialInfo.company_phone ?? '',
    engineer_phone: resolvedInitialInfo.engineer_phone ?? '',
    tenant_email: resolvedInitialInfo.tenant_email ?? '',
  });

  const [jobAddress, setJobAddress] = useState<Cp12JobAddressState>({
    job_reference: resolvedInitialInfo.job_reference ?? '',
    job_address_name: initialJobAddressName,
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
    appliance_type: resolveCp12Category(appliance.appliance_type),
    appliance_subtype: resolveCp12Subtype(
      resolveCp12Category(appliance.appliance_type),
      appliance.appliance_subtype,
      appliance.appliance_type,
    ),
    cooker_stability: appliance.cooker_stability ?? '',
    landlords_appliance: appliance.landlords_appliance ?? 'Yes',
    appliance_inspected: appliance.appliance_inspected ?? 'Yes',
    location: appliance.location ?? '',
    make_model: appliance.make_model ?? '',
    gc_number: appliance.gc_number ?? '',
    gas_type: appliance.gas_type ?? '',
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
    flue_location: appliance.flue_location ?? appliance.location ?? '',
    ventilation_provision: appliance.ventilation_provision ?? '',
    ventilation_satisfactory: appliance.ventilation_satisfactory ?? '',
    flue_condition: appliance.flue_condition ?? '',
    stability_test: appliance.stability_test ?? '',
    gas_tightness_test: appliance.gas_tightness_test ?? '',
    co_reading_ppm: appliance.co_reading_ppm ?? '',
    safety_devices_correct: appliance.safety_devices_correct ?? '',
    flue_performance_test: appliance.flue_performance_test ?? '',
    flue_integrity_test: appliance.flue_integrity_test ?? '',
    flue_integrity_co2_high: appliance.flue_integrity_co2_high ?? '',
    flue_integrity_co2_low: appliance.flue_integrity_co2_low ?? '',
    spillage_test: appliance.spillage_test ?? '',
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
    reg_26_9_confirmed: appliance.reg_26_9_confirmed ?? false,
  });

  // Cross-cert autofill: if the boiler service was done first on this job, seed the
  // first CP12 appliance from the captured boiler details (property/landlord already
  // share job-level fields). Only applies when no CP12 appliance exists yet.
  const seedApplianceFromJobContext = (): Cp12Appliance => {
    const info = resolvedInitialInfo as Record<string, unknown>;
    const t = (key: string) => String(info[key] ?? '').trim();
    const make = t('boiler_make');
    const model = t('boiler_model');
    const boilerType = t('boiler_type');
    const location = t('boiler_location');
    if (!make && !model && !boilerType && !location) return { ...emptyAppliance };
    return sanitizeAppliance({
      ...emptyAppliance,
      appliance_type: boilerType || 'boiler',
      make_model: [make, model].filter(Boolean).join(' '),
      location,
      flue_type: t('flue_type'),
      operating_pressure: t('operating_pressure_mbar'),
      heat_input: t('heat_input'),
      high_co_ppm: t('high_combustion_co_ppm'),
      high_co2: t('high_combustion_co2'),
      high_ratio: t('high_combustion_ratio'),
      low_co_ppm: t('low_combustion_co_ppm'),
      low_co2: t('low_combustion_co2'),
      low_ratio: t('low_combustion_ratio'),
    });
  };

  const [appliances, setAppliances] = useState<Cp12Appliance[]>(
    initialAppliances.length
      ? initialAppliances.slice(0, MAX_APPLIANCES).map(sanitizeAppliance)
      : [seedApplianceFromJobContext()],
  );
  const [defects, setDefects] = useState({
    defect_description: resolvedInitialInfo.defect_description ?? '',
    remedial_action: resolvedInitialInfo.remedial_action ?? '',
    warning_notice_issued: resolvedInitialInfo.warning_notice_issued ?? 'NO',
  });
  // The record-level defect/remedial box auto-fills from per-appliance failed
  // checks + notes until the engineer edits it by hand (then we stop syncing).
  const [defectsEdited, setDefectsEdited] = useState(
    hasValue(resolvedInitialInfo.defect_description) || hasValue(resolvedInitialInfo.remedial_action),
  );
  const [completionDate, setCompletionDate] = useState(resolvedInitialInfo.completion_date ?? new Date().toISOString().slice(0, 10));
  const [engineerSignature, setEngineerSignature] = useState(resolvedInitialInfo.engineer_signature ?? '');
  const [engineerSignaturePath, setEngineerSignaturePath] = useState(resolvedInitialInfo.engineer_signature_path ?? '');
  const [customerSignature, setCustomerSignature] = useState(resolvedInitialInfo.customer_signature ?? '');
  const [customerSignaturePath, setCustomerSignaturePath] = useState(resolvedInitialInfo.customer_signature_path ?? '');
  // Customer signature is optional (only the engineer must sign), so it's hidden behind
  // an opt-in control rather than shown as an always-present pad that reads as required.
  const [showCustomerSignature, setShowCustomerSignature] = useState(
    Boolean((resolvedInitialInfo.customer_signature ?? '') || (resolvedInitialInfo.customer_signature_path ?? '')),
  );
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [limitReachedMessage, setLimitReachedMessage] = useState<string | null>(null);
  const [checksTab, setChecksTab] = useState<'inspection' | 'readings' | 'safety' | 'house'>('inspection');

  /**
   * Single-page mode: every step stacked on one scroll instead of four screens
   * with a sub-tabbed third.
   *
   * A layout preference, not a different form — the same state, the same
   * autosave, the same offline fallback. Only the chrome changes, which is why
   * it can be a toggle rather than a second implementation to keep in step.
   *
   * Held per device rather than on the profile: it is a preference about this
   * screen on this phone, and storing it locally means no migration and no
   * round-trip before the first paint.
   */
  /**
   * One page is the only layout now.
   *
   * The stepped flow and this one were kept side by side while it was an open
   * question which to keep; it is answered. Held as a constant rather than
   * deleted inline so the stepped branches below narrow to dead code the
   * compiler can see, and come out in one reviewable pass rather than by
   * hand-editing four thousand lines of nested JSX.
   */
  const singlePage = true;

  /** What the engineer sees and types, and therefore what comes back. */
  const savedLandlordLabel = (client: ClientListItem) =>
    [client.landlord_name || client.name, client.organization].filter(Boolean).join(' · ');

  /**
   * Fill the landlord from a saved customer.
   *
   * Deliberately additive: it writes into the same fields the engineer can
   * type into, so a wrong pick is corrected by editing rather than by starting
   * again. Nothing is linked or locked — the certificate still owns its own
   * copy of the details, which is what lets a landlord's address change later
   * without rewriting certificates already issued.
   */
  const applySavedLandlord = (chosenLabel: string) => {
    // SearchableSelect is a native <datalist>: picking an option puts the
    // option's `value` into the input and hands that raw string back here, and
    // the browser filters on `value` too. Keyed on the id, the customer list
    // was being searched by UUID substring — typing a landlord's name matched
    // nothing. Every other use of this component sets value === label for the
    // same reason.
    const client = clients.find((candidate) => savedLandlordLabel(candidate) === chosenLabel);
    if (!client) return;
    const [line1 = '', ...rest] = splitAddressParts(
      String(client.landlord_address ?? client.address ?? ''),
    );
    setInfo((prev) => ({
      ...prev,
      landlord_name: client.landlord_name || client.name || prev.landlord_name,
      landlord_company: client.organization ?? prev.landlord_company,
      landlord_address_line1: line1 || prev.landlord_address_line1,
      landlord_city: rest.at(-1) ?? prev.landlord_city,
      landlord_postcode: client.postcode ?? prev.landlord_postcode,
      landlord_tel: client.phone ?? prev.landlord_tel,
      landlord_email: client.email ?? prev.landlord_email,
    }));
    setLandlordAddressSearchQuery(line1 || '');
  };

  /**
   * Whether this certificate arrived already knowing its landlord.
   *
   * Read from the job as it loaded, not from the live fields: deciding on the
   * current value would make the picker vanish mid-typing, the moment a name
   * became non-empty. A job created by booking, or filled from a landlord's
   * request link, already carries the landlord — offering to fill it from a
   * saved customer there is clutter at best and an invitation to overwrite what
   * the landlord themselves supplied at worst.
   */
  const arrivedWithLandlord = Boolean(String(resolvedInitialInfo.landlord_name ?? '').trim());

  const savedLandlordPicker = clients.length && !arrivedWithLandlord ? (
    <div className="mb-5 rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
      <SearchableSelect
        label="Start from a saved landlord (optional)"
        value=""
        options={clients.map((client) => ({
          label: savedLandlordLabel(client),
          value: savedLandlordLabel(client),
        }))}
        placeholder="Search your customers"
        onChange={applySavedLandlord}
      />
      <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-text-tertiary)]">
        Fills the landlord details below. You can edit anything it fills in.
      </p>
    </div>
  ) : null;

  // Appliance-hub navigation: null = show the appliance list (hub); a number = the one
  // appliance currently being filled in (its identity on step 2, its checks on step 3).
  // Signatures (step 4) and property checks (step 3, hub mode) are unaffected.
  const [activeApplianceIndex, setActiveApplianceIndex] = useState<number | null>(null);
  // For categories where combustion analysis is opt-in (gas fires / water heaters),
  // track which appliance indices the engineer has chosen to add it for.
  const [combustionOptIn, setCombustionOptIn] = useState<Record<number, boolean>>({});
  const prefillAppliedRef = useRef(false);
  const autoNextInspectionRef = useRef<string | null>(null);
  const applianceRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const prevApplianceCountRef = useRef(appliances.length);

  const isCp12 = useMemo(() => certificateType === 'cp12', [certificateType]);
  const isBusy = isPending || isGeneratingPdf;
  const [isOfflineDraftSyncing, setIsOfflineDraftSyncing] = useState(false);
  const [offlineDraftSyncError, setOfflineDraftSyncError] = useState<string | null>(null);
  const [offlineDraftSyncErrorCount, setOfflineDraftSyncErrorCount] = useState(0);
  const [queuedIssue, setQueuedIssue] = useState(false);
  const wasOfflineRef = useRef(false);
  const totalSteps = (isCp12 ? 4 : 4) + stepOffset;
  const baseOffset = stepOffset;
  const firstStep = 1;
  const offsetStep = (step: number) => step + baseOffset;
  const draftStorageKey = useMemo(() => buildWizardDraftStorageKey(certificateType, jobId), [certificateType, jobId]);
  useWizardStepHistory({
    enabled: isCp12,
    key: `${certificateType}:${jobId}`,
    maxStep: 4,
    minStep: firstStep,
    setStep,
    step,
  });

  // Auto-fill the next inspection date to 12 months after completion. It stays editable:
  // we only (re)set it while the field is empty or still holds the value we last derived,
  // so a manual edit by the engineer is never overwritten.
  useEffect(() => {
    if (!isCp12) return;
    const computed = addOneYearDateOnly(completionDate);
    if (!computed) return;
    setEvidenceFields((prev) => {
      const current = (prev.next_inspection_due ?? '').trim();
      if (current === '' || current === autoNextInspectionRef.current) {
        autoNextInspectionRef.current = computed;
        if (current === computed) return prev;
        return { ...prev, next_inspection_due: computed };
      }
      return prev;
    });
  }, [isCp12, completionDate]);

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
      defects,
      completionDate,
      engineerSignature,
      engineerSignaturePath,
      customerSignature,
      customerSignaturePath,
      addressSearchQuery,
      landlordAddressSearchQuery,
    }),
    [
      addressSearchQuery,
      appliances,
      completionDate,
      customerSignature,
      customerSignaturePath,
      defects,
      engineerSignature,
      engineerSignaturePath,
      evidenceFields,
      info,
      jobAddress,
      landlordAddressSearchQuery,
      step,
    ],
  );
  // Signatures are intentionally excluded from the sync-dirty snapshot. They are
  // uploaded to storage the moment they are drawn (SignatureCard.onUpload) and written
  // to the job at issue time (generateCertificatePdf) — the background sync actions
  // (saveCp12JobInfo/saveJobFields/saveCp12Appliances) never send them. Including them
  // here made drawing the required Step-4 signature flip hasUnsyncedChanges back to true
  // with nothing to re-sync it. Issue now owns any final save/sync work.
  const cp12DraftSyncState = useMemo(
    () => ({
      info,
      jobAddress,
      evidenceFields,
      appliances,
      defects,
      completionDate,
    }),
    [
      appliances,
      completionDate,
      defects,
      evidenceFields,
      info,
      jobAddress,
    ],
  );

  const {
    clearDraft,
    hasUnsyncedChanges,
    isOnline,
    isReady: isDraftReady,
    localUpdatedAt,
    markSynced,
  } = useWizardDraft<Cp12DraftState>({
    storageKey: draftStorageKey,
    state: cp12Draft,
    syncState: cp12DraftSyncState,
    onRestore: (draft) => {
      setStep(Math.min(4, Math.max(1, draft.step || startStep)));
      setInfo((prev) => ({ ...prev, ...(draft.info ?? {}) }));
      setJobAddress((prev) => ({ ...prev, ...(draft.jobAddress ?? {}) }));
      setEvidenceFields((prev) => ({ ...prev, ...(draft.evidenceFields ?? {}) }));
      if (Array.isArray(draft.appliances) && draft.appliances.length) {
        setAppliances(draft.appliances.slice(0, MAX_APPLIANCES).map(sanitizeAppliance));
      }
      setDefects((prev) => ({ ...prev, ...(draft.defects ?? {}) }));
      setCompletionDate(draft.completionDate || completionDate);
      setEngineerSignature(draft.engineerSignature ?? '');
      setEngineerSignaturePath(draft.engineerSignaturePath ?? '');
      setCustomerSignature(draft.customerSignature ?? '');
      setCustomerSignaturePath(draft.customerSignaturePath ?? '');
      setAddressSearchQuery(draft.addressSearchQuery ?? '');
      setLandlordAddressSearchQuery(draft.landlordAddressSearchQuery ?? '');
    },
  });

  const buildCp12DraftPersistencePayload = useCallback((infoOverride: Cp12InfoState = info) => {
    const nextJobAddress = { ...jobAddress };
    const derivedAddress = deriveJobAddressFromFields(nextJobAddress, infoOverride);
    if (!nextJobAddress.job_address_line1.trim()) nextJobAddress.job_address_line1 = derivedAddress.line1;
    if (!nextJobAddress.job_address_line2.trim() && derivedAddress.line2) nextJobAddress.job_address_line2 = derivedAddress.line2;
    if (!nextJobAddress.job_address_city.trim() && derivedAddress.city) nextJobAddress.job_address_city = derivedAddress.city;
    if (!nextJobAddress.job_postcode.trim()) nextJobAddress.job_postcode = infoOverride.postcode.trim();
    if (!nextJobAddress.job_tel.trim()) nextJobAddress.job_tel = infoOverride.customer_phone.trim();

    // Reg 26(9) is confirmed per appliance in the wizard; the record-level flag is
    // now derived (true only when every appliance is confirmed) so the persisted
    // field and the server's appliance-level fallback stay coherent without a
    // separate manual checkbox.
    const reg26Confirmed = appliances.length > 0 && appliances.every((a) => Boolean(a.reg_26_9_confirmed));

    const data = {
      ...infoOverride,
      reg_26_9_confirmed: reg26Confirmed,
      inspection_date: infoOverride.inspection_date || completionDate,
      property_address: buildPropertyAddressFromJobAddress(nextJobAddress),
      postcode: nextJobAddress.job_postcode || infoOverride.postcode,
      landlord_address: buildLandlordAddress(infoOverride.landlord_address_line1, infoOverride.landlord_address_line2, infoOverride.landlord_city),
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

    return {
      data,
      jobAddress: nextJobAddress,
      jobFields: {
        // Namespaced GIUSP answers for any unsafe appliance. Written alongside
        // the rest so a part-filled notice survives a reload like everything else.
        ...Object.fromEntries(
          Object.entries(evidenceFields).filter(([key]) => key.startsWith('giusp__')),
        ),
        job_reference: nextJobAddress.job_reference,
        job_address_name: nextJobAddress.job_address_name,
        job_address_line1: nextJobAddress.job_address_line1,
        job_address_line2: nextJobAddress.job_address_line2,
        job_address_city: nextJobAddress.job_address_city,
        job_postcode: nextJobAddress.job_postcode,
        job_tel: nextJobAddress.job_tel,
        tenant_name: nextJobAddress.job_address_name,
        tenant_email: infoOverride.tenant_email,
        emergency_control_accessible: evidenceFields.emergency_control_accessible ?? '',
        gas_tightness_satisfactory: evidenceFields.gas_tightness_satisfactory ?? '',
        pipework_visual_satisfactory: evidenceFields.pipework_visual_satisfactory ?? '',
        equipotential_bonding_satisfactory: evidenceFields.equipotential_bonding_satisfactory ?? '',
        next_inspection_due: evidenceFields.next_inspection_due ?? '',
        completion_date: completionDate,
      },
      jobPayload,
    };
  }, [appliances, completionDate, evidenceFields, info, jobAddress, resolvedInitialInfo]);

  /**
   * GIUSP answers for one appliance's warning notice.
   *
   * Held in evidenceFields under the shared per-appliance namespace, so they
   * ride the existing saveJobFields path and land on the parent CP12 job. The
   * notice reads them across when it is seeded — see
   * applyCp12SourceDefaultsForGasWarningNotice.
   */
  const applianceGiuspKey = (index: number) => `appliance_${index + 1}`;

  const giuspAnswersFor = useCallback(
    (index: number) => readGiuspAnswers(evidenceFields, applianceGiuspKey(index)),
    [evidenceFields],
  );

  const setGiuspAnswer = useCallback((index: number, key: GiuspAnswerKey, value: string) => {
    setEvidenceFields((prev) => ({
      ...prev,
      [giuspFieldKey(`appliance_${index + 1}`, key)]: value,
    }));
  }, []);

  const syncCp12OfflineDraft = useCallback(async () => {
    if (!isCp12 || isOfflineDraftSyncing) return;
    setIsOfflineDraftSyncing(true);
    setOfflineDraftSyncError(null);

    try {
      const payload = buildCp12DraftPersistencePayload();
      await saveCp12JobInfo({ jobId, data: payload.jobPayload });
      await saveJobFields({ jobId, fields: payload.jobFields });
      await saveCp12Appliances({ jobId, appliances, defects });
      setJobAddress(payload.jobAddress);
      setInfo(payload.data);
      markSynced(
        { ...cp12Draft, jobAddress: payload.jobAddress, info: payload.data },
        { ...cp12DraftSyncState, jobAddress: payload.jobAddress, info: payload.data },
      );
      setOfflineDraftSyncErrorCount(0);
      pushToast({ title: 'Offline draft synced', variant: 'success' });
    } catch (error) {
      setOfflineDraftSyncError(toUserMessage(error, 'Could not sync offline draft.'));
      setOfflineDraftSyncErrorCount((count) => count + 1);
    } finally {
      setIsOfflineDraftSyncing(false);
    }
  }, [
    appliances,
    buildCp12DraftPersistencePayload,
    cp12Draft,
    cp12DraftSyncState,
    defects,
    isCp12,
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
    void syncCp12OfflineDraft();
  }, [hasUnsyncedChanges, isDraftReady, isOfflineDraftSyncing, isOnline, syncCp12OfflineDraft]);

  useEffect(() => {
    if (!isCp12) return;

    if (skipAddressSearchForRef.current !== null && skipAddressSearchForRef.current === deferredAddressSearchQuery) {
      skipAddressSearchForRef.current = null;
      setPostcodeSuggestions([]);
      setIsPostcodeLookupPending(false);
      return;
    }

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
        setAddressSearchError(getAddressLookupErrorMessage(error, 'Try another search.'));
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

    if (skipLandlordAddressSearchForRef.current !== null && skipLandlordAddressSearchForRef.current === deferredLandlordAddressSearchQuery) {
      skipLandlordAddressSearchForRef.current = null;
      setLandlordAddressSuggestions([]);
      setIsLandlordLookupPending(false);
      return;
    }

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
        setLandlordAddressSearchError(getAddressLookupErrorMessage(error, 'Try another search.'));
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
          landlord_email: info.landlord_email || CP12_DEMO_INFO.landlord_email || '',
          landlord_mobile: info.landlord_mobile || CP12_DEMO_INFO.landlord_mobile || CP12_DEMO_INFO.customer_phone || '',
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
          description: toUserMessage(error, 'Try again.'),
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
            description: toUserMessage(error, 'Try again.'),
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
      skipAddressSearchForRef.current = (address.line1 || suggestion.label).trim();
      setAddressSearchQuery(address.line1 || suggestion.label);
      setPostcodeSuggestions([]);
      pushToast({ title: 'Address selected', variant: 'success' });
    } catch (error) {
      setSelectedPostcodeMatchId(null);
      setAddressSearchError(toUserMessage(error, 'Try again.'));
      pushToast({
        title: 'Address not found',
        description: toUserMessage(error, 'Try again.'),
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
      skipLandlordAddressSearchForRef.current = (address.line1 || suggestion.label).trim();
      setLandlordAddressSearchQuery(address.line1 || suggestion.label);
      setLandlordAddressSuggestions([]);
      pushToast({ title: 'Landlord address selected', variant: 'success' });
    } catch (error) {
      setSelectedLandlordMatchId(null);
      setLandlordAddressSearchError(toUserMessage(error, 'Try again.'));
      pushToast({
        title: 'Address not found',
        description: toUserMessage(error, 'Try again.'),
        variant: 'error',
      });
    } finally {
      setIsLandlordLookupPending(false);
    }
  };

  // Page 1 of step one (landlord). Validate the landlord block, then reveal the
  // tenant + location page without leaving step one.
  const handleInfoPageOneNext = () => {
    if (!isCp12) {
      setStep(2);
      return;
    }
    if (!info.landlord_name.trim()) {
      pushToast({ title: 'Landlord / owner name is required', variant: 'error' });
      return;
    }
    if (!info.landlord_address_line1.trim()) {
      pushToast({ title: 'Landlord address line 1 is required', variant: 'error' });
      return;
    }
    if (!info.landlord_city.trim()) {
      pushToast({ title: 'Landlord city / town is required', variant: 'error' });
      return;
    }
    if (!info.landlord_postcode.trim()) {
      pushToast({ title: 'Landlord postcode is required', variant: 'error' });
      return;
    }
    setInfoSubStep(1);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  };

  const handleInfoNext = () => {
    if (!isCp12) {
      setStep(2);
      return;
    }
    startTransition(async () => {
      try {
        const payload = buildCp12DraftPersistencePayload();
        // Flat/unit reference is optional — the property address (line 1 / town /
        // postcode) identifies the premises. Not a legally required field and no
        // longer captures the occupant's personal name.
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

        if (!isOnline) {
          setJobAddress(payload.jobAddress);
          setInfo(payload.data);
          setStep(2);
          pushToast({
            title: 'Saved on this device',
            description: 'You are offline. This job will sync when your connection returns.',
            variant: 'default',
          });
          return;
        }

        await saveCp12JobInfo({ jobId, data: payload.jobPayload });
        await saveJobFields({ jobId, fields: payload.jobFields });
        setJobAddress(payload.jobAddress);
        setInfo(payload.data);
        if (prepareOnly) {
          clearDraft();
          router.push('/dashboard');
          return;
        }
        setStep(2);
        markSynced(
          { ...cp12Draft, step: 2, jobAddress: payload.jobAddress, info: payload.data },
          { ...cp12DraftSyncState, jobAddress: payload.jobAddress, info: payload.data },
        );
      } catch (error) {
        pushToast({
          title: 'Could not save job info',
          description: toUserMessage(error, 'Try again.'),
          variant: 'error',
        });
      }
    });
  };

  const handleChecksNext = () => {
    startTransition(async () => {
      try {
        if (!isOnline) {
          setStep(4);
          pushToast({
            title: 'Saved on this device',
            description: 'You are offline. CP12 checks will sync when your connection returns.',
            variant: 'default',
          });
          return;
        }
        await saveCp12Appliances({ jobId, appliances, defects });
        setStep(4);
        markSynced(
          { ...cp12Draft, step: 4, appliances, defects },
          { ...cp12DraftSyncState, appliances, defects },
        );
      } catch (error) {
        pushToast({
          title: 'Could not save CP12 checks',
          description: toUserMessage(error, 'Try again.'),
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
    // Customer / received-by signature is optional (HSE: only the engineer must
    // sign). Callers may still opt in, but the default gate no longer requires it.
    const requireCustomerSignature = options.requireCustomerSignature ?? false;
    const normalizedInfo = {
      ...info,
      inspection_date: info.inspection_date || completionDate,
      landlord_address: buildLandlordAddress(info.landlord_address_line1, info.landlord_address_line2, info.landlord_city),
    };
    return validateCp12TierOne({
      fields: {
        ...normalizedInfo,
        engineer_name: resolvedInitialInfo.engineer_name || CP12_DEMO_INFO.engineer_name || '',
        gas_safe_number: resolvedInitialInfo.gas_safe_number || CP12_DEMO_INFO.gas_safe_number || '',
        engineer_signature: engineerSignature,
        engineer_signature_path: engineerSignaturePath,
        customer_signature: customerSignature,
        customer_signature_path: customerSignaturePath,
        defect_description: defects.defect_description,
        remedial_action: defects.remedial_action,
      },
      appliances,
      requireCustomerSignature,
    });
  };

  const handleGenerate = () => {
    if (isGeneratingPdf) return;
    if (!isOnline) {
      setQueuedIssue(true);
      pushToast({
        title: 'Issue queued',
        description: 'This certificate is saved on this device and will continue when you are back online.',
        variant: 'default',
      });
      return;
    }
    setIsGeneratingPdf(true);
    void (async () => {
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
            customer_signature_path: customerSignaturePath,
            completion_date: completionDate,
            next_inspection_due: evidenceFields.next_inspection_due ?? '',
          },
        });
        if ('error' in result && result.error === 'limit_reached') {
          setLimitReachedMessage(result.message ?? 'You have reached your monthly certificate limit.');
          return;
        }
        if (!('jobId' in result)) return;
        const { jobId: resultJobId } = result;
        clearDraft();
        pushToast({
          title: `${certificateLabel} generated successfully`,
          description: (
            <Link href={`/jobs/${resultJobId}/pdf?certificateType=${certificateType}`} className="text-[var(--action)] underline">
              Open document preview
            </Link>
          ),
          variant: 'success',
        });
        if (certificateType === 'cp12') {
          router.push(`/jobs/${resultJobId}/complete`);
          return;
        }
        router.push(`/jobs/${resultJobId}/complete`);
      } catch (error) {
        pushToast({
          title: 'Could not generate PDF',
          description: toUserMessage(error, 'Try again.'),
          variant: 'error',
        });
      } finally {
        setIsGeneratingPdf(false);
      }
    })();
  };

  const handleGenerateRef = useRef(handleGenerate);
  useEffect(() => {
    handleGenerateRef.current = handleGenerate;
  });

  const handleLinkedBoilerService = () => {
    if (!issuedJobId) return;
    startTransition(async () => {
      try {
        await saveJobFields({
          jobId: issuedJobId,
          fields: {
            gas_service_linked_to_cp12: 'true',
            gas_service_linked_to_cp12_at: new Date().toISOString(),
          },
        });
        router.push(`/wizard/create/boiler_service?jobId=${issuedJobId}`);
      } catch (error) {
        pushToast({
          title: 'Could not prepare boiler service',
          description: toUserMessage(error, 'Try again.'),
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
      if (classification === 'safe' || classification === 'ncs') {
        current.warning_notice_issued = false;
        current.appliance_disconnected = false;
        current.danger_do_not_use_attached = false;
      }
      next[index] = current;
      return next;
    });
  };

  const setApplianceSafeToUse = (index: number, value: YesNoValue) => {
    setAppliances((prev) => {
      const next = [...prev];
      const current = { ...next[index] };
      const currentClassification = getApplianceSafetyClassification(current);

      if (!value) {
        current.safety_classification = '';
        current.safety_rating = '';
        current.classification_code = '';
      } else {
        const targetClassification =
          value === 'yes'
            ? currentClassification === 'ncs'
              ? 'ncs'
              : 'safe'
            : currentClassification === 'id'
              ? 'id'
              : 'ar';
        const legacy = legacySafetyFromClassification(targetClassification);
        current.safety_classification = targetClassification;
        current.safety_rating = legacy.safety_rating;
        current.classification_code = legacy.classification_code;
        if (value === 'yes') {
          current.warning_notice_issued = false;
          current.appliance_disconnected = false;
          current.danger_do_not_use_attached = false;
        }
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

    pushToast({
      title: 'Voice readings ready',
      description: 'Review the values in the form before saving.',
      variant: 'success',
    });
  };

  // Appliance-hub navigation helpers.
  const openAppliance = (index: number) => {
    setActiveApplianceIndex(index);
    setChecksTab('inspection');
    setStep(2);
  };
  const closeToHub = () => {
    setActiveApplianceIndex(null);
    setStep(2);
  };
  // Back from the checks step: within an appliance, step back through the
  // sub-tabs (safety → readings → inspection) before returning to identity,
  // so "Back" mirrors the forward Next path instead of always jumping out.
  const handleChecksBack = () => {
    if (activeApplianceIndex === null) { goBackOneStep(); return; }
    if (checksTab === 'safety') setChecksTab('readings');
    else if (checksTab === 'readings') setChecksTab('inspection');
    else setStep(2);
  };
  const removeActiveAppliance = () => {
    if (activeApplianceIndex == null) return;
    const idx = activeApplianceIndex;
    setAppliances((prev) => prev.filter((_, i) => i !== idx));
    setCombustionOptIn((prev) => {
      const next: Record<number, boolean> = {};
      Object.entries(prev).forEach(([key, val]) => {
        const i = Number(key);
        if (i < idx) next[i] = val;
        else if (i > idx) next[i - 1] = val;
      });
      return next;
    });
    setActiveApplianceIndex(null);
    setStep(2);
  };
  const addAndOpenAppliance = () => {
    if (appliances.length >= MAX_APPLIANCES) {
      pushToast({
        title: 'Max 5 appliances',
        description: 'The CP12 PDF table fits five appliances. Create another certificate for more.',
        variant: 'default',
      });
      return;
    }
    const newIndex = appliances.length;
    setAppliances((prev) => [...prev, { ...emptyAppliance }]);
    openAppliance(newIndex);
  };

  const handleEvidenceFieldsUpdate = (updates: Record<string, string>) => {
    setEvidenceFields((prev) => ({ ...prev, ...updates }));
    startTransition(async () => {
      try {
        await saveJobFields({ jobId, fields: updates });
      } catch (error) {
        pushToast({
          title: 'Could not save field',
          description: toUserMessage(error, 'Try again.'),
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
          description: toUserMessage(error, 'Try again.'),
          variant: 'error',
        });
      }
    });
  };

  const applianceProfiles = useMemo<ApplianceStepValues[]>(
    () =>
      (appliances.length ? appliances : [emptyAppliance]).map((appliance) => {
        const { make, model } = splitMakeModel(appliance.make_model ?? '', resolveCp12Category(appliance.appliance_type));
        return {
          type: resolveCp12Category(appliance.appliance_type),
          subtype: resolveCp12Subtype(
            resolveCp12Category(appliance.appliance_type),
            appliance.appliance_subtype,
            appliance.appliance_type,
          ),
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
        const category = resolveCp12Category(profile.type);
        return {
          ...current,
          appliance_type: category,
          // Subtype only applies to boilers; cooker stability only to hobs/cookers.
          appliance_subtype: category === 'boiler' ? (profile.subtype ?? current.appliance_subtype ?? '') : '',
          cooker_stability: category === 'hob_cooker' ? (current.cooker_stability ?? '') : '',
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

  const renderReadingsVoiceButton = (
    index: number,
    scope: 'pressure' | 'high' | 'low' | 'combustion',
    buttonLabel: string,
  ) => (
    <Cp12VoiceReadings
      jobId={jobId}
      scope={scope}
      buttonLabel={buttonLabel}
      buttonClassName="h-7 rounded-[6px] px-2.5 py-1 text-[11px]"
      onApply={(values) => applyVoiceReadings(index, values)}
    />
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

    // Tier 1 (legally required) items are `blocking` and form the spine of the
    // flow. Tier 2 (conventional) items are non-blocking: the engineer can skip
    // them and they are simply omitted from the certificate. See
    // src/lib/cp12/field-config.ts for the authoritative classification.

    // Tier 1 — engineer identity (Reg 36(3)(h)/(i)).
    items.push({
      id: 'installer',
      label: 'Engineer name & Gas Safe registration',
      ok: hasValue(engineerName) && hasValue(gasSafeNumber),
      hint: 'Set in Settings',
      action: () => router.push('/settings'),
      blocking: true,
    });

    // Tier 2 — business/company details. Optional: omitted from the PDF if blank.
    items.push({
      id: 'business-details',
      label: 'Business details (optional)',
      ok:
        hasValue(companyName) &&
        hasValue(companyAddress) &&
        hasValue(companyPostcode) &&
        hasValue(companyPhone) &&
        hasValue(engineerIdCard),
      hint: 'Optional — set in Settings; omitted from the certificate if left blank',
      action: () => router.push('/settings'),
      blocking: false,
    });

    // Tier 1 — premises address (Reg 36(3)(b)). Property reference + site tel are
    // conventional and tracked as a non-blocking reminder below.
    const addrOk = hasValue(jobAddress.job_address_line1) && hasValue(jobAddress.job_postcode);
    items.push({
      id: 'job-address',
      label: 'Property address & postcode',
      ok: addrOk,
      hint: singlePage ? 'Add it under Landlord & property above' : 'Add in People & location',
      action: () => {
        setStep(1);
        setInfoSubStep(1);
      },
      blocking: true,
    });

    // Tier 1 — landlord / agent name and address (Reg 36(3)(c)).
    const landlordOk =
      hasValue(info.landlord_name) &&
      hasValue(info.landlord_address_line1) &&
      hasValue(info.landlord_city) &&
      hasValue(info.landlord_postcode);
    items.push({
      id: 'landlord',
      label: 'Landlord / owner details complete',
      ok: landlordOk,
      hint: singlePage ? 'Fill it in under Landlord & property above' : 'Fill in People & location',
      action: () => {
        setStep(1);
        setInfoSubStep(0);
      },
      blocking: true,
    });

    // Per appliance: identity + location + Reg 26(9) are Tier 1 (blocking);
    // readings/checks are Tier 2 (non-blocking, recorded-if-done).
    const applianceChecks: ChecklistItem[] = appliances.flatMap((app, index) => {
      const identityOk = hasValue(app.location) && hasValue(app.appliance_type) && hasValue(app.make_model);
      const reg26Ok = Boolean(app.reg_26_9_confirmed);
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
      const tierOneOk = identityOk && reg26Ok;
      return [
        {
          id: `appliance-${index}`,
          label: `Appliance #${index + 1}: description, location & Reg 26(9)`,
          ok: tierOneOk,
          hint: tierOneOk ? undefined : !identityOk ? 'Open the appliance to edit identity' : 'Confirm Reg 26(9) in the appliance checks',
          action: () => {
            openAppliance(index);
            if (identityOk) setStep(3);
          },
          blocking: true,
        },
        {
          id: `appliance-${index}-readings`,
          label: `Appliance #${index + 1}: readings & checks (optional)`,
          ok: readingsOk,
          hint: 'Optional — only the checks you record appear on the certificate',
          action: () => {
            openAppliance(index);
            setStep(3);
          },
          blocking: false,
        },
      ];
    });
    items.push(...applianceChecks);

    // Tier 1 — defect + remedial action are mandated when any appliance is unsafe.
    const anyUnsafe = appliances.some((app) =>
      ['ar', 'id', 'at risk', 'immediately dangerous'].includes(
        String(app.safety_rating ?? app.safety_classification ?? '').trim().toLowerCase(),
      ),
    );
    if (anyUnsafe) {
      items.push({
        id: 'defects',
        label: 'Defect & remedial action recorded',
        ok:
          (hasValue(defects.defect_description) || appliances.some((a) => hasValue(a.defect_notes))) &&
          (hasValue(defects.remedial_action) ||
            appliances.some((a) => hasValue(a.actions_taken) || hasValue(a.actions_required))),
        hint: 'Required when an appliance is At Risk / Immediately Dangerous',
        action: () => setStep(4),
        blocking: true,
      });
    }

    // Regulation 26(9) is confirmed per appliance in the appliance checks above,
    // so there is no separate record-level confirmation item here.

    // Tier 1 — only the engineer signature is mandatory (HSE).
    items.push({
      id: 'signatures',
      label: 'Engineer signature',
      ok: hasValue(engineerSignature),
      action: () => setStep(4),
      blocking: true,
    });

    items.push({
      id: 'completion',
      label: 'Issue date set',
      ok: hasValue(completionDate),
      blocking: true,
    });

    // Tier 2 / 3 — non-blocking reminders.
    items.push({
      id: 'customer-signature',
      label: 'Customer / received-by signature (optional)',
      ok: hasValue(customerSignature),
      hint: 'Optional — for acknowledgement; not legally required',
      action: () => setStep(4),
      blocking: false,
    });
    items.push({
      id: 'co-alarms',
      label: 'CO alarms fitted & tested (optional)',
      ok: hasValue(evidenceFields.co_alarm_fitted) && hasValue(evidenceFields.co_alarm_tested),
      hint: 'Optional — omitted from the certificate if not recorded',
      blocking: false,
    });
    items.push({
      id: 'next-inspection',
      label: 'Next inspection due date',
      ok: hasValue(evidenceFields.next_inspection_due) || hasValue(evidenceFields.next_inspection_date) || hasValue(completionDate),
      hint: 'Defaults to 12 months from the inspection date',
      blocking: false,
    });

    const blockingMissing = items.filter((item) => item.blocking !== false && !item.ok).length;
    return { items, blockingMissing };
  }, [
    appliances,
    // The hints name the section to go and fix things in, and that name differs
    // between the two layouts. Without this the checklist kept pointing at
    // whichever layout was active when it was first built.
    singlePage,
    completionDate,
    defects.defect_description,
    defects.remedial_action,
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
    router,
  ]);
  const firstBlockingMissing = checklist.items.find((item) => item.blocking !== false && !item.ok);

  // Auto-fill the record-level defect/remedial box from per-appliance failed
  // checks + notes, until the engineer edits it by hand.
  useEffect(() => {
    if (!isCp12 || defectsEdited) return;
    const suggested = composeCp12DefectSummary(appliances);
    setDefects((prev) =>
      prev.defect_description === suggested.defect_description && prev.remedial_action === suggested.remedial_action
        ? prev
        : { ...prev, defect_description: suggested.defect_description, remedial_action: suggested.remedial_action },
    );
  }, [appliances, defectsEdited, isCp12]);

  useEffect(() => {
    if (!queuedIssue || !isOnline || isBusy || checklist.blockingMissing > 0) return;
    setQueuedIssue(false);
    handleGenerateRef.current();
  }, [checklist.blockingMissing, isBusy, isOnline, queuedIssue]);

  // Order the missing items top-to-bottom in form/page order so the "Go" links
  // always walk the engineer downward through the wizard.
  const checklistPageOrder = (id: string) => {
    if (id === 'installer') return 0;
    if (id === 'landlord') return 10;
    if (id === 'job-address') return 11;
    if (id.startsWith('appliance-')) return 20 + (Number(id.slice('appliance-'.length)) || 0);
    if (id === 'signatures') return 41;
    if (id === 'completion') return 42;
    return 99;
  };
  const cp12RequiredMissingItems = checklist.items
    .filter((item) => item.blocking !== false && !item.ok)
    .sort((a, b) => checklistPageOrder(a.id) - checklistPageOrder(b.id));
  // After "Go" switches step (item.action), scroll the target field into view and
  // focus it so the engineer can type straight away — not just reveal the section.
  const focusChecklistTarget = (id: string) => {
    window.setTimeout(() => {
      let el: HTMLElement | null = null;
      if (id.startsWith('appliance-')) {
        el = applianceRefs.current[Number(id.slice('appliance-'.length)) || 0] ?? null;
      } else {
        const selector = CP12_CHECKLIST_FOCUS_SELECTORS[id];
        if (selector) el = document.querySelector<HTMLElement>(selector);
      }
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusable = (el.matches('input, select, textarea, button')
        ? el
        : el.querySelector('input, select, textarea, button')) as HTMLElement | null;
      focusable?.focus();
    }, 90);
  };
  const cp12RequiredItemsPanel = cp12RequiredMissingItems.length > 0 ? (
    <div className="rounded-[16px] border-[0.5px] border-[rgba(186,117,23,0.4)] bg-[rgba(186,117,23,0.15)] p-4">
      <p className="text-[13px] font-medium text-[#EF9F27]">
        {cp12RequiredMissingItems.length} item{cp12RequiredMissingItems.length === 1 ? '' : 's'} left
      </p>
      <div className="mt-3 space-y-2">
        {cp12RequiredMissingItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-[8px] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-[13px]">
            <div className="min-w-0">
              <p className="font-medium text-[var(--color-text-primary)]">{item.label}</p>
              {item.hint ? <p className="mt-0.5 text-[12px] text-[var(--color-text-tertiary)]">{item.hint}</p> : null}
            </div>
            {item.action ? (
              <button
                type="button"
                className="rounded-full px-3 py-1 text-[12px] font-medium text-[#1a7a52]"
                onClick={() => {
                  item.action?.();
                  focusChecklistTarget(item.id);
                }}
              >
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

  if (issuedJobId && certificateType === 'cp12') {
    const pdfHref = `/jobs/${issuedJobId}/pdf?certificateType=cp12`;
    const publicToken = initialJobContext?.job?.public_token ?? '';
    const publicPath = publicToken ? `/j/${publicToken}` : pdfHref;
    const publicUrl =
      typeof window !== 'undefined' && publicToken ? `${window.location.origin}${publicPath}` : publicPath;
    const certificateRecipientEmail = [
      info.landlord_email,
      resolvedInitialInfo.landlord_email,
      resolvedInitialInfo.customer_email,
    ].find((email) => typeof email === 'string' && email.trim().length > 0)?.trim() ?? '';
    const fullJobAddress = [
      jobAddress.job_address_line1,
      jobAddress.job_address_line2,
      jobAddress.job_address_city,
      jobAddress.job_postcode,
    ]
      .filter((part) => part && part.trim())
      .join(', ');
    const whatsAppMessage = [
      `Hi ${info.landlord_name || 'there'},`,
      `Your gas safety record for ${fullJobAddress || info.property_address} is ready.`,
      `You can view and download it here: ${publicUrl}`,
    ].join(' ');
    const whatsAppHref = `https://wa.me/?text=${encodeURIComponent(whatsAppMessage)}`;
    const certificateEmailSubject = `Gas safety certificate for ${fullJobAddress || info.property_address || 'your property'}`;
    const certificateEmailBody = [
      `Hi ${info.landlord_name || 'there'},`,
      '',
      `Your gas safety certificate for ${fullJobAddress || info.property_address || 'the property'} is ready.`,
      '',
      `You can view and download it here: ${publicUrl}`,
      '',
      'Regards',
    ].join('\n');
    const mailtoHref = certificateRecipientEmail
      ? `mailto:${encodeURIComponent(certificateRecipientEmail)}?subject=${encodeURIComponent(certificateEmailSubject)}&body=${encodeURIComponent(certificateEmailBody)}`
      : '';
    return (
      <div className="mx-auto w-full max-w-2xl space-y-3 px-4 pb-16 pt-6">
        <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
          <p className="text-[11px] tracking-[0.5px] text-[var(--color-text-tertiary)]">CP12 issued</p>
          <h1 className="mt-2 text-[22px] font-medium text-[var(--color-text-primary)]">Finish this job</h1>
          <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
            The CP12 PDF has been generated. Confirm any boiler service and invoice action before sharing the job.
          </p>
        </div>

        <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
          <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Did you also service the boiler on this visit?</p>
          <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">
            If yes, the boiler service opens on the same job and uses the CP12 client, address and landlord details.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button type="button" className="rounded-full" disabled={isPending} onClick={handleLinkedBoilerService}>
              Yes, complete boiler service
            </Button>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setBoilerServiceDecision('no')}>
              No boiler service
            </Button>
          </div>
        </div>

        {boilerServiceDecision ? (
          <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Invoice for this job</p>
            <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">
              Certificate issuing is complete. Invoice setup is optional and can be finished now or later.
            </p>
            {invoiceReadiness?.ready ? (
              <div className="mt-4 rounded-[12px] border-[0.5px] border-emerald-200 bg-emerald-50 p-4 text-[12px] text-emerald-900">
                Standard rates and bank transfer details are set. The invoice will prefill and can be reviewed before sending.
              </div>
            ) : (
              <div className="mt-4 rounded-[12px] border-[0.5px] border-amber-200 bg-amber-50 p-4 text-[12px] text-amber-950">
                <p className="font-medium">Certificate issued. Add invoice details to complete the bundle.</p>
                <p className="mt-1">
                  Missing: {invoiceReadiness?.missingFields.length ? invoiceReadiness.missingFields.join(', ') : 'invoice settings'}.
                  You can still create an editable draft invoice or skip invoicing for this job.
                </p>
              </div>
            )}
            <div className="mt-4 grid gap-2">
              <div className="rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] p-4">
                <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Send certificate to landlord</p>
                <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">
                  Recipient is taken from the landlord details captured at job creation or CP12 Step 1.
                </p>
                <Input
                  readOnly
                  value={certificateRecipientEmail}
                  placeholder="No landlord email captured"
                  className="mt-3 bg-[var(--color-background-primary)]"
                />
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Button asChild variant="outline" className="rounded-full" disabled={!certificateRecipientEmail}>
                    <a href={mailtoHref}>Open email to landlord</a>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={async () => {
                      if (!certificateRecipientEmail || !navigator.clipboard?.writeText) return;
                      await navigator.clipboard.writeText(certificateRecipientEmail);
                      pushToast({ title: 'Landlord email copied', variant: 'success' });
                    }}
                    disabled={!certificateRecipientEmail}
                  >
                    Copy email
                  </Button>
                </div>
              </div>
              <Button asChild className="rounded-full">
                <Link href={`/invoices/new?jobId=${issuedJobId}`}>
                  {invoiceReadiness?.ready ? 'Create invoice now' : 'Create editable draft invoice'}
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/settings">Add rates and bank details</Link>
              </Button>
              <Button asChild variant="ghost" className="rounded-full">
                <Link href={`/jobs/${issuedJobId}/complete`}>Review completion checklist</Link>
              </Button>
            </div>
          </div>
        ) : null}

        {publicToken ? (
          <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Share with landlord</p>
            <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">{publicUrl}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button asChild className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700">
                <Link href={whatsAppHref} target="_blank">
                  Share by WhatsApp
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link href={publicPath}>Open public job page</Link>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const offlineDraftBannerNode = (
    <OfflineDraftBanner
      hasUnsyncedChanges={hasUnsyncedChanges}
      isOnline={isOnline}
      isSyncing={isOfflineDraftSyncing}
      lastSavedAt={localUpdatedAt}
      syncError={offlineDraftSyncError}
      syncErrorCount={offlineDraftSyncErrorCount}
    />
  );
  // Each step renders this. Stacked into one page they became four identical
  // banners down one scroll, so the sections drop it and the shell shows one.
  const offlineDraftBanner = singlePage ? null : offlineDraftBannerNode;

  const StepOne = (
    <WizardLayout
      variant={singlePage ? 'section' : 'step'}
      step={offsetStep(1)}
      total={totalSteps}
      title={
        isCp12 && singlePage
          ? 'Landlord & property'
          : isCp12 && infoSubStep === 1
            ? 'Tenant & location'
            : isCp12
              ? 'Landlord / owner'
              : 'People & location'
      }
      status={isCp12 ? `${certificateLabel} · ${infoSubStep === 1 ? '2' : '1'} of 2` : certificateLabel}
      onBack={
        isCp12 && infoSubStep === 1
          ? () => setInfoSubStep(0)
          : // From the first step, "Back" returns to the job's completion checklist —
            // the hub where a combined CP12 + service job lists both certificates so the
            // engineer can switch which one to work on (instead of only being able to
            // close out to the dashboard).
            () => router.push(`/jobs/${jobId}/complete`)
      }
      actionsHideWhenVisibleId="cp12-step1-footer-actions"
      actions={
        <button
          type="button"
          onClick={infoSubStep === 0 ? handleInfoPageOneNext : handleInfoNext}
          disabled={isPending}
          className="flex items-center gap-[5px] rounded-[20px] bg-[#111] px-[16px] py-[7px] text-[13px] font-medium text-white disabled:opacity-50"
          data-testid="cp12-step1-next"
        >
          {infoSubStep === 0 ? 'Next' : isPending ? 'Saving…' : prepareOnly ? 'Save & return' : 'Next'}
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      }
    >
      {isCp12 ? (
        <div className="space-y-3">
          {offlineDraftBanner}
          {infoSubStep === 0 || singlePage ? (
          <>
          <p className="text-[13px] text-[var(--color-text-secondary)]">Engineer and company details are pulled from account settings.</p>
          <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Landlord / Property owner</p>
            <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">
              Required for CP12. The landlord&apos;s (or agent&apos;s) name and correspondence address — where they receive documents. This is usually different from the property being inspected.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input
                value={info.landlord_name}
                onChange={(e) => setInfo((prev) => ({ ...prev, landlord_name: e.target.value }))}
                placeholder="Landlord / Owner name"
                className="rounded-[8px]"
                data-testid="cp12-landlord-name"
              />
              <Input
                value={info.landlord_company}
                onChange={(e) => setInfo((prev) => ({ ...prev, landlord_company: e.target.value }))}
                placeholder="Company (optional)"
                className="rounded-[8px]"
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
                  placeholder="Landlord's correspondence address or postcode"
                  className="rounded-[8px]"
                />
                {isLandlordLookupPending && !landlordAddressSuggestions.length ? (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-[8px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-3 py-2 text-[13px] text-[var(--color-text-secondary)]">
                    Searching addresses…
                  </div>
                ) : null}
                {landlordAddressSuggestions.length ? (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-[8px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
                    <div className="max-h-72 overflow-y-auto">
                      {landlordAddressSuggestions.map((suggestion) => {
                        const isSelected = selectedLandlordMatchId === suggestion.id;
                        return (
                          <button
                            key={suggestion.id}
                            type="button"
                            onClick={() => void handleLandlordAddressMatchSelect(suggestion)}
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
                {landlordAddressSearchError ? <p className="mt-2 text-[12px] text-[var(--color-red)]">{landlordAddressSearchError}</p> : null}
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
                className="rounded-[8px] sm:col-span-2"
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
                className="rounded-[8px]"
              />
              <Input
                autoComplete="off"
                value={info.landlord_postcode}
                onChange={(e) => setInfo((prev) => ({ ...prev, landlord_postcode: e.target.value }))}
                placeholder="Postcode"
                className="rounded-[8px]"
              />
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={info.landlord_tel}
                onChange={(e) => setInfo((prev) => ({ ...prev, landlord_tel: e.target.value }))}
                placeholder="Tel. No. (optional)"
                className="rounded-[8px]"
              />
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={info.landlord_mobile}
                onChange={(e) => setInfo((prev) => ({ ...prev, landlord_mobile: e.target.value }))}
                placeholder="Mobile number (optional)"
                className="rounded-[8px]"
              />
              <Input
                type="email"
                value={info.landlord_email}
                onChange={(e) => setInfo((prev) => ({ ...prev, landlord_email: e.target.value }))}
                placeholder="Email for reminders (optional)"
                className="rounded-[8px] sm:col-span-2"
              />
            </div>
          </div>
          </>
          ) : null}
          {/* The property address is Reg 36(3)(b) content and lived on the
              second half of a two-page step. Stacked, only the first half
              rendered — so a certificate started on one page had nowhere to
              enter the address of the premises it certifies. */}
          {infoSubStep === 1 || singlePage ? (
          <>

          <div className="grid gap-3 rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Property &amp; inspection location</p>
            <p className="text-[12px] text-[var(--color-text-tertiary)]">
              The address where the inspection is taking place — the property being certified. It appears as the Property Address on the certificate, separate from the landlord&apos;s correspondence address.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                type="date"
                value={info.inspection_date}
                onChange={(e) => setInfo((prev) => ({ ...prev, inspection_date: e.target.value }))}
                placeholder="Inspection date"
                className="rounded-[8px]"
              />
              <Input
                id="cp12-job-address-name"
                value={jobAddress.job_address_name}
                onChange={(e) => setJobAddress((prev) => ({ ...prev, job_address_name: e.target.value }))}
                placeholder="Flat / unit (optional)"
                className="rounded-[8px] sm:col-span-2"
              />
              <p className="text-[12px] text-[var(--color-text-tertiary)] sm:col-span-2">
                Flat or unit reference — shown as the first line of the Property Address block. Leave blank for a
                whole-property address.
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
                  placeholder="Property address being inspected — or postcode"
                  className="rounded-[8px]"
                />
                {isPostcodeLookupPending && !postcodeSuggestions.length ? (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-[8px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-3 py-2 text-[13px] text-[var(--color-text-secondary)]">
                    Searching addresses…
                  </div>
                ) : null}
                {postcodeSuggestions.length ? (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-[8px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
                    <div className="max-h-72 overflow-y-auto">
                      {postcodeSuggestions.map((suggestion) => {
                        const isSelected = selectedPostcodeMatchId === suggestion.id;
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
                {addressSearchError ? <p className="mt-2 text-[12px] text-[var(--color-red)]">{addressSearchError}</p> : null}
              </div>
              <Input
                value={jobAddress.job_address_line2}
                onChange={(e) => setJobAddress((prev) => ({ ...prev, job_address_line2: e.target.value }))}
                placeholder="Property address line 2"
                className="rounded-[8px] sm:col-span-2"
              />
              <Input
                value={jobAddress.job_address_city}
                onChange={(e) => setJobAddress((prev) => ({ ...prev, job_address_city: e.target.value }))}
                placeholder="City / Town"
                className="rounded-[8px]"
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  autoComplete="off"
                  value={jobAddress.job_postcode}
                  onChange={(e) => {
                    const value = e.target.value;
                    setJobAddress((prev) => ({ ...prev, job_postcode: value }));
                    setInfo((prev) => ({ ...prev, postcode: value }));
                  }}
                  placeholder="Postcode"
                  className="rounded-[8px] sm:flex-1"
                />
              </div>
            </div>
          </div>

            </>
          ) : null}
        </div>
      ) : (
        <p className="text-[13px] text-[var(--color-text-tertiary)]">Non-CP12 certificates currently use the simplified flow.</p>
      )}
      {singlePage ? null : (
      <div id="cp12-step1-footer-actions" className="sticky bottom-0 z-10 mt-6 flex gap-[8px] border-t-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-4 py-3">
        {isCp12 && infoSubStep === 1 ? (
          <button
            type="button"
            onClick={() => setInfoSubStep(0)}
            className="flex h-[44px] flex-1 items-center justify-center rounded-[22px] border-[0.5px] border-[var(--color-border-secondary)] bg-transparent text-[14px] text-[var(--color-text-secondary)]"
          >
            Back
          </button>
        ) : null}
        <button
          type="button"
          onClick={infoSubStep === 0 ? handleInfoPageOneNext : handleInfoNext}
          disabled={isPending}
          className="flex h-[44px] flex-[2] items-center justify-center gap-[6px] rounded-[22px] bg-[#111] text-[14px] font-medium text-white disabled:opacity-50"
          data-testid="cp12-step1-next"
        >
          {infoSubStep === 0 ? 'Next' : isPending ? 'Saving…' : prepareOnly ? 'Save & return' : 'Next'}
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      )}
    </WizardLayout>
  );

  const inApplianceDetail = activeApplianceIndex !== null;
  const applianceDisplayLabel = (a: Cp12Appliance, index: number) => {
    const mm = (a.make_model ?? '').toString().trim();
    if (mm) return mm;
    const cat = CP12_APPLIANCE_CATEGORIES.find((c) => c.value === resolveCp12Category(a.appliance_type));
    return cat?.label ?? `Appliance ${index + 1}`;
  };
  const applianceIdentityDone = (a: Cp12Appliance) =>
    Boolean((a.appliance_type ?? '').toString().trim()) && Boolean((a.location ?? '').toString().trim());
  const applianceChecksDone = (a: Cp12Appliance) => Boolean(getApplianceSafetyClassification(a));
  const CLASSIFICATION_BADGE: Record<string, { label: string; bg: string; color: string }> = {
    safe: { label: 'Safe', bg: '#e7f4ec', color: '#1a6d44' },
    ncs: { label: 'NCS', bg: '#e7f4ec', color: '#1a6d44' },
    ar: { label: 'At risk', bg: '#fbeecd', color: '#8a5a10' },
    id: { label: 'ID', bg: '#fbe3e3', color: '#9b2020' },
  };
  const ApplianceHub = (
    <>
      <div className="space-y-2">
        {offlineDraftBanner}
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
            Appliances ({appliances.length})
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-[8px] px-3 text-xs"
            onClick={addAndOpenAppliance}
            disabled={appliances.length >= MAX_APPLIANCES}
          >
            + Add appliance
          </Button>
        </div>
        {appliances.length === 0 ? (
          <button
            type="button"
            onClick={addAndOpenAppliance}
            className="flex w-full flex-col items-center gap-1 rounded-[16px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-4 py-8 text-center"
          >
            <span className="text-[14px] font-medium text-[var(--color-text-primary)]">Add your first appliance</span>
            <span className="text-[12px] text-[var(--color-text-tertiary)]">Capture its identity, then run the checks.</span>
          </button>
        ) : (
          <div className="space-y-2">
            {appliances.map((appliance, index) => {
              const idDone = applianceIdentityDone(appliance);
              const checksDone = applianceChecksDone(appliance);
              const classification = getApplianceSafetyClassification(appliance);
              const badge = classification ? CLASSIFICATION_BADGE[classification] : null;
              return (
                <button
                  key={`hub-appliance-${index}`}
                  type="button"
                  onClick={() => openAppliance(index)}
                  className="flex w-full items-center gap-3 rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-[var(--color-text-primary)]">
                      {applianceDisplayLabel(appliance, index)}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-secondary)]">
                      {(appliance.location ?? '').toString().trim() || 'Location not set'}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={`text-[11px] font-medium ${idDone ? 'text-[#1a7a52]' : 'text-[var(--color-text-tertiary)]'}`}>
                        {idDone ? 'Identity ✓' : 'Identity –'}
                      </span>
                      <span className="text-[11px] text-[var(--color-text-tertiary)]">·</span>
                      <span className={`text-[11px] font-medium ${checksDone ? 'text-[#1a7a52]' : 'text-[var(--color-text-tertiary)]'}`}>
                        {checksDone ? 'Checks ✓' : 'Checks –'}
                      </span>
                      {badge ? (
                        <span
                          className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: badge.bg, color: badge.color }}
                        >
                          {badge.label}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <svg className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              );
            })}
          </div>
        )}
        {appliances.length >= MAX_APPLIANCES ? (
          <p className="text-right text-[12px] text-[var(--color-text-tertiary)]">
            CP12 PDF fits up to five appliances. Start another certificate for more.
          </p>
        ) : null}
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
                    description: toUserMessage(error, 'Try again.'),
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
    </>
  );

  const ApplianceDetailIdentity = (
    <div className="space-y-2">
      {offlineDraftBanner}
      <ApplianceStep
        appliances={applianceProfiles}
        onAppliancesChange={handleApplianceProfilesChange}
        typeOptions={CP12_APPLIANCE_CATEGORIES.map((c) => ({ label: c.label, value: c.value }))}
        subtypeOptions={CP12_BOILER_SUBTYPES.map((s) => ({ label: s.label, value: s.value }))}
        subtypeLabel="Boiler type"
        showSubtypeWhen={(type) => resolveCp12Category(type) === 'boiler'}
        resolveCatalog={(type) => getApplianceCatalog(resolveCp12Category(type))}
        allowMultiple
        showExtendedFields={false}
        showYear={false}
        applyExtendedDefaults={false}
        inlineEditor
        showTopAddButton={false}
        onlyIndex={activeApplianceIndex}
      />
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-[var(--color-text-tertiary)]">
          Next: run this appliance&apos;s checks. You&apos;ll return to the list when done.
        </p>
        <button
          type="button"
          onClick={removeActiveAppliance}
          className="shrink-0 text-[12px] font-medium text-[#a32d2d] underline-offset-2 hover:underline"
        >
          Remove appliance
        </button>
      </div>
    </div>
  );

  const StepTwo = (
    <WizardLayout
      variant={singlePage ? 'section' : 'step'}
      step={offsetStep(2)}
      total={totalSteps}
      title={inApplianceDetail ? `Appliance ${(activeApplianceIndex ?? 0) + 1}` : 'Appliances'}
      status={inApplianceDetail ? 'Identity · then checks' : 'Add each appliance, then continue'}
      onBack={inApplianceDetail ? closeToHub : goBackOneStep}
      actionsHideWhenVisibleId="cp12-step2-footer-actions"
      actions={
        <button
          type="button"
          onClick={() => setStep(3)}
          disabled={isPending || (!inApplianceDetail && appliances.length === 0)}
          className="flex items-center gap-[5px] rounded-[20px] bg-[#111] px-[16px] py-[7px] text-[13px] font-medium text-white disabled:opacity-50"
        >
          {inApplianceDetail ? 'Checks' : 'Continue'}
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      }
    >
      {inApplianceDetail ? ApplianceDetailIdentity : ApplianceHub}
      {singlePage ? null : (
      <div id="cp12-step2-footer-actions" className="sticky bottom-0 z-10 mt-6 flex gap-[8px] border-t-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-4 py-3">
        <button
          type="button"
          onClick={inApplianceDetail ? closeToHub : goBackOneStep}
          className="flex h-[44px] flex-1 items-center justify-center rounded-[22px] border-[0.5px] border-[var(--color-border-secondary)] bg-transparent text-[14px] text-[var(--color-text-secondary)]"
        >
          {inApplianceDetail ? 'Back to list' : 'Back'}
        </button>
        <button
          type="button"
          onClick={() => setStep(3)}
          disabled={isPending || (!inApplianceDetail && appliances.length === 0)}
          className="flex h-[44px] flex-[2] items-center justify-center gap-[6px] rounded-[22px] bg-[#111] text-[14px] font-medium text-white disabled:opacity-50"
        >
          {inApplianceDetail ? 'Next: checks' : 'Continue'}
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      )}
    </WizardLayout>
  );

  // These sub-tab dots count the SAME required fields the Step-4 checklist
  // (`readingsOk`) requires, so an all-green dot always means issue-ready. The
  // count is three-valued (none filled → grey ring, some → amber, all → green)
  // so a partially-filled tab can no longer masquerade as complete — e.g. the
  // readings dot only goes green once both FGA groups carry their core CO/CO₂
  // values, not when just the high-fire group is filled.
  const countRequired = (...values: unknown[]) => ({
    filled: values.filter(Boolean).length,
    total: values.length,
  });
  const sumCounts = (...parts: Array<{ filled: number; total: number }>) =>
    parts.reduce(
      (acc, part) => ({ filled: acc.filled + part.filled, total: acc.total + part.total }),
      { filled: 0, total: 0 },
    );
  // Per-appliance count helpers so the checks tabs can show progress for a single
  // appliance (hub detail view) or summed across all (legacy all-in-one view).
  const inspectionCountFor = (a: Cp12Appliance) => {
    const cat = resolveCp12Category(a.appliance_type);
    // Flue type only counts toward completion for flued categories (hidden for hobs).
    return countRequired(
      ...(cp12FieldVisible(cat, 'flue_type') ? [a.flue_type] : []),
      a.appliance_inspected,
      a.appliance_serviced,
    );
  };
  const readingsCountFor = (a: Cp12Appliance) => {
    // FGA combustion analysis is optional, but all-or-nothing: once the
    // engineer starts entering it, both the high- and low-fire groups must
    // carry their core CO/CO₂ values before the tab can read complete.
    const anyCombustion =
      !!a.high_co_ppm || !!a.high_co2 || !!a.high_ratio || !!a.low_co_ppm || !!a.low_co2 || !!a.low_ratio;
    return anyCombustion
      ? countRequired(a.operating_pressure, a.heat_input, a.high_co_ppm, a.high_co2, a.low_co_ppm, a.low_co2)
      : countRequired(a.operating_pressure, a.heat_input);
  };
  const safetyCountFor = (a: Cp12Appliance) => {
    const cat = resolveCp12Category(a.appliance_type);
    // Flue checks count only for flued categories; cooker stability only for hobs/cookers.
    return countRequired(
      a.safety_devices_correct,
      a.ventilation_satisfactory,
      ...(cp12FieldVisible(cat, 'flue_condition', a.flue_type) ? [a.flue_condition] : []),
      ...(cp12FieldVisible(cat, 'flue_performance_test', a.flue_type) ? [a.flue_performance_test] : []),
      ...(cp12FieldVisible(cat, 'flue_integrity_test', a.flue_type) ? [a.flue_integrity_test] : []),
      ...(cp12FieldVisible(cat, 'spillage_test', a.flue_type) ? [a.spillage_test] : []),
      ...(cp12FieldVisible(cat, 'cooker_stability') ? [a.cooker_stability] : []),
      a.gas_tightness_test,
      a.safety_rating,
    );
  };
  // In the hub detail view, tab dots reflect the one active appliance; otherwise all.
  const countScope = inApplianceDetail && activeApplianceIndex != null && appliances[activeApplianceIndex]
    ? [appliances[activeApplianceIndex]]
    : appliances;
  const inspectionCount = sumCounts(...countScope.map(inspectionCountFor));
  const readingsCount = sumCounts(...countScope.map(readingsCountFor));
  const safetyCount = sumCounts(...countScope.map(safetyCountFor));
  const checkDotState = ({ filled, total }: { filled: number; total: number }) =>
    total > 0 && filled >= total ? 'all' : filled > 0 ? 'some' : 'none';

  const StepThree = (
    <WizardLayout
      variant={singlePage ? 'section' : 'step'}
      step={offsetStep(3)}
      total={totalSteps}
      title={inApplianceDetail ? `Appliance ${(activeApplianceIndex ?? 0) + 1} checks` : 'Property checks'}
      status={inApplianceDetail ? 'On-site checks' : 'Whole-installation checks'}
      onBack={handleChecksBack}
    >
      {offlineDraftBanner}
      <p className="mb-3 text-[12px] leading-[1.5] text-[var(--color-text-tertiary)]">
        {inApplianceDetail
          ? 'Only the Regulation 26(9) confirmation is legally required. Everything else — Readings, Safety and the additional inspection detail — is conventional and prints on the certificate only if you record it.'
          : 'Whole-installation checks are optional — they appear on the certificate only if you record them. Continue to signatures when ready.'}
      </p>
      {inApplianceDetail && !singlePage ? (
      <div className="mb-4 flex border-b-[0.5px] border-[var(--color-border-tertiary)]">
        {(
          [
            // Rendered only in wizard mode — see the guard on the wrapper below.
            { id: 'inspection', label: 'Inspection', count: inspectionCount },
            { id: 'readings', label: 'Readings (optional)', count: readingsCount },
            { id: 'safety', label: 'Safety (optional)', count: safetyCount },
          ] as {
            id: 'inspection' | 'readings' | 'safety' | 'house';
            label: string;
            count: { filled: number; total: number };
          }[]
        ).map((tab) => {
          const dotState = checkDotState(tab.count);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setChecksTab(tab.id)}
              aria-label={`${tab.label}, ${tab.count.filled} of ${tab.count.total} complete`}
              className={`subtab-btn flex flex-1 flex-col items-center justify-center gap-[5px] pb-[10px] pt-[6px] text-[12px] font-medium transition ${checksTab === tab.id ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-tertiary)]'}`}
            >
              <span>{tab.label}</span>
              <span
                aria-hidden="true"
                className="h-[8px] w-[8px] rounded-full"
                style={
                  dotState === 'all'
                    ? { background: '#1a7a52' }
                    : dotState === 'some'
                      ? { background: '#EF9F27' }
                      : { border: '1.5px solid var(--color-border-primary)', background: 'transparent' }
                }
              />
            </button>
          );
        })}
      </div>
      ) : null}

      {(singlePage || (inApplianceDetail && checksTab === 'inspection')) && (
        <div className="space-y-4">
          {appliances.map((appliance, index) => {
            if (activeApplianceIndex != null && index !== activeApplianceIndex) return null;
            const category = resolveCp12Category(appliance.appliance_type);
            return (
            <div
              key={`checks-${index}`}
              ref={(el) => {
                applianceRefs.current[index] = el;
              }}
              className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4"
            >
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Appliance #{index + 1}</p>
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">
                      GC number (optional)
                    </span>
                    <Input
                      value={appliance.gc_number ?? ''}
                      placeholder="47-311-92"
                      onChange={(event) => setApplianceField(index, 'gc_number', event.target.value)}
                    />
                  </label>
                  {/* Asked per appliance, not once for the record: a property can
                      run a mains gas boiler alongside an LPG appliance, and the
                      fuel decides which part of a registration the work is under. */}
                  <SearchableSelect
                    label="Gas type"
                    value={appliance.gas_type ?? ''}
                    options={[...CP12_GAS_TYPES]}
                    placeholder="Natural gas"
                    onChange={(value) => setApplianceField(index, 'gas_type', value)}
                  />
                </div>
                {cp12FieldVisible(category, 'flue_type') ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SearchableSelect
                      label={`Appliance ${index + 1} flue type`}
                      value={appliance.flue_type ?? ''}
                      options={[...CP12_FLUE_TYPES]}
                      placeholder="Select or type"
                      onChange={(val) => setApplianceField(index, 'flue_type', val)}
                    />
                    <label className="space-y-1.5">
                      <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">Flue location (if different)</span>
                      <Input
                        value={appliance.flue_location ?? ''}
                        placeholder={appliance.location || 'Defaults to appliance location'}
                        onChange={(event) => setApplianceField(index, 'flue_location', event.target.value)}
                      />
                    </label>
                  </div>
                ) : null}
                <label className="flex items-start gap-2 rounded-[10px] border-[0.5px] border-[var(--color-action)] bg-[var(--color-action-bg)] p-3 text-[13px] text-[var(--color-text-primary)]">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-[var(--color-action)]"
                    checked={appliance.reg_26_9_confirmed ?? false}
                    onChange={(event) => setApplianceBooleanField(index, 'reg_26_9_confirmed', event.target.checked)}
                  />
                  <span>
                    Regulation 26(9) checks completed for this appliance or flue
                    <span className="ml-1 font-medium text-[var(--color-action)]">· Required</span>
                  </span>
                </label>
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
                    Additional detail
                    <span className="ml-1 normal-case tracking-normal text-[var(--color-text-tertiary)]">· Conventional (optional)</span>
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-3">
                      <EnumChips
                        label="Landlord's appliance"
                        value={normalizeYesNoValue(appliance.landlords_appliance)}
                        options={CP12_YES_NO_OPTIONS}
                        onChange={(val) => setApplianceField(index, 'landlords_appliance', yesNoLabel(val as YesNoValue))}
                      />
                    </div>
                    <div className="rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-3">
                      <EnumChips
                        label="Appliance inspected"
                        value={normalizeYesNoValue(appliance.appliance_inspected)}
                        options={CP12_YES_NO_OPTIONS}
                        onChange={(val) => setApplianceField(index, 'appliance_inspected', yesNoLabel(val as YesNoValue))}
                      />
                    </div>
                    <div className="rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-3">
                      <EnumChips
                        label="Appliance serviced"
                        value={normalizeYesNoValue(appliance.appliance_serviced)}
                        options={CP12_YES_NO_OPTIONS}
                        onChange={(val) => setApplianceField(index, 'appliance_serviced', yesNoLabel(val as YesNoValue))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {(singlePage || (inApplianceDetail && checksTab === 'readings')) && (
        <div className="space-y-4">
          {appliances.map((appliance, index) => {
            if (activeApplianceIndex != null && index !== activeApplianceIndex) return null;
            const category = resolveCp12Category(appliance.appliance_type);
            const combustionVis = cp12FieldVisibility(category, 'combustion');
            const hasCombustionValues =
              !!appliance.high_co_ppm || !!appliance.high_co2 || !!appliance.high_ratio ||
              !!appliance.low_co_ppm || !!appliance.low_co2 || !!appliance.low_ratio;
            const showCombustion =
              combustionVis === 'shown' ||
              (combustionVis === 'optional' && (combustionOptIn[index] || hasCombustionValues));
            return (
            <div
              key={`checks-${index}`}
              ref={(el) => {
                applianceRefs.current[index] = el;
              }}
              className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4"
            >
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Appliance #{index + 1} readings</p>
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-3">
                    <UnitNumberInput
                      label="Operating pressure"
                      unit="mbar"
                      value={appliance.operating_pressure ?? ''}
                      onChange={(val) => setApplianceField(index, 'operating_pressure', val)}
                      labelAction={renderReadingsVoiceButton(index, 'pressure', 'Speak pressure')}
                    />
                  </div>
                  <div className="rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-3">
                    <UnitNumberInput
                      label="Heat input"
                      unit="kW"
                      value={appliance.heat_input ?? ''}
                      onChange={(val) => setApplianceField(index, 'heat_input', val)}
                    />
                  </div>
                </div>

                {showCombustion ? (
                <div className="rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-3">
                  <p className="text-[11px] tracking-[0.5px] text-[var(--color-text-secondary)]">Combustion readings</p>
                  <p className="mb-3 mt-1 text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">Speak readings in order with small pauses between each value.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] tracking-[0.5px] text-[var(--color-text-secondary)]">High combustion reading</p>
                        {renderReadingsVoiceButton(index, 'high', 'Speak high')}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <UnitNumberInput
                          label="CO ppm"
                          unit="ppm"
                          value={appliance.high_co_ppm ?? ''}
                          onChange={(val) => setApplianceField(index, 'high_co_ppm', val)}
                        />
                        <UnitNumberInput
                          label="CO₂ %"
                          unit="%"
                          value={appliance.high_co2 ?? ''}
                          onChange={(val) => setApplianceField(index, 'high_co2', val)}
                        />
                        <UnitNumberInput
                          label="Ratio"
                          unit="ratio"
                          value={appliance.high_ratio ?? ''}
                          onChange={(val) => setApplianceField(index, 'high_ratio', val)}
                        />
                      </div>
                    </div>
                    <div className="rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] tracking-[0.5px] text-[var(--color-text-secondary)]">Low combustion reading</p>
                        {renderReadingsVoiceButton(index, 'low', 'Speak low')}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <UnitNumberInput
                          label="CO ppm"
                          unit="ppm"
                          value={appliance.low_co_ppm ?? ''}
                          onChange={(val) => setApplianceField(index, 'low_co_ppm', val)}
                        />
                        <UnitNumberInput
                          label="CO₂ %"
                          unit="%"
                          value={appliance.low_co2 ?? ''}
                          onChange={(val) => setApplianceField(index, 'low_co2', val)}
                        />
                        <UnitNumberInput
                          label="Ratio"
                          unit="ratio"
                          value={appliance.low_ratio ?? ''}
                          onChange={(val) => setApplianceField(index, 'low_ratio', val)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium text-[var(--color-text-secondary)]">Combustion notes (optional)</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="flex items-center gap-1 rounded-[6px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-3 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-action)]"
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
                        <button
                          type="button"
                          className="flex items-center gap-1 rounded-[6px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-3 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-action)]"
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
                ) : combustionVis === 'optional' ? (
                  <button
                    type="button"
                    onClick={() => setCombustionOptIn((prev) => ({ ...prev, [index]: true }))}
                    className="w-full rounded-[12px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-3 text-[12px] font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-action)]"
                  >
                    + Add combustion readings (optional for this appliance)
                  </button>
                ) : null}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {(singlePage || (inApplianceDetail && checksTab === 'safety')) && (
        <div className="space-y-4">
          {appliances.map((appliance, index) => {
            if (activeApplianceIndex != null && index !== activeApplianceIndex) return null;
            const category = resolveCp12Category(appliance.appliance_type);
            const classification = getApplianceSafetyClassification(appliance);
            const safeToUse = getApplianceSafeToUse(appliance);
            const showUnsafeFields = classification === 'ar' || classification === 'id';
            // Reveal the defect / remedial capture whenever the appliance is
            // unsafe OR any individual check fails, so a defect is recorded in
            // context (Reg 36(3)(e)/(f)).
            const failedChecks = cp12FailedChecks(appliance);
            const showDefectCapture = showUnsafeFields || failedChecks.length > 0;
            return (
              <div
                key={`checks-${index}`}
                ref={(el) => {
                  applianceRefs.current[index] = el;
                }}
                className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4"
              >
                <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Appliance #{index + 1} safety</p>
                <div className="mt-3 space-y-[14px]">
                  <div className="grid gap-[14px] sm:grid-cols-2">
                    {visibleCp12ApplianceChecks(category, appliance.flue_type).map((check) => {
                      const raw = (appliance[check.key] ?? '').toLowerCase();
                      return (
                        <Fragment key={check.key}>
                          {check.answers === 'yes_no' ? (
                            <EnumChips
                              label={check.label}
                              hint={check.hint}
                              value={appliance[check.key] ?? ''}
                              options={YES_NO_OPTIONS}
                              onChange={(val) => setApplianceField(index, check.key, val)}
                            />
                          ) : (
                            <PassFailToggle
                              label={check.label}
                              hint={check.hint}
                              value={raw === 'pass' ? 'pass' : raw === 'fail' ? 'fail' : null}
                              onChange={(val) => setApplianceField(index, check.key, val ?? '')}
                            />
                          )}
                          {/* Evidence for the integrity verdict, so it sits
                              directly under it. Free text conditional on an
                              answer rather than a check with a verdict, which is
                              why it is not in the shared list. */}
                          {check.key === 'flue_integrity_test' &&
                          appliance.flue_integrity_test &&
                          cp12FieldVisible(category, 'flue_integrity_readings', appliance.flue_type) ? (
                            <>
                              <label className="space-y-1.5">
                                <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">Air inlet CO2 at high rate (optional)</span>
                                <Input
                                  value={appliance.flue_integrity_co2_high ?? ''}
                                  placeholder="0.02 %"
                                  onChange={(event) => setApplianceField(index, 'flue_integrity_co2_high', event.target.value)}
                                />
                              </label>
                              <label className="space-y-1.5">
                                <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">Air inlet CO2 at low rate (optional)</span>
                                <Input
                                  value={appliance.flue_integrity_co2_low ?? ''}
                                  placeholder="0.01 %"
                                  onChange={(event) => setApplianceField(index, 'flue_integrity_co2_low', event.target.value)}
                                />
                              </label>
                            </>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </div>
                  <div className="rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <EnumChips
                          label="Appliance safe to use"
                          value={safeToUse}
                          options={CP12_YES_NO_OPTIONS}
                          onChange={(val) => setApplianceSafeToUse(index, (val as YesNoValue) ?? '')}
                        />
                      </div>
                      <div>
                        <EnumChips
                          label="Condition classification"
                          value={classification}
                          options={getCp12ClassificationOptions(safeToUse)}
                          onChange={(val) => setApplianceSafetyClassification(index, val as Cp12SafetyClassification)}
                        />
                      </div>
                    </div>
                    {showDefectCapture ? (
                      <div className="mt-4 space-y-3">
                        {failedChecks.length > 0 ? (
                          <p className="text-[12px] font-medium text-[var(--color-status-danger,#9b2020)]">
                            Failed: {failedChecks.join(', ')} — record the defect and remedial action below.
                          </p>
                        ) : null}
                        <div className="space-y-1.5">
                          <p className="text-[12px] font-medium text-[var(--color-text-secondary)]">Defect / unsafe situation</p>
                          <div className="flex flex-wrap gap-1.5">
                            {CP12_DEFECT_PRESETS.map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setApplianceField(index, 'defect_notes', appendPresetSnippet(appliance.defect_notes, preset))}
                                className="rounded-full border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-action)] hover:text-[var(--color-text-primary)]"
                              >
                                + {preset}
                              </button>
                            ))}
                          </div>
                          <Textarea
                            value={appliance.defect_notes ?? ''}
                            onChange={(e) => setApplianceField(index, 'defect_notes', e.target.value)}
                            placeholder="Defect notes — tap a chip above or type your own"
                            className="min-h-[80px]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[12px] font-medium text-[var(--color-text-secondary)]">Actions taken</p>
                          <div className="flex flex-wrap gap-1.5">
                            {CP12_ACTION_TAKEN_PRESETS.map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setApplianceField(index, 'actions_taken', appendPresetSnippet(appliance.actions_taken, preset))}
                                className="rounded-full border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-action)] hover:text-[var(--color-text-primary)]"
                              >
                                + {preset}
                              </button>
                            ))}
                          </div>
                          <Textarea
                            value={appliance.actions_taken ?? ''}
                            onChange={(e) => setApplianceField(index, 'actions_taken', e.target.value)}
                            placeholder="Actions taken — tap a chip above or type your own"
                            className="min-h-[80px]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[12px] font-medium text-[var(--color-text-secondary)]">Actions required</p>
                          <div className="flex flex-wrap gap-1.5">
                            {CP12_ACTION_REQUIRED_PRESETS.map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setApplianceField(index, 'actions_required', appendPresetSnippet(appliance.actions_required, preset))}
                                className="rounded-full border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-action)] hover:text-[var(--color-text-primary)]"
                              >
                                + {preset}
                              </button>
                            ))}
                          </div>
                          <Textarea
                            value={appliance.actions_required ?? ''}
                            onChange={(e) => setApplianceField(index, 'actions_required', e.target.value)}
                            placeholder="Actions required — tap a chip above or type your own"
                            className="min-h-[80px]"
                          />
                        </div>
                        <p className="text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">
                          On-site actions taken (GIUSP). These carry straight onto the Gas Warning
                          Notice for this appliance, which is issued alongside the certificate and
                          does not use up one of your monthly certificates.
                        </p>
                        <div className="grid gap-2 text-[13px] text-[var(--color-text-primary)] sm:grid-cols-3">
                          <label className="flex items-start gap-2 rounded-[8px] border-[0.5px] border-[var(--color-border-tertiary)] p-3">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 accent-[var(--color-action)]"
                              checked={appliance.warning_notice_issued ?? false}
                              onChange={(e) => setApplianceBooleanField(index, 'warning_notice_issued', e.target.checked)}
                            />
                            <span>Warning notice given to customer on site</span>
                          </label>
                          <label className="flex items-start gap-2 rounded-[8px] border-[0.5px] border-[var(--color-border-tertiary)] p-3">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 accent-[var(--color-action)]"
                              checked={appliance.appliance_disconnected ?? false}
                              onChange={(e) => setApplianceBooleanField(index, 'appliance_disconnected', e.target.checked)}
                            />
                            <span>Appliance disconnected</span>
                          </label>
                          <label className="flex items-start gap-2 rounded-[8px] border-[0.5px] border-[var(--color-border-tertiary)] p-3">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 accent-[var(--color-action)]"
                              checked={appliance.danger_do_not_use_attached ?? false}
                              onChange={(e) => setApplianceBooleanField(index, 'danger_do_not_use_attached', e.target.checked)}
                            />
                            <span>Danger Do Not Use attached</span>
                          </label>
                        </div>

                        {classification === 'ar' || classification === 'id' ? (
                          <UnsafeSituationFields
                            classification={classification === 'id' ? 'IMMEDIATELY_DANGEROUS' : 'AT_RISK'}
                            answers={giuspAnswersFor(index)}
                            onChange={(key, value) => setGiuspAnswer(index, key, value)}
                          />
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-2 text-[12px] text-[var(--color-text-tertiary)]">
                        Use Safe or NCS when the appliance remains safe to use. Switch Appliance safe to use to No for AR or ID.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!inApplianceDetail && (
        <div className="space-y-4">
          <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Whole-house safety (optional)</p>
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
          <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">CO alarms (optional)</p>
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
          {isCp12 &&
          (hasValue(defects.defect_description) ||
            hasValue(defects.remedial_action) ||
            appliances.some((a) => cp12ApplianceHasFailedCheck(a) || ['ar', 'id'].includes(getApplianceSafetyClassification(a)))) ? (
            <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Defects &amp; remedial action</p>
                {!defectsEdited ? (
                  <span className="text-[11px] text-[var(--color-text-tertiary)]">Auto-filled from checks · editable</span>
                ) : null}
              </div>
              <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">
                These appear on the certificate. Auto-filled from failed checks and per-appliance notes — edit freely.
              </p>
              <Textarea
                className="mt-3 min-h-[80px]"
                value={defects.defect_description}
                onChange={(e) => {
                  setDefectsEdited(true);
                  setDefects((prev) => ({ ...prev, defect_description: e.target.value }));
                }}
                placeholder="Defects identified"
              />
              <Textarea
                className="mt-3 min-h-[80px]"
                value={defects.remedial_action}
                onChange={(e) => {
                  setDefectsEdited(true);
                  setDefects((prev) => ({ ...prev, remedial_action: e.target.value }));
                }}
                placeholder="Remedial action taken"
              />
              {defectsEdited ? (
                <button
                  type="button"
                  className="mt-2 text-[12px] text-[var(--color-action)] underline"
                  onClick={() => {
                    const suggested = composeCp12DefectSummary(appliances);
                    setDefects((prev) => ({ ...prev, ...suggested }));
                    setDefectsEdited(false);
                  }}
                >
                  Reset to auto-filled summary
                </button>
              ) : null}
            </div>
          ) : null}
          <details className="group rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4" open={hasValue(evidenceFields.comments)}>
            <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-medium text-[var(--color-text-primary)]">
              <span>Comments (optional)</span>
              <span className="text-[12px] text-[var(--color-text-secondary)] group-open:hidden">Add note</span>
            </summary>
            <Textarea
              className="mt-3 min-h-[90px]"
              value={evidenceFields.comments ?? ''}
              onChange={(e) => handleEvidenceFieldsUpdate({ comments: e.target.value })}
              placeholder="Site notes or comments that appear on the CP12"
            />
          </details>
        </div>
      )}

      {singlePage ? null : (
      <div id="cp12-step3-footer-actions" className="sticky bottom-0 z-10 mt-6 flex gap-[8px] border-t-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-4 py-3">
        <button
          type="button"
          onClick={handleChecksBack}
          disabled={isPending}
          className="flex h-[44px] flex-1 items-center justify-center rounded-[22px] border-[0.5px] border-[var(--color-border-secondary)] bg-transparent text-[14px] text-[var(--color-text-secondary)] disabled:opacity-50"
        >
          Back
        </button>
        {!inApplianceDetail ? (
          <button
            type="button"
            onClick={handleChecksNext}
            disabled={isPending}
            className="flex h-[44px] flex-[2] items-center justify-center gap-[6px] rounded-[22px] bg-[#1a7a52] text-[14px] font-medium text-white disabled:opacity-50"
          >
            Save & Continue
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        ) : checksTab === 'safety' ? (
          <button
            type="button"
            onClick={closeToHub}
            disabled={isPending}
            className="flex h-[44px] flex-[2] items-center justify-center gap-[6px] rounded-[22px] bg-[#1a7a52] text-[14px] font-medium text-white disabled:opacity-50"
          >
            Save · appliance list
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (checksTab === 'inspection') setChecksTab('readings');
              else setChecksTab('safety');
            }}
            disabled={isPending}
            className="flex h-[44px] flex-[2] items-center justify-center gap-[6px] rounded-[22px] bg-[#111] text-[14px] font-medium text-white disabled:opacity-50"
          >
            Next
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
      )}
    </WizardLayout>
  );

  const StepFour = (
    <WizardLayout
      variant={singlePage ? 'section' : 'step'}
      step={offsetStep(4)}
      total={totalSteps}
      title="Signatures & PDF"
      status="Finish"
      onBack={goBackOneStep}
      actionsHideWhenVisibleId="cp12-step4-footer-actions"
      actions={
        <button
          type="button"
          onClick={() => setStep(1)}
          className="flex h-[30px] items-center rounded-[20px] border-[0.5px] border-[var(--color-border-secondary)] bg-transparent px-[14px] text-[13px] text-[var(--color-text-secondary)]"
        >
          Edit
        </button>
      }
    >
      <div className="space-y-3">
        {offlineDraftBanner}
        {cp12RequiredItemsPanel}
        {!info.landlord_email.trim() ? (
          <div className="rounded-[16px] border-[0.5px] border-[var(--color-amber)]/30 bg-[var(--color-amber-bg)] p-4 text-[13px] text-[var(--color-text-primary)]">
            <p className="font-medium">Landlord email is missing</p>
            <p className="mt-1 text-[var(--color-text-secondary)]">
              You can still issue this CP12, but adding an email enables renewal reminders and landlord portal links later.
            </p>
            <Button type="button" variant="outline" className="mt-3 rounded-full" onClick={() => setStep(1)}>
              Add landlord email
            </Button>
          </div>
        ) : null}
        <div id="cp12-signatures" className="space-y-3">
        {showCustomerSignature ? (
          <SignatureCard
            label="Customer (optional)"
            existingUrl={customerSignature as string}
            onUpload={(file) => {
              const data = new FormData();
              data.append('jobId', jobId);
              data.append('role', 'customer');
              data.append('file', file);
              startTransition(async () => {
                try {
                  const { url, path } = await uploadSignature(data);
                  setCustomerSignature(url);
                  setCustomerSignaturePath(path);
                  pushToast({ title: 'Customer signature saved', variant: 'success' });
                } catch (error) {
                  pushToast({
                    title: 'Could not save signature',
                    description: toUserMessage(error, 'Try again.'),
                    variant: 'error',
                  });
                }
              });
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowCustomerSignature(true)}
            className="flex w-full items-center justify-center gap-2 rounded-[12px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-4 py-3 text-[13px] font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-action)]"
          >
            + Add customer signature (optional)
          </button>
        )}
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
                  description: toUserMessage(error, 'Try again.'),
                  variant: 'error',
                });
              }
            });
          }}
        />
        </div>
        <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
          <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Completion</p>
          <Input
            type="date"
            value={completionDate}
            onChange={(e) => setCompletionDate(e.target.value)}
            className="mt-2"
          />
        </div>
        <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
          <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Next inspection due</p>
          <Input
            type="date"
            value={evidenceFields.next_inspection_due ?? ''}
            onChange={(e) => handleEvidenceFieldsUpdate({ next_inspection_due: e.target.value })}
            className="mt-2"
          />
          <p className="mt-1.5 text-[12px] text-[var(--color-text-tertiary)]">
            Auto-set to 12 months after completion. Edit if the renewal should fall on a different date.
          </p>
        </div>
        <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
          <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Evidence photos (optional)</p>
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
      <div id="cp12-step4-footer-actions" className="sticky bottom-0 z-10 mt-6 flex gap-[8px] border-t-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-4 py-3">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="flex h-[44px] flex-1 items-center justify-center rounded-[22px] border-[0.5px] border-[var(--color-border-secondary)] bg-transparent text-[14px] text-[var(--color-text-secondary)]"
        >
          Edit
        </button>
        <button
          type="button"
          disabled={isBusy || checklist.blockingMissing > 0}
          onClick={handleGenerate}
          data-testid="cp12-issue"
          className="flex min-h-[44px] flex-[2] items-center justify-center gap-[6px] rounded-[22px] bg-[#1a7a52] px-2 text-center text-[14px] font-medium leading-tight text-white disabled:opacity-50"
        >
          {queuedIssue
            ? 'Issue queued'
            : !isOnline
              ? 'Queue issue'
              : hasUnsyncedChanges || isOfflineDraftSyncing
                ? 'Save & issue CP12'
                : firstBlockingMissing
                  ? `Complete: ${firstBlockingMissing.label}`
                  : isGeneratingPdf
                    ? 'Issuing…'
                    : 'Issue CP12'}
        </button>
      </div>
    </WizardLayout>
  );

  const limitModal = limitReachedMessage ? (
    <LimitReachedModal message={limitReachedMessage} onDismiss={() => setLimitReachedMessage(null)} />
  ) : null;

  if (singlePage) {
    return (
      <>
        <div className="min-h-screen bg-[var(--color-background-secondary)]">
          <header className="sticky top-14 z-20 border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-4 py-3">
            <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
              {/* The page before this one, not the job list. Arriving here from
                  /jobs/new and pressing Back landed on every job the engineer
                  has, which is not where they were. */}
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.history.length > 1) {
                    router.back();
                    return;
                  }
                  router.push('/jobs');
                }}
                className="text-[13px] text-[var(--color-text-secondary)]"
              >
                Back
              </button>
              <p className="text-[15px] font-medium text-[var(--color-text-primary)]">CP12</p>
            </div>
          </header>
          <main className="mx-auto max-w-2xl px-4 pb-32 pt-6">
            <div className="mb-5">{offlineDraftBannerNode}</div>
            {savedLandlordPicker}
            {StepOne}
            {StepTwo}
            {StepThree}
            {StepFour}
          </main>
        </div>
        {limitModal}
      </>
    );
  }

}

const hasValue = (val: unknown) => typeof val === 'string' && val.trim().length > 0;
const booleanFromField = (val: unknown) => val === true || val === 'true' || val === 'YES' || val === 'yes';
