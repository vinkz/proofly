'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';

import { WizardLayout } from '@/components/certificates/wizard-layout';
import { EvidenceCard } from './evidence-card';
import { SignatureCard } from '@/components/certificates/signature-card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { CollapsibleSection } from '@/components/wizard/layout/collapsible-section';
import { ApplianceStep, type ApplianceStepValues } from '@/components/wizard/steps/appliance-step';
import { FgaAutofillInline } from '@/components/fga/FgaAutofillInline';
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

type BoilerServiceDraftState = {
  step: number;
  completionDate: string;
  jobInfo: BoilerServiceJobInfo;
  jobAddress: BoilerServiceJobAddress;
  details: BoilerServiceDetails;
  checks: BoilerServiceChecks;
  engineerSignature: string;
  customerSignature: string;
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
  flue_gas_temp_c: '',
  system_pressure_bar: '',
  appliance_conforms_standards: '',
  cylinder_condition_checked: '',
  co_alarm_fitted: '',
  all_functional_parts_available: '',
  warm_air_grills_working: '',
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
  const resolvedFields = mergeJobContextFields(initialFields, initialJobContext);
  const fgaApplianceId = typeof resolvedFields.appliance_id === 'string' ? resolvedFields.appliance_id : null;
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
  });

  const [engineerSignature, setEngineerSignature] = useState((resolvedFields.engineer_signature as string) ?? '');
  const [customerSignature, setCustomerSignature] = useState((resolvedFields.customer_signature as string) ?? '');
  const demoEnabled = false;
  const totalSteps = 4 + stepOffset;
  const offsetStep = (step: number) => step + stepOffset;
  const draftStorageKey = useMemo(() => buildWizardDraftStorageKey('gas_service', jobId), [jobId]);

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
      engineerSignature,
      customerSignature,
    }),
    [checks, completionDate, customerSignature, details, engineerSignature, jobAddress, jobInfo, step],
  );

  const { clearDraft } = useWizardDraft<BoilerServiceDraftState>({
    storageKey: draftStorageKey,
    state: boilerServiceDraft,
    onRestore: (draft) => {
      setStep(Math.min(4, Math.max(1, draft.step || initialStep)));
      setCompletionDate(draft.completionDate || completionDate);
      setJobInfo((prev) => ({ ...prev, ...(draft.jobInfo ?? {}) }));
      setJobAddress((prev) => ({ ...prev, ...(draft.jobAddress ?? {}) }));
      setDetails((prev) => ({ ...prev, ...(draft.details ?? {}) }));
      setChecks((prev) => ({ ...prev, ...(draft.checks ?? {}) }));
      setEngineerSignature(draft.engineerSignature ?? '');
      setCustomerSignature(draft.customerSignature ?? '');
    },
  });
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
        const nextServiceDue = checks.next_service_due || `${new Date().getFullYear() + 1}-01-15`;
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

  const handleJobInfoNext = () => {
    startTransition(async () => {
      try {
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
        await saveBoilerServiceJobInfo({ jobId, data: nextInfo });
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
          },
        });
        setJobInfo(nextInfo);
        setStep(2);
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
        await saveBoilerServiceDetails({ jobId, data: details });
        setStep(3);
        pushToast({ title: 'Saved boiler details', variant: 'success' });
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
    startTransition(async () => {
      try {
        await saveBoilerServiceChecks({ jobId, data: checks });
        setStep(4);
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
      },
    });
    await saveBoilerServiceDetails({ jobId, data: details });
    await saveBoilerServiceChecks({ jobId, data: checks });
  };

  const goBackOneStep = () => setStep((prev) => Math.max(1, prev - 1));

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        await persistBeforePdf();
        const finalInfo = { ...jobInfo, service_date: completionDate || jobInfo.service_date };
        await saveBoilerServiceJobInfo({ jobId, data: finalInfo });
        const { jobId: resultJobId } = await generateGasServicePdf({ jobId, previewOnly: false });
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
        router.push(`/jobs/${resultJobId}/pdf?certificateType=gas_service`);
      } catch (error) {
        pushToast({
          title: 'Could not generate PDF',
          description: error instanceof Error ? error.message : 'Please check required fields and try again.',
          variant: 'error',
        });
      }
    });
  };

  const setCheckValue = (key: keyof BoilerServiceChecks, value: string) => {
    setChecks((prev) => ({ ...prev, [key]: value }));
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

  const checkItems: Array<{ key: keyof BoilerServiceChecks; label: string }> = [
    { key: 'service_visual_inspection', label: 'Visual inspection' },
    { key: 'service_burner_cleaned', label: 'Burner cleaned' },
    { key: 'service_heat_exchanger_cleaned', label: 'Heat exchanger cleaned' },
    { key: 'service_condensate_trap_checked', label: 'Condensate trap checked' },
    { key: 'service_seals_checked', label: 'Seals checked' },
    { key: 'service_filters_cleaned', label: 'Filters cleaned' },
    { key: 'service_flue_checked', label: 'Flue checked' },
    { key: 'service_ventilation_checked', label: 'Ventilation checked' },
    { key: 'service_controls_checked', label: 'Controls checked' },
    { key: 'service_leaks_checked', label: 'Leaks checked' },
  ];
  const additionalTemplateChecks: Array<{ key: keyof BoilerServiceChecks; label: string }> = [
    { key: 'appliance_conforms_standards', label: 'Appliance conforms to standards' },
    { key: 'cylinder_condition_checked', label: 'Cylinder condition checked' },
    { key: 'co_alarm_fitted', label: 'CO alarm fitted' },
    { key: 'all_functional_parts_available', label: 'All functional parts available' },
    { key: 'warm_air_grills_working', label: 'Warm air grills working' },
    { key: 'magnetic_filter_fitted', label: 'Magnetic filter fitted' },
    { key: 'water_quality_acceptable', label: 'Water quality acceptable' },
    { key: 'warning_notice_explained', label: 'Warning notice explained' },
    { key: 'appliance_replacement_recommended', label: 'Appliance replacement recommended' },
    { key: 'system_improvements_recommended', label: 'System improvements recommended' },
  ];
  const hasValue = (value: string) => value.trim().length > 0;
  const readingsFields: Array<keyof BoilerServiceChecks> = [
    'operating_pressure_mbar',
    'inlet_pressure_mbar',
    'heat_input',
    'co_ppm',
    'co2_percent',
    'flue_gas_temp_c',
    'system_pressure_bar',
  ];
  const checksCompleted = checkItems.filter((item) => hasValue(checks[item.key] ?? '')).length;
  const templateChecksCompleted = additionalTemplateChecks.filter((item) => hasValue(checks[item.key] ?? '')).length;
  const readingsCompleted = readingsFields.filter((key) => hasValue(checks[key] ?? '')).length;
  const summaryComplete = hasValue(checks.service_summary) && hasValue(checks.recommendations);
  const defectsActive = (checks.defects_found ?? '') === 'yes';
  const defectsComplete = !defectsActive || hasValue(checks.defects_details ?? '');
  const nextServiceComplete = hasValue(checks.next_service_due ?? '');
  const sectionOrder = [
    { key: 'checks', complete: checksCompleted === checkItems.length },
    { key: 'template', complete: templateChecksCompleted === additionalTemplateChecks.length },
    { key: 'readings', complete: readingsCompleted === readingsFields.length },
    { key: 'summary', complete: summaryComplete },
    { key: 'defects', complete: defectsComplete },
    { key: 'next', complete: nextServiceComplete },
  ];
  const firstIncompleteKey = sectionOrder.find((section) => !section.complete)?.key ?? 'checks';

  return (
    <>
      {step === 1 ? (
        <WizardLayout
          step={offsetStep(1)}
          total={totalSteps}
          title="Job Address & Client"
          status="Visit details"
          actions={
            <div className="flex justify-end">
              <Button className="rounded-full px-6" onClick={handleJobInfoNext} disabled={isPending}>
                Next → Boiler details
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {demoEnabled ? (
              <div className="flex justify-end">
                <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
                  Autofill test Boiler Service
                </Button>
              </div>
            ) : null}
            <Card className="border border-white/10">
              <CardHeader>
                <CardTitle className="text-lg text-muted">Job Address</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                    Service date
                  </label>
                  <Input
                    type="date"
                    value={jobAddress.job_visit_date || jobInfo.service_date}
                    onChange={(e) => {
                      const value = e.target.value;
                      setJobAddress((prev) => ({ ...prev, job_visit_date: value }));
                      setJobInfo((prev) => ({ ...prev, service_date: value }));
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                    Property name / reference
                  </label>
                  <Input
                    value={jobAddress.job_address_name}
                    onChange={(e) => setJobAddress((prev) => ({ ...prev, job_address_name: e.target.value }))}
                    placeholder="Boiler room"
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                    Address line 1
                  </label>
                  <Input
                    value={jobAddress.job_address_line1}
                    onChange={(e) => setJobAddress((prev) => ({ ...prev, job_address_line1: e.target.value }))}
                    placeholder="123 High Street"
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                    Address line 2
                  </label>
                  <Input
                    value={jobAddress.job_address_line2}
                    onChange={(e) => setJobAddress((prev) => ({ ...prev, job_address_line2: e.target.value }))}
                    placeholder="Optional"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">City / town</label>
                  <Input
                    value={jobAddress.job_address_city}
                    onChange={(e) => setJobAddress((prev) => ({ ...prev, job_address_city: e.target.value }))}
                    placeholder="London"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Postcode</label>
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
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Site telephone</label>
                  <Input
                    value={jobAddress.job_tel}
                    onChange={(e) => setJobAddress((prev) => ({ ...prev, job_tel: e.target.value }))}
                    placeholder="020 7946 0958"
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>
            <Card className="border border-white/10">
              <CardHeader>
                <CardTitle className="text-lg text-muted">Client</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Name</label>
                  <Input
                    value={jobInfo.customer_name}
                    onChange={(e) => setJobInfo((prev) => ({ ...prev, customer_name: e.target.value }))}
                    placeholder="Client name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Company</label>
                  <Input
                    value={jobInfo.customer_company}
                    onChange={(e) => setJobInfo((prev) => ({ ...prev, customer_company: e.target.value }))}
                    placeholder="Optional"
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                    Address line 1
                  </label>
                  <Input
                    value={jobInfo.customer_address_line1}
                    onChange={(e) => setJobInfo((prev) => ({ ...prev, customer_address_line1: e.target.value }))}
                    placeholder="Address line 1"
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
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
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">City / town</label>
                  <Input
                    value={jobInfo.customer_city}
                    onChange={(e) => setJobInfo((prev) => ({ ...prev, customer_city: e.target.value }))}
                    placeholder="London"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Postcode</label>
                  <Input
                    value={jobInfo.customer_postcode}
                    onChange={(e) => setJobInfo((prev) => ({ ...prev, customer_postcode: e.target.value }))}
                    placeholder="SW1A 1AA"
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Tel. No.</label>
                  <Input
                    value={jobInfo.customer_phone}
                    onChange={(e) => setJobInfo((prev) => ({ ...prev, customer_phone: e.target.value }))}
                    placeholder="Optional"
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="mt-6 flex justify-end">
            <Button className="rounded-full px-6" onClick={handleJobInfoNext} disabled={isPending}>
              Next → Boiler details
            </Button>
          </div>
        </WizardLayout>
      ) : null}

      {step === 2 ? (
        <WizardLayout
          step={offsetStep(2)}
          total={totalSteps}
          title="Boiler details"
          status="Boiler profile"
          onBack={goBackOneStep}
          actions={
            <div className="flex justify-end">
              <Button className="rounded-full px-6" onClick={handleDetailsNext} disabled={isPending}>
                Next → Checks
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {demoEnabled ? (
              <div className="flex justify-end">
                <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
                  Autofill test Boiler Service
                </Button>
              </div>
            ) : null}
            <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
              <p className="text-sm font-semibold text-muted">Appliance profile</p>
              <div className="mt-3">
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
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button className="rounded-full px-6" onClick={handleDetailsNext} disabled={isPending}>
              Next → Checks
            </Button>
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
          actions={
            <div className="flex justify-end">
              <Button className="rounded-full px-6" onClick={handleChecksNext} disabled={isPending}>
                Next → Summary & Signatures
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
          {demoEnabled ? (
            <div className="mb-3 flex justify-end">
              <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
                Autofill test Boiler Service
              </Button>
            </div>
          ) : null}
          <CollapsibleSection
            title="Service checks"
            subtitle={`${checksCompleted}/${checkItems.length} complete`}
            defaultOpen={firstIncompleteKey === 'checks'}
          >
            <div className="space-y-2">
              {checkItems.map((item) => (
                <div
                  key={item.key}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/30 bg-white/80 px-3 py-2 shadow-sm"
                >
                  <p className="text-sm font-semibold text-muted">{item.label}</p>
                  <div className="flex gap-2">
                    {['yes', 'no'].map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => setCheckValue(item.key, choice)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          checks[item.key] === choice
                            ? 'bg-[var(--accent)] text-white'
                            : 'bg-[var(--muted)] text-gray-700'
                        }`}
                      >
                        {choice.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Additional template fields"
            subtitle={`${templateChecksCompleted}/${additionalTemplateChecks.length} complete`}
            defaultOpen={firstIncompleteKey === 'template'}
          >
            <div className="space-y-2">
              {additionalTemplateChecks.map((item) => (
                <div
                  key={item.key}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/30 bg-white/80 px-3 py-2 shadow-sm"
                >
                  <p className="text-sm font-semibold text-muted">{item.label}</p>
                  <div className="flex gap-2">
                    {['yes', 'no'].map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => setCheckValue(item.key, choice)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          checks[item.key] === choice
                            ? 'bg-[var(--accent)] text-white'
                            : 'bg-[var(--muted)] text-gray-700'
                        }`}
                      >
                        {choice.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Readings"
            subtitle={`${readingsCompleted}/${readingsFields.length} captured`}
            defaultOpen={firstIncompleteKey === 'readings'}
          >
            <div className="mb-3">
              <FgaAutofillInline
                jobId={jobId}
                applianceId={fgaApplianceId}
                readingSet="high"
                onApply={(values) => {
                  if (values.co_ppm !== undefined) setCheckValue('co_ppm', String(values.co_ppm));
                  if (values.co2_pct !== undefined) setCheckValue('co2_percent', String(values.co2_pct));
                  if (values.flue_temp_c !== undefined) setCheckValue('flue_gas_temp_c', String(values.flue_temp_c));
                }}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                value={checks.operating_pressure_mbar}
                onChange={(e) => setCheckValue('operating_pressure_mbar', e.target.value)}
                placeholder="Operating pressure (mbar)"
              />
              <Input
                value={checks.inlet_pressure_mbar}
                onChange={(e) => setCheckValue('inlet_pressure_mbar', e.target.value)}
                placeholder="Inlet pressure (mbar)"
              />
              <Input
                value={checks.heat_input}
                onChange={(e) => setCheckValue('heat_input', e.target.value)}
                placeholder="Heat input (kW)"
              />
              <Input
                value={checks.flue_gas_temp_c}
                onChange={(e) => setCheckValue('flue_gas_temp_c', e.target.value)}
                placeholder="Flue gas temp (°C)"
              />
              <Input value={checks.co_ppm} onChange={(e) => setCheckValue('co_ppm', e.target.value)} placeholder="CO (ppm)" />
              <Input value={checks.co2_percent} onChange={(e) => setCheckValue('co2_percent', e.target.value)} placeholder="CO₂ (%)" />
              <Input
                value={checks.system_pressure_bar}
                onChange={(e) => setCheckValue('system_pressure_bar', e.target.value)}
                placeholder="System pressure (bar)"
              />
            </div>
          </CollapsibleSection>

          </div>
          <div className="mt-6 flex justify-end">
            <Button className="rounded-full px-6" onClick={handleChecksNext} disabled={isPending}>
              Next → Summary & Signatures
            </Button>
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
          actions={
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button className="rounded-full bg-[var(--action)] px-6 text-white" onClick={handleGenerate} disabled={isPending}>
                {isPending ? 'Generating…' : 'Generate Boiler Service PDF'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {demoEnabled ? (
              <div className="flex justify-end">
                <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
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
                <div className="rounded-2xl border border-white/30 bg-white/80 p-3 shadow-sm">
                  <p className="text-sm font-semibold text-muted">Defects found?</p>
                  <div className="mt-2 flex gap-2">
                    {['yes', 'no'].map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => setCheckValue('defects_found', choice)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          checks.defects_found === choice ? 'bg-[var(--accent)] text-white' : 'bg-[var(--muted)] text-gray-700'
                        }`}
                      >
                        {choice.toUpperCase()}
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
                  <p className="text-xs text-muted-foreground/70">No defects recorded for this service.</p>
                )}
              </div>
            </CollapsibleSection>
            <CollapsibleSection
              title="Next service due"
              subtitle={checks.next_service_due ? checks.next_service_due : 'Set a reminder'}
              defaultOpen={firstIncompleteKey === 'next'}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={checks.next_service_due}
                  onChange={(e) => setCheckValue('next_service_due', e.target.value)}
                  placeholder="Next service due (date or note)"
                />
              </div>
            </CollapsibleSection>
            <div className="grid gap-4 sm:grid-cols-2">
              <SignatureCard label="Customer" existingUrl={customerSignature} onUpload={signatureUpload('customer')} />
              <SignatureCard label="Engineer" existingUrl={engineerSignature} onUpload={signatureUpload('engineer')} />
            </div>
            <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
              <p className="text-sm font-semibold text-muted">Completion</p>
              <Input
                type="date"
                value={completionDate}
                onChange={(e) => {
                  setCompletionDate(e.target.value);
                  setJobInfo((prev) => ({ ...prev, service_date: prev.service_date || e.target.value }));
                }}
                className="mt-2"
              />
            </div>
            <details className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
              <summary className="cursor-pointer text-sm font-semibold text-muted">Internal evidence (optional)</summary>
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
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button className="rounded-full bg-[var(--action)] px-6 text-white" onClick={handleGenerate} disabled={isPending}>
              {isPending ? 'Generating…' : 'Generate Boiler Service PDF'}
            </Button>
          </div>
        </WizardLayout>
      ) : null}
    </>
  );
}
