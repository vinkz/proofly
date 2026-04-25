'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { WizardLayout } from '@/components/certificates/wizard-layout';
import { SignatureCard } from '@/components/certificates/signature-card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { CollapsibleSection } from '@/components/wizard/layout/collapsible-section';
import { EvidenceCard } from './evidence-card';
import { GAS_WARNING_CLASSIFICATIONS, type GasWarningClassification } from '@/types/gas-warning-notice';
import {
  saveGasWarningJobInfo,
  saveGasWarningDetails,
  generateCertificatePdf,
  uploadJobPhoto,
  uploadSignature,
} from '@/server/certificates';
import { tryUpdateJobRecord } from '@/server/jobRecords';
import type { CertificateType, Cp12Appliance, PhotoCategory } from '@/types/certificates';
import { mergeJobContextFields, type InitialJobContext } from './initial-job-context';
import { buildWizardDraftStorageKey, useWizardDraft } from '@/hooks/use-wizard-draft';

type GasWarningNoticeWizardProps = {
  jobId: string;
  initialFields: Record<string, string | null | undefined>;
  initialJobContext?: InitialJobContext | null;
  initialAppliances?: Cp12Appliance[];
  certificateType: CertificateType;
  stepOffset?: number;
  startStep?: number;
};

type GasWarningFormState = {
  property_address: string;
  postcode: string;
  customer_name: string;
  customer_contact: string;
  customer_company: string;
  customer_address_line1: string;
  customer_address_line2: string;
  customer_city: string;
  customer_address: string;
  customer_postcode: string;
  appliance_location: string;
  appliance_type: string;
  make_model: string;
  serial_number: string;
  gas_escape_issue: boolean;
  pipework_issue: boolean;
  ventilation_issue: boolean;
  meter_issue: boolean;
  chimney_flue_issue: boolean;
  other_issue: boolean;
  other_issue_details: string;
  gas_supply_isolated: boolean;
  appliance_capped_off: boolean;
  customer_refused_isolation: boolean;
  classification: GasWarningClassification | '';
  unsafe_situation_description: string;
  underlying_cause: string;
  actions_taken: string;
  emergency_services_contacted: boolean;
  emergency_reference: string;
  danger_do_not_use_label_fitted: boolean;
  meter_or_appliance_tagged: boolean;
  riddor_11_1_reported: boolean;
  riddor_11_2_reported: boolean;
  customer_present: boolean;
  notice_left_on_premises: boolean;
  customer_informed: boolean;
  customer_understands_risks: boolean;
  customer_signed_at: string;
  engineer_name: string;
  engineer_company: string;
  gas_safe_number: string;
  engineer_id_card_number: string;
  issued_at: string;
};

type GasWarningDraftState = {
  step: number;
  fields: GasWarningFormState;
  jobAddress: {
    job_reference: string;
    job_address_name: string;
    job_address_line1: string;
    job_address_line2: string;
    job_address_city: string;
    job_postcode: string;
    job_tel: string;
  };
  engineerSignature: string;
  customerSignature: string;
};

const FINAL_EVIDENCE_CATEGORIES: Array<{ key: PhotoCategory; label: string }> = [
  { key: 'appliance_photo', label: 'Appliance' },
  { key: 'issue_photo', label: 'Issue/Defect' },
  { key: 'site', label: 'Site' },
];

const parseBool = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'y', 'on'].includes(value.toLowerCase());
  }
  return false;
};

const deriveClassification = (classification: unknown, classificationCode: unknown): GasWarningClassification | '' => {
  const normalizedClassification = typeof classification === 'string' ? classification.trim() : '';
  if (normalizedClassification === 'IMMEDIATELY_DANGEROUS' || normalizedClassification === 'AT_RISK') {
    return normalizedClassification;
  }

  const normalizedCode = typeof classificationCode === 'string' ? classificationCode.trim().toUpperCase() : '';
  if (normalizedCode === 'ID') return 'IMMEDIATELY_DANGEROUS';
  if (normalizedCode === 'AR') return 'AT_RISK';
  return '';
};

const getClassificationCode = (classification: GasWarningClassification | '') => {
  if (classification === 'IMMEDIATELY_DANGEROUS') return 'ID';
  if (classification === 'AT_RISK') return 'AR';
  return '';
};

