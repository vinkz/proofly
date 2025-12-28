'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { WizardLayout } from '@/components/certificates/wizard-layout';
import { EvidenceCard } from './evidence-card';
import { SignatureCard } from '@/components/certificates/signature-card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { CollapsibleSection } from '@/components/wizard/layout/collapsible-section';
import { ApplianceStep, type ApplianceStepValues } from '@/components/wizard/steps/appliance-step';
import { SearchableSelect } from '@/components/wizard/inputs/searchable-select';
import {
  BOILER_SERVICE_DEMO_INFO,
  BOILER_SERVICE_DEMO_DETAILS,
  BOILER_SERVICE_DEMO_CHECKS,
  BOILER_SERVICE_FLUE_TYPES,
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
import { mergeJobContextFields, type InitialJobContext } from './initial-job-context';

type BoilerServiceWizardProps = {
  jobId: string;
  initialFields: Record<string, string | null | undefined>;
  initialJobContext?: InitialJobContext | null;
  initialPhotoPreviews?: Record<string, string>;
  stepOffset?: number;
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
  co_ppm: '',
  co2_percent: '',
  flue_gas_temp_c: '',
  system_pressure_bar: '',
  service_summary: '',
  recommendations: '',
  defects_found: '',
  defects_details: '',
  parts_used: '',
  next_service_due: '',
};

const FINAL_EVIDENCE_CATEGORIES: Array<{ key: BoilerServicePhotoCategory; label: string }> = [
  { key: 'boiler', label: 'Boiler' },
  { key: 'flue', label: 'Flue' },
  { key: 'issue_defect', label: 'Issue/Defect' },
];

const BOILER_SERVICE_EVIDENCE_PHOTOS: Array<{ key: BoilerServicePhotoCategory; label: string }> = [
  { key: 'serial_label', label: 'Serial / Label' },
  { key: 'flue', label: 'Flue evidence' },
  { key: 'before_after', label: 'Before / After' },
  { key: 'issue_defect', label: 'Issue / Defect' },
];

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

export function BoilerServiceWizard({
  jobId,
  initialFields,
  initialJobContext = null,
  initialPhotoPreviews = {},
  stepOffset = 0,
}: BoilerServiceWizardProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const resolvedFields = mergeJobContextFields(initialFields, initialJobContext);

  const [completionDate, setCompletionDate] = useState(
    resolvedFields.completion_date ? resolvedFields.completion_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
  );

  const [jobInfo, setJobInfo] = useState<BoilerServiceJobInfo>({
    customer_name: resolvedFields.customer_name ?? '',
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

  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>(initialPhotoPreviews);
  const [engineerSignature, setEngineerSignature] = useState((resolvedFields.engineer_signature as string) ?? '');
  const [customerSignature, setCustomerSignature] = useState((resolvedFields.customer_signature as string) ?? '');
  const demoEnabled = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const totalSteps = 4 + stepOffset;
  const offsetStep = (step: number) => step + stepOffset;
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
        const demoInfo: typeof jobInfo = {
          ...jobInfo,
          ...BOILER_SERVICE_DEMO_INFO,
          service_date: BOILER_SERVICE_DEMO_INFO.service_date ?? today,
        };
        const demoDetails = { ...BOILER_SERVICE_DEMO_DETAILS };
        const demoChecks = { ...BOILER_SERVICE_DEMO_CHECKS };

        setJobInfo(demoInfo);
        setDetails(demoDetails);
        setChecks(demoChecks);

        await saveBoilerServiceJobInfo({ jobId, data: demoInfo });
        await saveBoilerServiceDetails({ jobId, data: demoDetails });
        await saveBoilerServiceChecks({ jobId, data: demoChecks });
        pushToast({ title: 'Boiler Service demo filled', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Could not fill demo data',
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

  const handleDetailsNext = () => {
    startTransition(async () => {
      try {
        await saveBoilerServiceDetails({ jobId, data: details });
        setStep(2);
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

  const handleJobAddressNext = () => {
    startTransition(async () => {
      try {
        const serviceDate = jobAddress.job_visit_date || jobInfo.service_date || completionDate;
        const nextInfo = {
          ...jobInfo,
          property_address: jobAddress.job_address_line1 || jobInfo.property_address,
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
        setStep(3);
        pushToast({ title: 'Saved job address', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Could not save job address',
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
    const infoToSave = { ...jobInfo, service_date: jobInfo.service_date || completionDate };
    await saveBoilerServiceJobInfo({ jobId, data: infoToSave });
    await saveBoilerServiceDetails({ jobId, data: details });
    await saveBoilerServiceChecks({ jobId, data: checks });
  };

  const handlePreview = () => {
    startTransition(async () => {
      try {
        await persistBeforePdf();
        const finalInfo = { ...jobInfo, service_date: jobInfo.service_date || completionDate };
        await saveBoilerServiceJobInfo({ jobId, data: finalInfo });
        const { pdfUrl } = await generateGasServicePdf({ jobId, previewOnly: true });
        pushToast({ title: 'Preview ready', variant: 'success' });
        router.push(`/jobs/${jobId}/pdf?url=${encodeURIComponent(pdfUrl)}&preview=1`);
      } catch (error) {
        pushToast({
          title: 'Could not preview',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        await persistBeforePdf();
        const finalInfo = { ...jobInfo, service_date: jobInfo.service_date || completionDate };
        await saveBoilerServiceJobInfo({ jobId, data: finalInfo });
        const { pdfUrl, jobId: resultJobId } = await generateGasServicePdf({ jobId, previewOnly: false });
        pushToast({
          title: 'Boiler Service generated successfully',
          description: pdfUrl ? (
            <Link href={pdfUrl} target="_blank" rel="noreferrer" className="text-[var(--action)] underline">
              View PDF
            </Link>
          ) : (
            'PDF ready. Open from the job detail.'
          ),
          variant: 'success',
        });
        router.push(`/jobs/${resultJobId}`);
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
  const hasValue = (value: string) => value.trim().length > 0;
  const readingsFields: Array<keyof BoilerServiceChecks> = [
    'operating_pressure_mbar',
    'inlet_pressure_mbar',
    'co_ppm',
    'co2_percent',
    'flue_gas_temp_c',
    'system_pressure_bar',
  ];
  const checksCompleted = checkItems.filter((item) => hasValue(checks[item.key] ?? '')).length;
  const readingsCompleted = readingsFields.filter((key) => hasValue(checks[key] ?? '')).length;
  const summaryComplete = hasValue(checks.service_summary) && hasValue(checks.recommendations);
  const defectsActive = (checks.defects_found ?? '') === 'yes';
  const defectsComplete = !defectsActive || hasValue(checks.defects_details ?? '');
  const nextServiceComplete = hasValue(checks.next_service_due ?? '');
  const sectionOrder = [
    { key: 'checks', complete: checksCompleted === checkItems.length },
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
          title="Appliance details"
          status="Boiler profile"
        >
          <div className="space-y-4">
            {demoEnabled ? (
              <div className="flex justify-end">
                <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
                  Fill demo Boiler Service
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
                  showExtendedFields
                  showYear={false}
                  applyExtendedDefaults={false}
                  inlineEditor
                />
              </div>
            </div>
            <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
              <p className="text-sm font-semibold text-muted">Flue type</p>
              <div className="mt-3">
                <SearchableSelect
                  label="Flue type"
                  value={details.flue_type ?? ''}
                  options={[...BOILER_SERVICE_FLUE_TYPES].map((option) => ({
                    label: option.label,
                    value: option.value,
                  }))}
                  placeholder="Select or type"
                  onChange={(val) => setDetails((prev) => ({ ...prev, flue_type: val }))}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {BOILER_SERVICE_EVIDENCE_PHOTOS.map((card) => (
                <EvidenceCard
                  key={card.key}
                  title={card.label}
                  fields={[]}
                  values={{}}
                  onChange={() => null}
                  photoPreview={photoPreviews[card.key]}
                  onPhotoUpload={(file) => {
                    const data = new FormData();
                    data.append('jobId', jobId);
                    data.append('category', card.key);
                    data.append('file', file);
                    startTransition(async () => {
                      try {
                        const { url } = await uploadBoilerServicePhoto(data);
                        setPhotoPreviews((prev) => ({ ...prev, [card.key]: url }));
                        pushToast({ title: `${card.label} photo saved`, variant: 'success' });
                      } catch (error) {
                        pushToast({
                          title: 'Upload failed',
                          description: error instanceof Error ? error.message : 'Please try again.',
                          variant: 'error',
                        });
                      }
                    });
                  }}
                  onVoice={() =>
                    pushToast({
                      title: 'Voice capture coming soon',
                      description: 'Add a quick note instead.',
                      variant: 'default',
                    })
                  }
                  onText={() =>
                    pushToast({
                      title: 'Manual entry',
                      description: 'Edit the fields above to capture details.',
                      variant: 'default',
                    })
                  }
                />
              ))}
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button className="rounded-full px-6" onClick={handleDetailsNext} disabled={isPending}>
              Next → Job
            </Button>
          </div>
        </WizardLayout>
      ) : null}

      {step === 2 ? (
        <WizardLayout step={offsetStep(2)} total={totalSteps} title="Service checks & readings" status="On-site checks" onBack={() => setStep(1)}>
          <div className="space-y-4">
          {demoEnabled ? (
            <div className="mb-3 flex justify-end">
              <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
                Fill demo Boiler Service
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
            title="Readings"
            subtitle={`${readingsCompleted}/${readingsFields.length} captured`}
            defaultOpen={firstIncompleteKey === 'readings'}
          >
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

          <details className="rounded-3xl border border-white/20 bg-white/70 p-4 shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold text-muted">Manual entry (fallback)</summary>
            <div className="mt-3 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {checkItems.map((item) => (
                  <div key={`fallback-${item.key}`} className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{item.label}</p>
                    <select
                      className="w-full rounded-2xl border border-white/40 bg-white/80 px-3 py-2 text-sm text-muted shadow-sm"
                      value={checks[item.key] || ''}
                      onChange={(e) => setCheckValue(item.key, e.target.value)}
                    >
                      <option value="">Select</option>
                      <option value="yes">YES</option>
                      <option value="no">NO</option>
                    </select>
                  </div>
                ))}
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
                <Textarea
                  value={checks.defects_details}
                  onChange={(e) => setCheckValue('defects_details', e.target.value)}
                  placeholder="Defect details"
                  className="min-h-[70px]"
                />
                <Textarea
                  value={checks.parts_used}
                  onChange={(e) => setCheckValue('parts_used', e.target.value)}
                  placeholder="Parts used (optional)"
                  className="min-h-[70px]"
                />
                <Input
                  value={checks.next_service_due}
                  onChange={(e) => setCheckValue('next_service_due', e.target.value)}
                  placeholder="Next service due (date or note)"
                />
              </div>
            </div>
          </details>
          </div>
          <div className="mt-6 flex justify-end">
            <Button className="rounded-full px-6" onClick={handleChecksNext} disabled={isPending}>
              Next → Sign & Preview
            </Button>
          </div>
        </WizardLayout>
      ) : null}

      {step === 3 ? (
        <WizardLayout step={offsetStep(3)} total={totalSteps} title="Signatures & PDF" status="Finish" onBack={() => setStep(2)}>
          <div className="space-y-4">
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
            <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
              <p className="text-sm font-semibold text-muted">Evidence photos (optional)</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="rounded-full" onClick={handlePreview} disabled={isPending}>
              Preview Boiler Service template
            </Button>
            <Button className="rounded-full bg-[var(--action)] px-6 text-white" onClick={handleGenerate} disabled={isPending}>
              {isPending ? 'Generating…' : 'Generate Boiler Service PDF'}
            </Button>
          </div>
        </WizardLayout>
      ) : null}
    </>
  );
}