const splitAddressParts = (value: string | null | undefined) =>
  String(value ?? '')
    .split(/[\r\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

const buildAddressText = (...parts: Array<string | null | undefined>) =>
  parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join('\n');

function LabeledField({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`space-y-1 ${className}`}>
      <span className="block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground/80">{label}</span>
      {children}
    </label>
  );
}

export function GasWarningNoticeWizard({
  jobId,
  initialFields,
  initialJobContext = null,
  initialAppliances = [],
  certificateType,
  stepOffset = 0,
  startStep = 1,
}: GasWarningNoticeWizardProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const initialStep = Math.min(3, Math.max(1, startStep - stepOffset));
  const [step, setStep] = useState(initialStep);
  const [isPending, startTransition] = useTransition();
  const resolvedFields = mergeJobContextFields(initialFields, initialJobContext);
  const demoEnabled = false;
  const totalSteps = 3 + stepOffset;
  const offsetStep = (value: number) => value + stepOffset;
  const draftStorageKey = useMemo(() => buildWizardDraftStorageKey(certificateType, jobId), [certificateType, jobId]);

  useEffect(() => {
    if (!jobId) return;
    void tryUpdateJobRecord(jobId, {
      resume_certificate_type: certificateType,
      resume_step: step + stepOffset,
    });
  }, [certificateType, jobId, step, stepOffset]);

  const initialCustomerPresent =
    resolvedFields.customer_present !== undefined
      ? parseBool(resolvedFields.customer_present)
      : resolvedFields.notice_left_on_premises !== undefined
        ? !parseBool(resolvedFields.notice_left_on_premises)
        : true;
  const initialCustomerAddressParts = splitAddressParts(resolvedFields.customer_address);
  const initialCustomerAddressLine1 = resolvedFields.customer_address_line1 ?? initialCustomerAddressParts[0] ?? '';
  const initialCustomerAddressLine2 =
    resolvedFields.customer_address_line2 ?? (initialCustomerAddressParts.length >= 3 ? initialCustomerAddressParts.slice(1, -1).join(', ') : '');
  const initialCustomerCity =
    resolvedFields.customer_city ??
    (initialCustomerAddressParts.length >= 2 ? initialCustomerAddressParts.at(-1) ?? '' : '');

  const [fields, setFields] = useState<GasWarningFormState>({
    property_address: resolvedFields.property_address ?? '',
    postcode: resolvedFields.postcode ?? '',
    customer_name: resolvedFields.customer_name ?? '',
    customer_contact: resolvedFields.customer_contact ?? '',
    customer_company: resolvedFields.customer_company ?? '',
    customer_address_line1: initialCustomerAddressLine1,
    customer_address_line2: initialCustomerAddressLine2,
    customer_city: initialCustomerCity,
    customer_address:
      resolvedFields.customer_address ??
      buildAddressText(initialCustomerAddressLine1, initialCustomerAddressLine2, initialCustomerCity),
    customer_postcode: resolvedFields.customer_postcode ?? '',
    appliance_location: resolvedFields.appliance_location ?? '',
    appliance_type: resolvedFields.appliance_type ?? '',
    make_model: resolvedFields.make_model ?? '',
    serial_number: resolvedFields.serial_number ?? '',
    gas_escape_issue: parseBool(resolvedFields.gas_escape_issue),
    pipework_issue: parseBool(resolvedFields.pipework_issue),
    ventilation_issue: parseBool(resolvedFields.ventilation_issue),
    meter_issue: parseBool(resolvedFields.meter_issue),
    chimney_flue_issue: parseBool(resolvedFields.chimney_flue_issue),
    other_issue: parseBool(resolvedFields.other_issue) || Boolean((resolvedFields.other_issue_details ?? '').trim()),
    other_issue_details: resolvedFields.other_issue_details ?? '',
    gas_supply_isolated: parseBool(resolvedFields.gas_supply_isolated),
    appliance_capped_off: parseBool(resolvedFields.appliance_capped_off),
    customer_refused_isolation: parseBool(resolvedFields.customer_refused_isolation),
    classification: deriveClassification(resolvedFields.classification, resolvedFields.classification_code),
    unsafe_situation_description: resolvedFields.unsafe_situation_description ?? '',
    underlying_cause: resolvedFields.underlying_cause ?? '',
    actions_taken: resolvedFields.actions_taken ?? '',
    emergency_services_contacted: parseBool(resolvedFields.emergency_services_contacted),
    emergency_reference: resolvedFields.emergency_reference ?? '',
    danger_do_not_use_label_fitted: parseBool(resolvedFields.danger_do_not_use_label_fitted),
    meter_or_appliance_tagged: parseBool(resolvedFields.meter_or_appliance_tagged),
    riddor_11_1_reported: parseBool(resolvedFields.riddor_11_1_reported),
    riddor_11_2_reported: parseBool(resolvedFields.riddor_11_2_reported),
    customer_present: initialCustomerPresent,
    notice_left_on_premises: parseBool(resolvedFields.notice_left_on_premises) || (!initialCustomerPresent && parseBool(resolvedFields.customer_informed)),
    customer_informed: initialCustomerPresent ? parseBool(resolvedFields.customer_informed) : false,
    customer_understands_risks: initialCustomerPresent ? parseBool(resolvedFields.customer_understands_risks) : false,
    customer_signed_at: resolvedFields.customer_signed_at ? resolvedFields.customer_signed_at.slice(0, 10) : '',
    engineer_name: resolvedFields.engineer_name ?? '',
    engineer_company: resolvedFields.engineer_company ?? resolvedFields.company_name ?? '',
    gas_safe_number: resolvedFields.gas_safe_number ?? '',
    engineer_id_card_number: resolvedFields.engineer_id_card_number ?? resolvedFields.engineer_id ?? '',
    issued_at: resolvedFields.issued_at ? resolvedFields.issued_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
  });

  const [jobAddress, setJobAddress] = useState({
    job_reference: resolvedFields.job_reference ?? '',
    job_address_name: resolvedFields.job_address_name ?? '',
    job_address_line1: resolvedFields.job_address_line1 ?? resolvedFields.property_address ?? '',
    job_address_line2: resolvedFields.job_address_line2 ?? '',
    job_address_city: resolvedFields.job_address_city ?? '',
    job_postcode: resolvedFields.job_postcode ?? resolvedFields.postcode ?? '',
    job_tel: resolvedFields.job_tel ?? resolvedFields.job_phone ?? '',
  });

  const [engineerSignature, setEngineerSignature] = useState((resolvedFields.engineer_signature as string) ?? '');
  const [customerSignature, setCustomerSignature] = useState((resolvedFields.customer_signature as string) ?? '');
  const didPrefillRef = useRef(false);

  const gasWarningDraft = useMemo<GasWarningDraftState>(
    () => ({
      step,
      fields,
      jobAddress,
      engineerSignature,
      customerSignature,
    }),
    [customerSignature, engineerSignature, fields, jobAddress, step],
  );

  const { clearDraft } = useWizardDraft<GasWarningDraftState>({
    storageKey: draftStorageKey,
    state: gasWarningDraft,
    onRestore: (draft) => {
      setStep(Math.min(3, Math.max(1, draft.step || initialStep)));
      setFields((prev) => ({ ...prev, ...(draft.fields ?? {}) }));
      setJobAddress((prev) => ({ ...prev, ...(draft.jobAddress ?? {}) }));
      setEngineerSignature(draft.engineerSignature ?? '');
      setCustomerSignature(draft.customerSignature ?? '');
    },
  });

  useEffect(() => {
    if (didPrefillRef.current) return;
    didPrefillRef.current = true;

    const safeText = (value: string | null | undefined) => (typeof value === 'string' ? value.trim() : '');
    const primaryAppliance = initialAppliances[0];
    const cp12SafetyRating = safeText(primaryAppliance?.safety_rating);
    const cp12ClassificationCode = safeText(primaryAppliance?.classification_code);
    const cp12DefectDescription = safeText(resolvedFields.defect_description);
    const cp12RemedialAction = safeText(resolvedFields.remedial_action);

    setFields((prev) => {
      const next = { ...prev };
      if (!safeText(next.appliance_location) && primaryAppliance?.location) {
        next.appliance_location = primaryAppliance.location;
      }
      if (!safeText(next.appliance_type) && primaryAppliance?.appliance_type) {
        next.appliance_type = primaryAppliance.appliance_type;
      }
      if (!safeText(next.make_model) && primaryAppliance?.make_model) {
        next.make_model = primaryAppliance.make_model;
      }
      if (!safeText(next.classification)) {
        if (cp12SafetyRating === 'at risk') next.classification = 'AT_RISK';
        if (cp12SafetyRating === 'immediately dangerous') next.classification = 'IMMEDIATELY_DANGEROUS';
      }
      if (!safeText(next.classification) && cp12ClassificationCode) {
        next.classification = deriveClassification('', cp12ClassificationCode);
      }
      if (!safeText(next.unsafe_situation_description) && cp12DefectDescription) {
        next.unsafe_situation_description = cp12DefectDescription;
      }
      if (!safeText(next.actions_taken) && cp12RemedialAction) {
        next.actions_taken = cp12RemedialAction;
      }
      return next;
    });
  }, [initialAppliances, resolvedFields]);

  const previousClassificationRef = useRef<GasWarningClassification | ''>(fields.classification);

  useEffect(() => {
    if (fields.classification === 'IMMEDIATELY_DANGEROUS' && previousClassificationRef.current !== 'IMMEDIATELY_DANGEROUS') {
      setFields((prev) => ({
        ...prev,
        danger_do_not_use_label_fitted: true,
        gas_supply_isolated: prev.customer_refused_isolation ? prev.gas_supply_isolated : true,
        appliance_capped_off: prev.customer_refused_isolation ? prev.appliance_capped_off : true,
      }));
    }

    previousClassificationRef.current = fields.classification;
  }, [fields.classification]);

  const handleDemoFill = () => {
    if (!demoEnabled) return;
    const today = new Date().toISOString().slice(0, 10);
    const demo: GasWarningFormState = {
      property_address: '12 High Street, Leyton',
      postcode: 'E10 6AA',
      customer_name: 'Jamie Collins',
      customer_contact: '07123 456789',
      customer_company: 'Leyton Lettings Ltd',
      customer_address_line1: 'Flat 2',
      customer_address_line2: '12 High Street',
      customer_city: 'Leyton',
      customer_address: 'Flat 2\n12 High Street\nLeyton',
      customer_postcode: 'E10 6AA',
      appliance_location: 'Kitchen cupboard',
      appliance_type: 'Combi boiler',
      make_model: 'Worcester Bosch Greenstar 30i',
      serial_number: 'WB30I-84736291',
      gas_escape_issue: false,
      pipework_issue: false,
      ventilation_issue: false,
      meter_issue: false,
      chimney_flue_issue: true,
      other_issue: false,
      other_issue_details: '',
      gas_supply_isolated: true,
      appliance_capped_off: false,
      customer_refused_isolation: false,
      classification: 'AT_RISK',
      unsafe_situation_description: 'Flue seal degraded causing minor spillage risk.',
      underlying_cause: 'Flue seal deterioration.',
      actions_taken: 'Isolated appliance and advised replacement seal.',
      emergency_services_contacted: false,
      emergency_reference: '',
      danger_do_not_use_label_fitted: true,
      meter_or_appliance_tagged: true,
      riddor_11_1_reported: false,
      riddor_11_2_reported: false,
      customer_present: true,
      notice_left_on_premises: false,
      customer_informed: true,
      customer_understands_risks: true,
      customer_signed_at: today,
      engineer_name: 'Alex Turner',
      engineer_company: 'CertNow Heating',
      gas_safe_number: '123456',
      engineer_id_card_number: 'GS-987654',
      issued_at: today,
    };
    setFields(demo);
    setJobAddress((prev) => ({
      ...prev,
      job_reference: 'GW-2401',
      job_address_name: '',
      job_address_line1: demo.property_address,
      job_address_line2: '',
      job_address_city: 'London',
      job_postcode: demo.postcode,
      job_tel: demo.customer_contact,
    }));
    pushToast({ title: 'Gas Warning demo filled', variant: 'success' });
  };

  const buildDetailsPayload = () => ({
    appliance_location: fields.appliance_location,
    appliance_type: fields.appliance_type,
    make_model: fields.make_model,
    serial_number: fields.serial_number,
    gas_escape_issue: fields.gas_escape_issue,
    pipework_issue: fields.pipework_issue,
    ventilation_issue: fields.ventilation_issue,
    meter_issue: fields.meter_issue,
    chimney_flue_issue: fields.chimney_flue_issue,
    other_issue: fields.other_issue,
    other_issue_details: fields.other_issue ? fields.other_issue_details : '',
    gas_supply_isolated: fields.gas_supply_isolated,
    appliance_capped_off: fields.appliance_capped_off,
    customer_refused_isolation: fields.customer_refused_isolation,
    classification: fields.classification,
    classification_code: getClassificationCode(fields.classification),
    unsafe_situation_description: fields.unsafe_situation_description,
    underlying_cause: fields.underlying_cause,
    actions_taken: fields.actions_taken,
    emergency_services_contacted: fields.emergency_services_contacted,
    emergency_reference: fields.emergency_reference,
    danger_do_not_use_label_fitted: fields.danger_do_not_use_label_fitted,
    meter_or_appliance_tagged: fields.meter_or_appliance_tagged,
    riddor_11_1_reported: fields.riddor_11_1_reported,
    riddor_11_2_reported: fields.riddor_11_2_reported,
    customer_present: fields.customer_present,
    notice_left_on_premises: fields.customer_present ? false : fields.notice_left_on_premises,
    customer_informed: fields.customer_present ? fields.customer_informed : fields.notice_left_on_premises,
    customer_understands_risks: fields.customer_present ? fields.customer_understands_risks : false,
    customer_signed_at: fields.customer_present ? fields.customer_signed_at : '',
    ...(fields.engineer_name.trim() ? { engineer_name: fields.engineer_name } : {}),
    ...(fields.engineer_company.trim() ? { engineer_company: fields.engineer_company } : {}),
    ...(fields.gas_safe_number.trim() ? { gas_safe_number: fields.gas_safe_number } : {}),
    ...(fields.engineer_id_card_number.trim() ? { engineer_id_card_number: fields.engineer_id_card_number } : {}),
    issued_at: fields.issued_at,
  });

  const buildGenerateFields = () => {
    const {
      engineer_name: engineerName,
      engineer_company: engineerCompany,
      gas_safe_number: gasSafeNumber,
      engineer_id_card_number: engineerIdCardNumber,
      ...rest
    } = fields;

    return {
      ...rest,
      ...(engineerName.trim() ? { engineer_name: engineerName } : {}),
      ...(engineerCompany.trim() ? { engineer_company: engineerCompany } : {}),
      ...(gasSafeNumber.trim() ? { gas_safe_number: gasSafeNumber } : {}),
      ...(engineerIdCardNumber.trim() ? { engineer_id_card_number: engineerIdCardNumber } : {}),
    };
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
            description: error instanceof Error ? error.message : 'Please try again.',
            variant: 'error',
          });
        }
      });
    };

  const handleJobNext = () => {
    startTransition(async () => {
      try {
        await saveGasWarningJobInfo({
          jobId,
          data: {
            property_address: fields.property_address,
            postcode: fields.postcode,
            customer_name: fields.customer_name,
            customer_contact: fields.customer_contact,
            customer_company: fields.customer_company,
            customer_address_line1: fields.customer_address_line1,
            customer_address_line2: fields.customer_address_line2,
            customer_city: fields.customer_city,
            customer_address: buildAddressText(fields.customer_address_line1, fields.customer_address_line2, fields.customer_city),
            customer_postcode: fields.customer_postcode,
            job_reference: jobAddress.job_reference,
            job_address_name: jobAddress.job_address_name,
            job_address_line1: jobAddress.job_address_line1,
            job_address_line2: jobAddress.job_address_line2,
            job_address_city: jobAddress.job_address_city,
            job_postcode: jobAddress.job_postcode,
            job_tel: jobAddress.job_tel,
          },
        });
        setStep(2);
        pushToast({ title: 'Saved job details', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Could not save job details',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleApplianceNext = () => {
    startTransition(async () => {
      try {
        await saveGasWarningDetails({
          jobId,
          data: buildDetailsPayload(),
        });
        setStep(3);
        pushToast({ title: 'Saved appliance + actions', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Could not save appliance details',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleAcknowledgementNext = () => {
    startTransition(async () => {
      try {
        await saveGasWarningDetails({
          jobId,
          data: buildDetailsPayload(),
        });
        pushToast({ title: 'Saved handover details', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Could not save acknowledgement',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const persistAll = async () => {
    await saveGasWarningJobInfo({
      jobId,
      data: {
        property_address: fields.property_address,
        postcode: fields.postcode,
        customer_name: fields.customer_name,
        customer_contact: fields.customer_contact,
        customer_company: fields.customer_company,
        customer_address_line1: fields.customer_address_line1,
        customer_address_line2: fields.customer_address_line2,
        customer_city: fields.customer_city,
        customer_address: buildAddressText(fields.customer_address_line1, fields.customer_address_line2, fields.customer_city),
        customer_postcode: fields.customer_postcode,
        job_reference: jobAddress.job_reference,
        job_address_name: jobAddress.job_address_name,
        job_address_line1: jobAddress.job_address_line1,
        job_address_line2: jobAddress.job_address_line2,
        job_address_city: jobAddress.job_address_city,
        job_postcode: jobAddress.job_postcode,
        job_tel: jobAddress.job_tel,
      },
    });
    await saveGasWarningDetails({
      jobId,
      data: buildDetailsPayload(),
    });
  };

  const goBackOneStep = () => setStep((prev) => Math.max(1, prev - 1));

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        await persistAll();
        const { jobId: resultJobId } = await generateCertificatePdf({
          jobId,
          certificateType,
          previewOnly: false,
          fields: buildGenerateFields(),
        });
        clearDraft();
        pushToast({
          title: 'Gas Warning Notice generated successfully',
          description: (
            <Link href={`/jobs/${resultJobId}/pdf?certificateType=${certificateType}`} className="text-[var(--action)] underline">
              Open document preview
            </Link>
          ),
          variant: 'success',
        });
        router.push(`/jobs/${resultJobId}/pdf?certificateType=${certificateType}`);
      } catch (error) {
        pushToast({
          title: 'Could not generate PDF',
          description: error instanceof Error ? error.message : 'Please check required fields and try again.',
          variant: 'error',
        });
      }
    });
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
          const { url } = await uploadSignature(data);
          if (role === 'engineer') setEngineerSignature(url);
          if (role === 'customer') setCustomerSignature(url);
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

  const showOtherIssueDetails = fields.other_issue;
  const showCustomerAcknowledgement = fields.customer_present;
  const showNoticeLeftOnPremises = !fields.customer_present;

  return (
    <>
      {step === 1 ? (
        <WizardLayout
          step={offsetStep(1)}
          total={totalSteps}
          title="People & location"
          status="Gas Warning Notice"
          actions={
            <div className="flex justify-end">
              <Button className="rounded-full px-6" onClick={handleJobNext} disabled={isPending}>
                Next → Appliance
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
          {demoEnabled ? (
            <div className="mb-3 flex justify-end">
              <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
                Fill demo Gas Warning
              </Button>
            </div>
          ) : null}
          <p className="text-sm text-muted">Engineer and company details are pulled from account settings.</p>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
              <p className="text-sm font-semibold text-muted">Job address</p>
              <p className="mt-1 text-xs text-muted-foreground/70">Confirm the job address and visit details.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <LabeledField label="Job reference" className="sm:col-span-2">
                  <Input
                    value={jobAddress.job_reference}
                    onChange={(e) => setJobAddress((prev) => ({ ...prev, job_reference: e.target.value }))}
                    placeholder="Optional internal reference"
                    className="rounded-2xl"
                  />
                </LabeledField>
                <LabeledField label="Name" className="sm:col-span-2">
                  <Input
                    value={jobAddress.job_address_name}
                    onChange={(e) => setJobAddress((prev) => ({ ...prev, job_address_name: e.target.value }))}
                    placeholder="Property name / reference"
                    className="rounded-2xl"
                  />
                </LabeledField>
                <LabeledField label="Address line 1" className="sm:col-span-2">
                  <Input
                    value={jobAddress.job_address_line1}
                    onChange={(e) => {
                      const value = e.target.value;
                      setJobAddress((prev) => ({ ...prev, job_address_line1: value }));
                      setFields((prev) => ({ ...prev, property_address: value }));
                    }}
                    placeholder="Job address line 1"
                    className="rounded-2xl"
                  />
                </LabeledField>
                <LabeledField label="Address line 2">
                  <Input
                    value={jobAddress.job_address_line2}
                    onChange={(e) => setJobAddress((prev) => ({ ...prev, job_address_line2: e.target.value }))}
                    placeholder="Optional"
                    className="rounded-2xl"
                  />
                </LabeledField>
                <LabeledField label="Town / city">
                  <Input
                    value={jobAddress.job_address_city}
                    onChange={(e) => setJobAddress((prev) => ({ ...prev, job_address_city: e.target.value }))}
                    placeholder="Optional"
                    className="rounded-2xl"
                  />
                </LabeledField>
                <LabeledField label="Postcode">
                  <Input
                    value={jobAddress.job_postcode}
                    onChange={(e) => {
                      const value = e.target.value;
                      setJobAddress((prev) => ({ ...prev, job_postcode: value }));
                      setFields((prev) => ({ ...prev, postcode: value }));
                    }}
                    placeholder="Postcode"
                    className="rounded-2xl"
                  />
                </LabeledField>
                <LabeledField label="Tel. No">
                  <Input
                    value={jobAddress.job_tel}
                    onChange={(e) => setJobAddress((prev) => ({ ...prev, job_tel: e.target.value }))}
                    placeholder="Site telephone number"
                    className="rounded-2xl"
                  />
                </LabeledField>
              </div>
            </div>
            <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
              <p className="text-sm font-semibold text-muted">Client / Landlord</p>
              <p className="mt-1 text-xs text-muted-foreground/70">Capture the person or organisation receiving the notice.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <LabeledField label="Name">
                  <Input
                    value={fields.customer_name}
                    onChange={(e) => setFields((prev) => ({ ...prev, customer_name: e.target.value }))}
                    placeholder="Client / landlord name"
                    className="rounded-2xl"
                  />
                </LabeledField>
                <LabeledField label="Company">
                  <Input
                    value={fields.customer_company}
                    onChange={(e) => setFields((prev) => ({ ...prev, customer_company: e.target.value }))}
                    placeholder="Optional"
                    className="rounded-2xl"
                  />
                </LabeledField>
                <LabeledField label="Address line 1" className="sm:col-span-2">
                  <Input
                    value={fields.customer_address_line1}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFields((prev) => ({
                        ...prev,
                        customer_address_line1: value,
                        customer_address: buildAddressText(value, prev.customer_address_line2, prev.customer_city),
                      }));
                    }}
                    placeholder="Client / landlord address line 1"
                    className="rounded-2xl"
                  />
                </LabeledField>
                <LabeledField label="Address line 2">
                  <Input
                    value={fields.customer_address_line2}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFields((prev) => ({
                        ...prev,
                        customer_address_line2: value,
                        customer_address: buildAddressText(prev.customer_address_line1, value, prev.customer_city),
                      }));
                    }}
                    placeholder="Optional"
                    className="rounded-2xl"
                  />
                </LabeledField>
                <LabeledField label="Town / city">
                  <Input
                    value={fields.customer_city}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFields((prev) => ({
                        ...prev,
                        customer_city: value,
                        customer_address: buildAddressText(prev.customer_address_line1, prev.customer_address_line2, value),
                      }));
                    }}
                    placeholder="Optional"
                    className="rounded-2xl"
                  />
                </LabeledField>
                <LabeledField label="Postcode">
                  <Input
                    value={fields.customer_postcode}
                    onChange={(e) => setFields((prev) => ({ ...prev, customer_postcode: e.target.value }))}
                    placeholder="Postcode"
                    className="rounded-2xl"
                  />
                </LabeledField>
                <LabeledField label="Tel. No">
                  <Input
                    value={fields.customer_contact}
                    onChange={(e) => setFields((prev) => ({ ...prev, customer_contact: e.target.value }))}
                    placeholder="Client / landlord contact number"
                    className="rounded-2xl"
                  />
                </LabeledField>
              </div>
            </div>
          </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button className="rounded-full px-6" onClick={handleJobNext} disabled={isPending}>
              Next → Appliance
            </Button>
          </div>
        </WizardLayout>
      ) : null}

      {step === 2 ? (
        <WizardLayout
          step={offsetStep(2)}
          total={totalSteps}
          title="Appliance + classification"
          status="Gas Warning"
          onBack={goBackOneStep}
          actions={
            <div className="flex justify-end">
              <Button className="rounded-full px-6" onClick={handleApplianceNext} disabled={isPending}>
                Next → Sign-off
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
          {demoEnabled ? (
            <div className="mb-3 flex justify-end">
              <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
                Fill demo Gas Warning
              </Button>
            </div>
          ) : null}
          <CollapsibleSection title="Appliance & classification" subtitle="Capture appliance and risk">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={fields.appliance_location}
                onChange={(e) => setFields((prev) => ({ ...prev, appliance_location: e.target.value }))}
                placeholder="Appliance location"
                className="rounded-2xl"
              />
              <Input
                value={fields.appliance_type}
                onChange={(e) => setFields((prev) => ({ ...prev, appliance_type: e.target.value }))}
                placeholder="Appliance type"
                className="rounded-2xl"
              />
              <Input
                value={fields.make_model}
                onChange={(e) => setFields((prev) => ({ ...prev, make_model: e.target.value }))}
                placeholder="Make / model (optional)"
                className="rounded-2xl sm:col-span-2"
              />
              <Input
                value={fields.serial_number}
                onChange={(e) => setFields((prev) => ({ ...prev, serial_number: e.target.value }))}
                placeholder="Serial number"
                className="rounded-2xl sm:col-span-2"
              />
              <LabeledField label="Classification" className="sm:col-span-2">
                <Select
                  value={fields.classification}
                  onChange={(e) => setFields((prev) => ({ ...prev, classification: e.target.value as GasWarningClassification }))}
                >
                  <option value="">Select classification</option>
                  {GAS_WARNING_CLASSIFICATIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </LabeledField>
              <Textarea
                value={fields.unsafe_situation_description}
                onChange={(e) => setFields((prev) => ({ ...prev, unsafe_situation_description: e.target.value }))}
                placeholder="Unsafe situation description"
                className="min-h-[90px] rounded-2xl sm:col-span-2"
              />
              <Textarea
                value={fields.underlying_cause}
                onChange={(e) => setFields((prev) => ({ ...prev, underlying_cause: e.target.value }))}
                placeholder="Underlying cause (optional)"
                className="min-h-[90px] rounded-2xl sm:col-span-2"
              />
              <Textarea
                value={fields.actions_taken}
                onChange={(e) => setFields((prev) => ({ ...prev, actions_taken: e.target.value }))}
                placeholder="Actions taken"
                className="min-h-[90px] rounded-2xl sm:col-span-2"
              />
              <Input
                value={fields.emergency_reference}
                onChange={(e) => setFields((prev) => ({ ...prev, emergency_reference: e.target.value }))}
                placeholder="Emergency reference (optional)"
                className="rounded-2xl sm:col-span-2"
              />
            </div>
          </CollapsibleSection>
          <CollapsibleSection title="Safety actions" subtitle="Isolation, tagging, and emergency actions">
            <div className="space-y-2 rounded-2xl border border-white/40 bg-white/70 p-4">
              {[
                ['gas_supply_isolated', 'Gas supply isolated'],
                ['appliance_capped_off', 'Appliance capped off'],
                ['customer_refused_isolation', 'Customer refused isolation'],
                ['emergency_services_contacted', 'Emergency services contacted'],
                ['danger_do_not_use_label_fitted', "Danger: Do Not Use label fitted"],
                ['meter_or_appliance_tagged', 'Meter or appliance tagged'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 text-sm text-muted">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--accent)]"
                    checked={fields[key as keyof GasWarningFormState] as boolean}
                    onChange={(e) =>
                      setFields((prev) => ({ ...prev, [key]: e.target.checked } as GasWarningFormState))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </CollapsibleSection>
          <CollapsibleSection title="RIDDOR reporting" subtitle="Record whether the incident was reported to HSE">
            <div className="space-y-2 rounded-2xl border border-white/40 bg-white/70 p-4">
              {[
                ['riddor_11_1_reported', 'Reported to HSE under RIDDOR 11(1) (Gas Incident)'],
                ['riddor_11_2_reported', 'Reported to HSE under RIDDOR 11(2) (Dangerous Gas Fitting)'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 text-sm text-muted">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--accent)]"
                    checked={fields[key as keyof GasWarningFormState] as boolean}
                    onChange={(e) =>
                      setFields((prev) => ({ ...prev, [key]: e.target.checked } as GasWarningFormState))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </CollapsibleSection>
          <CollapsibleSection title="Issue categories" subtitle="Match the notice to the identified issue">
            <div className="space-y-3 rounded-2xl border border-white/40 bg-white/70 p-4">
              {[
                ['gas_escape_issue', 'Gas escape'],
                ['pipework_issue', 'Pipework issue'],
                ['ventilation_issue', 'Ventilation issue'],
                ['meter_issue', 'Meter issue'],
                ['chimney_flue_issue', 'Chimney / flue issue'],
                ['other_issue', 'Other issue'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 text-sm text-muted">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--accent)]"
                    checked={fields[key as keyof GasWarningFormState] as boolean}
                    onChange={(e) =>
                      setFields((prev) =>
                        ({
                          ...prev,
                          [key]: e.target.checked,
                          ...(key === 'other_issue' && !e.target.checked ? { other_issue_details: '' } : {}),
                        }) as GasWarningFormState,
                      )
                    }
                  />
                  {label}
                </label>
              ))}
              {showOtherIssueDetails ? (
                <Input
                  value={fields.other_issue_details}
                  onChange={(e) => setFields((prev) => ({ ...prev, other_issue_details: e.target.value }))}
                  placeholder="Other issue details"
                  className="rounded-2xl"
                />
              ) : null}
            </div>
          </CollapsibleSection>
          </div>
          <div className="mt-6 flex justify-end">
            <Button className="rounded-full px-6" onClick={handleApplianceNext} disabled={isPending}>
              Next → Sign-off
            </Button>
          </div>
        </WizardLayout>
      ) : null}

      {step === 3 ? (
        <WizardLayout
          step={offsetStep(3)}
          total={totalSteps}
          title="Handover + signatures"
          status="Gas Warning"
          onBack={goBackOneStep}
          actions={
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button className="rounded-full bg-[var(--action)] px-6 text-white" onClick={handleGenerate} disabled={isPending}>
                Generate PDF
              </Button>
              <Button variant="ghost" className="rounded-full px-6" onClick={handleAcknowledgementNext} disabled={isPending}>
                Save draft
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
          {demoEnabled ? (
            <div className="mb-3 flex justify-end">
              <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
                Fill demo Gas Warning
              </Button>
            </div>
          ) : null}
          <CollapsibleSection title="Evidence photos" subtitle="Optional attachments">
            <div className="grid gap-3 sm:grid-cols-2">
              {FINAL_EVIDENCE_CATEGORIES.map((item) => (
                <EvidenceCard
                  key={item.key}
                  title={item.label}
                  fields={[]}
                  values={{}}
                  onChange={() => null}
                  onPhotoUpload={handleEvidenceUpload(item.key)}
                />
              ))}
            </div>
          </CollapsibleSection>
          <CollapsibleSection title="Attendance & handover" subtitle="Record whether the customer was present" defaultOpen>
            <div className="space-y-3 rounded-2xl border border-white/40 bg-white/70 p-4">
              <label className="flex items-center gap-3 text-sm text-muted">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--accent)]"
                  checked={fields.customer_present}
                  onChange={(e) =>
                    setFields((prev) => ({
                      ...prev,
                      customer_present: e.target.checked,
                      notice_left_on_premises: e.target.checked ? false : prev.notice_left_on_premises,
                    }))
                  }
                />
                Customer present at time of warning notice
              </label>

              {showCustomerAcknowledgement ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 rounded-2xl border border-white/40 bg-white/80 p-4 sm:col-span-2">
                    {[
                      ['customer_informed', 'Customer informed'],
                      ['customer_understands_risks', 'Customer understands risks'],
                    ].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-3 text-sm text-muted">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--accent)]"
                          checked={fields[key as keyof GasWarningFormState] as boolean}
                          onChange={(e) =>
                            setFields((prev) => ({ ...prev, [key]: e.target.checked } as GasWarningFormState))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <LabeledField label="Customer signed date" className="sm:col-span-1">
                    <Input
                      type="date"
                      value={fields.customer_signed_at}
                      onChange={(e) => setFields((prev) => ({ ...prev, customer_signed_at: e.target.value }))}
                      className="rounded-2xl"
                    />
                  </LabeledField>
                </div>
              ) : null}

              {showNoticeLeftOnPremises ? (
                <label className="flex items-center gap-3 text-sm text-muted">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--accent)]"
                    checked={fields.notice_left_on_premises}
                    onChange={(e) => setFields((prev) => ({ ...prev, notice_left_on_premises: e.target.checked }))}
                  />
                  Notice left on premises
                </label>
              ) : null}
            </div>
          </CollapsibleSection>
          <CollapsibleSection title="Notice details" subtitle="Engineer details come from account settings">
            <div className="grid gap-3 sm:grid-cols-2">
              <LabeledField label="Issue date">
                <Input
                  type="date"
                  value={fields.issued_at}
                  onChange={(e) => setFields((prev) => ({ ...prev, issued_at: e.target.value }))}
                  className="rounded-2xl"
                />
              </LabeledField>
            </div>
          </CollapsibleSection>
          <CollapsibleSection title="Signatures" subtitle="Customer + engineer">
            <div className={`grid gap-4 ${showCustomerAcknowledgement ? 'sm:grid-cols-2' : ''}`}>
              {showCustomerAcknowledgement ? (
                <SignatureCard label="Customer" existingUrl={customerSignature} onUpload={signatureUpload('customer')} />
              ) : (
                <div className="rounded-2xl border border-dashed border-white/30 bg-white/40 p-4 text-sm text-muted-foreground/80">
                  Customer signature hidden because the customer was marked as not present.
                </div>
              )}
              <SignatureCard label="Engineer" existingUrl={engineerSignature} onUpload={signatureUpload('engineer')} />
            </div>
          </CollapsibleSection>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button className="rounded-full bg-[var(--action)] px-6 text-white" onClick={handleGenerate} disabled={isPending}>
              Generate PDF
            </Button>
            <Button variant="ghost" className="rounded-full px-6" onClick={handleAcknowledgementNext} disabled={isPending}>
              Save draft
            </Button>
          </div>
        </WizardLayout>
      ) : null}
    </>
  );
}
