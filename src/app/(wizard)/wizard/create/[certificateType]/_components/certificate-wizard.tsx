'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { WizardLayout } from '@/components/certificates/wizard-layout';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SignatureCard } from '@/components/certificates/signature-card';
import { EvidenceCard } from './evidence-card';
import { ApplianceStep, type ApplianceStepValues } from '@/components/wizard/steps/appliance-step';
import { ChecksStep, type ChecksStepValues } from '@/components/wizard/steps/checks-step';
import { PrefillBadge } from '@/components/wizard/inputs/prefill-badge';
import { SearchableSelect } from '@/components/wizard/inputs/searchable-select';
import { type CertificateType, type Cp12Appliance, type PhotoCategory } from '@/types/certificates';
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
import {
  CP12_APPLIANCE_TYPES,
  CP12_FLUE_TYPES,
  CP12_LOCATIONS,
  CP12_VENTILATION,
  CP12_DEMO_APPLIANCE,
  CP12_DEMO_INFO,
  CP12_EVIDENCE_CONFIG,
} from '@/types/cp12';
import { saveJobFields } from '@/server/certificates';
import { mergeJobContextFields, type InitialJobContext } from './initial-job-context';

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
};

const emptyAppliance: Cp12Appliance = {
  appliance_type: '',
  location: '',
  make_model: '',
  operating_pressure: '',
  heat_input: '',
  flue_type: '',
  ventilation_provision: '',
  ventilation_satisfactory: '',
  flue_condition: '',
  stability_test: '',
  gas_tightness_test: '',
  co_reading_ppm: '',
  safety_rating: '',
  classification_code: '',
};

const KNOWN_MAKES = ['Worcester Bosch', 'Vaillant', 'Ideal', 'Baxi'];

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
  property_address: string;
  postcode: string;
  inspection_date: string;
  landlord_name: string;
  landlord_address: string;
  reg_26_9_confirmed: boolean;
};

const CP12_DEMO_PHOTO_NOTES: Record<string, string> = {
  appliance_photo: ['Worcester Bosch Greenstar 30i', 'Wall-mounted condensing combi boiler', 'Located in kitchen cupboard'].join('\n'),
  serial_label: ['Serial number: WB30I-84736291', 'Gas type: Natural Gas (G20)', 'Year of manufacture: 2019'].join('\n'),
  flue_photo: ['Room-sealed concentric flue', 'Flue terminates externally through rear wall', 'Clearances appear compliant'].join('\n'),
  meter_reading: ['Gas meter reading: 012345 m³', 'Meter type: Metric', 'Meter location: Hallway cupboard'].join('\n'),
  ventilation: ['Permanent ventilation present', 'Vent unobstructed', 'Ventilation size adequate for appliance'].join('\n'),
  issue_photo: 'No safety defects identified at time of inspection.',
};

const FINAL_EVIDENCE_CATEGORIES: Array<{ key: PhotoCategory; label: string }> = [
  { key: 'appliance_photo', label: 'Appliance' },
  { key: 'issue_photo', label: 'Issue/Defect' },
  { key: 'site', label: 'Site' },
];

const BOILER_TYPE_OPTIONS = [
  { label: 'Combi', value: 'combi' },
  { label: 'System', value: 'system' },
  { label: 'Regular', value: 'regular' },
  { label: 'Other', value: 'other' },
];

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
}: WizardProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [step, setStep] = useState(startStep);
  const [isPending, startTransition] = useTransition();
  const demoEnabled = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const resolvedInitialInfo = mergeJobContextFields(initialInfo, initialJobContext);

  const [info, setInfo] = useState<Cp12InfoState>({
    customer_name: resolvedInitialInfo.customer_name ?? '',
    property_address: resolvedInitialInfo.property_address ?? '',
    postcode: resolvedInitialInfo.postcode ?? '',
    inspection_date: resolvedInitialInfo.inspection_date ?? '',
    landlord_name: resolvedInitialInfo.landlord_name ?? '',
    landlord_address: resolvedInitialInfo.landlord_address ?? '',
    reg_26_9_confirmed: (() => {
      const value = String(resolvedInitialInfo.reg_26_9_confirmed ?? '').toLowerCase();
      return value === 'true' || value === 'yes';
    })(),
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
    flue_type: appliance.flue_type ?? '',
    ventilation_provision: appliance.ventilation_provision ?? '',
    ventilation_satisfactory: appliance.ventilation_satisfactory ?? '',
    flue_condition: appliance.flue_condition ?? '',
    stability_test: appliance.stability_test ?? '',
    gas_tightness_test: appliance.gas_tightness_test ?? '',
    co_reading_ppm: appliance.co_reading_ppm ?? '',
    safety_rating: appliance.safety_rating ?? '',
    classification_code: appliance.classification_code ?? '',
  });

  const [appliances, setAppliances] = useState<Cp12Appliance[]>(
    initialAppliances.length ? initialAppliances.map(sanitizeAppliance) : [emptyAppliance],
  );
  const [defects, setDefects] = useState({
    defect_description: resolvedInitialInfo.defect_description ?? '',
    remedial_action: resolvedInitialInfo.remedial_action ?? '',
    warning_notice_issued: resolvedInitialInfo.warning_notice_issued ?? 'NO',
  });
  const [completionDate, setCompletionDate] = useState(resolvedInitialInfo.completion_date ?? new Date().toISOString().slice(0, 10));
  const [engineerSignature, setEngineerSignature] = useState(resolvedInitialInfo.engineer_signature ?? '');
  const [customerSignature, setCustomerSignature] = useState(resolvedInitialInfo.customer_signature ?? '');
  const [prefillBadgeText, setPrefillBadgeText] = useState<string | null>(null);
  const prefillAppliedRef = useRef(false);

  const isCp12 = useMemo(() => certificateType === 'cp12', [certificateType]);
  const totalSteps = 4 + stepOffset;
  const offsetStep = (step: number) => step + stepOffset;

  useEffect(() => {
    if (!isCp12 || prefillAppliedRef.current) return;
    prefillAppliedRef.current = true;
    startTransition(async () => {
      try {
        const defaults = await getLatestApplianceDefaultsForJob(jobId);
        if (!defaults) return;
        const dateLabel = defaults.source.date ? new Date(defaults.source.date).toLocaleDateString('en-GB') : null;
        setPrefillBadgeText(`Filled from previous visit${dateLabel ? ` — ${dateLabel}` : ''}`);

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
  }, [isCp12, jobId, startTransition]);

  const handleDemoFill = () => {
    if (!isCp12 || !demoEnabled) return;
    startTransition(async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const demoInfo: Cp12InfoState = {
          ...info,
          customer_name: info.customer_name || CP12_DEMO_INFO.customer_name,
          property_address: info.property_address || CP12_DEMO_INFO.property_address,
          postcode: info.postcode || CP12_DEMO_INFO.postcode,
          inspection_date: info.inspection_date || today,
          landlord_name: info.landlord_name || CP12_DEMO_INFO.landlord_name,
          landlord_address: info.landlord_address || CP12_DEMO_INFO.landlord_address,
          reg_26_9_confirmed: true,
        };
        const demoJobInfo = {
          ...demoInfo,
          engineer_name: CP12_DEMO_INFO.engineer_name,
          gas_safe_number: CP12_DEMO_INFO.gas_safe_number,
          company_name: CP12_DEMO_INFO.company_name,
        };

        const demoAppliance: Cp12Appliance = { ...emptyAppliance, ...CP12_DEMO_APPLIANCE };
        setInfo(demoInfo);
        setAppliances([demoAppliance]);
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

  const handleInfoNext = () => {
    if (!isCp12) {
      setStep(2);
      return;
    }
    startTransition(async () => {
      try {
        const data = { ...info, inspection_date: info.inspection_date || completionDate };
        const jobPayload = {
          ...data,
          engineer_name: resolvedInitialInfo.engineer_name ?? '',
          gas_safe_number: resolvedInitialInfo.gas_safe_number ?? '',
          company_name: resolvedInitialInfo.company_name ?? '',
        };
        await saveCp12JobInfo({ jobId, data: jobPayload });
        setInfo(data);
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

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        if (isCp12) {
          const data = { ...info, inspection_date: info.inspection_date || completionDate };
          const jobPayload = {
            ...data,
            engineer_name: resolvedInitialInfo.engineer_name ?? '',
            gas_safe_number: resolvedInitialInfo.gas_safe_number ?? '',
            company_name: resolvedInitialInfo.company_name ?? '',
          };
          await saveCp12JobInfo({ jobId, data: jobPayload });
          setInfo(data);
          await saveCp12Appliances({ jobId, appliances, defects });
        }
        if (isCp12) {
          const normalizedInfo = { ...info, inspection_date: info.inspection_date || completionDate };
          const errors = validateCp12AgainstSpec(normalizedInfo, appliances, defects, engineerSignature, customerSignature);
          if (errors.length) {
            pushToast({
              title: 'CP12 requirements missing',
              description: errors.join('; '),
              variant: 'error',
            });
            return;
          }
        }
        await updateField({ jobId, key: 'completion_date', value: completionDate });
        const { pdfUrl, jobId: resultJobId } = await generateCertificatePdf({ jobId, certificateType, previewOnly: false });
        pushToast({
          title: `${certificateLabel} generated successfully`,
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
          description: error instanceof Error ? error.message : 'Try again.',
          variant: 'error',
        });
      }
    });
  };

  const handlePreview = () => {
    startTransition(async () => {
      try {
        if (isCp12) {
          const data = { ...info, inspection_date: info.inspection_date || completionDate };
          const jobPayload = {
            ...data,
            engineer_name: resolvedInitialInfo.engineer_name ?? '',
            gas_safe_number: resolvedInitialInfo.gas_safe_number ?? '',
            company_name: resolvedInitialInfo.company_name ?? '',
          };
          await saveCp12JobInfo({ jobId, data: jobPayload });
          setInfo(data);
          await saveCp12Appliances({ jobId, appliances, defects });
        }
        const { pdfUrl } = await generateCertificatePdf({ jobId, certificateType, previewOnly: true });
        pushToast({ title: 'Preview ready', variant: 'success' });
        router.push(`/jobs/${jobId}/pdf?url=${encodeURIComponent(pdfUrl)}&preview=1`);
      } catch (error) {
        pushToast({
          title: 'Could not preview PDF',
          description: error instanceof Error ? error.message : 'Try again.',
          variant: 'error',
        });
      }
    });
  };

  const setApplianceField = (index: number, key: keyof Cp12Appliance, value: string) => {
    setAppliances((prev) => {
      const next = [...prev];
      const current = { ...next[index] };
      if (key === 'safety_rating') {
        current.safety_rating = value;
        if (value.toLowerCase() === 'safe') {
          current.classification_code = '';
        }
      } else if (key === 'classification_code') {
        if ((current.safety_rating || '').toLowerCase() === 'safe') {
          current.classification_code = '';
        } else {
          current.classification_code = value;
        }
      } else {
        current[key] = value;
      }
      next[index] = current;
      return next;
    });
  };

  const addAppliance = () => setAppliances((prev) => [...prev, { ...emptyAppliance }]);
  const handlePrefillClick = () => {
    pushToast({ title: 'Prefill applied', description: 'Edit any field to update values.', variant: 'default' });
  };

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

  const applianceProfiles = useMemo<ApplianceStepValues[]>(
    () =>
      appliances.map((appliance, index) => {
        const { make, model } = splitMakeModel(appliance.make_model ?? '');
        return {
          type: appliance.appliance_type ?? '',
          make,
          model,
          location: appliance.location ?? '',
          serial: index === 0 ? (evidenceFields.serial_number ?? '') : '',
        };
      }),
    [appliances, evidenceFields.serial_number],
  );

  const handleApplianceProfilesChange = (nextProfiles: ApplianceStepValues[]) => {
    const normalizedProfiles = nextProfiles.length ? nextProfiles : [{ type: '', make: '', model: '', location: '', serial: '' }];
    setAppliances((prev) =>
      normalizedProfiles.map((profile, index) => {
        const current = prev[index] ?? { ...emptyAppliance };
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

  const applianceEvidenceProfile = useMemo<ApplianceStepValues>(
    () => ({
      type: evidenceFields.boiler_type ?? '',
      make: evidenceFields.boiler_make ?? '',
      model: evidenceFields.boiler_model ?? '',
      location: evidenceFields.location ?? '',
      serial: evidenceFields.serial_number ?? '',
      mountType: evidenceFields.mount_type ?? '',
      gasType: evidenceFields.gas_type ?? '',
      year: evidenceFields.manufacture_year ?? '',
    }),
    [
      evidenceFields.boiler_type,
      evidenceFields.boiler_make,
      evidenceFields.boiler_model,
      evidenceFields.location,
      evidenceFields.serial_number,
      evidenceFields.mount_type,
      evidenceFields.gas_type,
      evidenceFields.manufacture_year,
    ],
  );

  const handleApplianceEvidenceChange = (next: ApplianceStepValues) => {
    handleEvidenceFieldsUpdate({
      boiler_type: next.type ?? '',
      boiler_make: next.make ?? '',
      boiler_model: next.model ?? '',
      location: next.location ?? '',
      serial_number: next.serial ?? '',
      mount_type: next.mountType ?? '',
      gas_type: next.gasType ?? '',
      manufacture_year: next.year ?? '',
    });
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
      if (key === 'co_reading_ppm') setApplianceField(index, 'co_reading_ppm', value);
      if (key === 'safety_rating') setApplianceField(index, 'safety_rating', value);
      if (key === 'classification_code') setApplianceField(index, 'classification_code', value);
    };

    (Object.entries(updates) as Array<[keyof ChecksStepValues, string | undefined]>).forEach(([key, value]) =>
      mapField(key, value),
    );
  };

  const hasUnsafeAppliance = appliances.some((appliance) => {
    const rating = (appliance.safety_rating ?? '').toLowerCase().trim();
    return rating.length > 0 && rating !== 'safe';
  });

  const StepOne = (
    <WizardLayout step={offsetStep(1)} total={totalSteps} title="Job info" status={certificateLabel}>
      {isCp12 ? (
        <div className="space-y-3">
          {demoEnabled ? (
            <div className="flex justify-end">
              <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
                Fill demo CP12
              </Button>
            </div>
          ) : null}
          <p className="text-sm text-muted">Engineer and company details are pulled from account settings.</p>
          <Input
            value={info.customer_name}
            onChange={(e) => setInfo((prev) => ({ ...prev, customer_name: e.target.value }))}
            placeholder="Customer name"
            className="rounded-2xl"
          />
          <Input
            value={info.property_address}
            onChange={(e) => setInfo((prev) => ({ ...prev, property_address: e.target.value }))}
            placeholder="Property address"
            className="rounded-2xl"
          />
          <Input
            value={info.postcode}
            onChange={(e) => setInfo((prev) => ({ ...prev, postcode: e.target.value }))}
            placeholder="Postcode"
            className="rounded-2xl"
          />
          <Input
            value={info.landlord_name}
            onChange={(e) => setInfo((prev) => ({ ...prev, landlord_name: e.target.value }))}
            placeholder="Landlord / Agent name"
            className="rounded-2xl"
          />
          <Textarea
            value={info.landlord_address}
            onChange={(e) => setInfo((prev) => ({ ...prev, landlord_address: e.target.value }))}
            placeholder="Landlord / Agent address"
            className="min-h-[70px] rounded-2xl"
          />
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
      <div className="mt-6 flex justify-end">
        <Button onClick={handleInfoNext} disabled={isPending} className="rounded-full px-6">
          Next → Add Photos
        </Button>
      </div>
    </WizardLayout>
  );

  const StepTwo = (
    <WizardLayout step={offsetStep(2)} total={totalSteps} title="Photo capture" status="Evidence" onBack={() => setStep(1)}>
      {demoEnabled ? (
        <div className="flex justify-end">
          <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
            Fill demo CP12
          </Button>
        </div>
      ) : null}
      {prefillBadgeText ? (
        <div className="mt-2 flex justify-end">
          <PrefillBadge text={`${prefillBadgeText} — tap to change`} onClick={handlePrefillClick} />
        </div>
      ) : null}
      <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
        <p className="text-sm font-semibold text-muted">Appliance profile</p>
        <div className="mt-3">
          <ApplianceStep
            appliance={applianceEvidenceProfile}
            onApplianceChange={handleApplianceEvidenceChange}
            typeOptions={BOILER_TYPE_OPTIONS}
            allowMultiple={false}
            showExtendedFields
            inlineEditor
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {CP12_EVIDENCE_CONFIG.filter(
          (category) =>
            !['appliance_photo', 'serial_label', 'flue_photo', 'meter_reading', 'ventilation', 'issue_photo'].includes(category.key),
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
      <div className="mt-6 flex justify-end">
        <Button onClick={() => setStep(3)} disabled={isPending} className="rounded-full px-6">
          Next → Checks
        </Button>
      </div>
    </WizardLayout>
  );

  const StepThree = (
    <WizardLayout step={offsetStep(3)} total={totalSteps} title="Appliance checks" status="On-site checks" onBack={() => setStep(2)}>
      <div className="space-y-4">
        {demoEnabled && (
          <div className="flex justify-end">
            <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
              Fill demo CP12
            </Button>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {CP12_EVIDENCE_CONFIG.filter((category) =>
            ['flue_photo', 'meter_reading', 'ventilation', 'issue_photo'].includes(category.key),
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
                pushToast({ title: 'Manual entry', description: 'Edit the fields directly above.', variant: 'default' });
              }}
            />
          ))}
        </div>
        <ApplianceStep
          appliances={applianceProfiles}
          onAppliancesChange={handleApplianceProfilesChange}
          typeOptions={[...CP12_APPLIANCE_TYPES]}
          locationOptions={[...CP12_LOCATIONS]}
          allowMultiple
          prefillText={prefillBadgeText ? `${prefillBadgeText} — tap to change` : null}
          onPrefillClick={handlePrefillClick}
        />

        <div className="space-y-4">
          {appliances.map((appliance, index) => (
            <div key={`checks-${index}`} className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
              <p className="text-sm font-semibold text-muted">Appliance #{index + 1} checks</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <SearchableSelect
                  label="Flue type"
                  value={appliance.flue_type ?? ''}
                  options={[...CP12_FLUE_TYPES]}
                  placeholder="Select or type"
                  onChange={(val) => setApplianceField(index, 'flue_type', val)}
                />
                <SearchableSelect
                  label="Ventilation provision"
                  value={appliance.ventilation_provision ?? ''}
                  options={[...CP12_VENTILATION]}
                  placeholder="Select or type"
                  onChange={(val) => setApplianceField(index, 'ventilation_provision', val)}
                />
              </div>
              <div className="mt-4">
                <ChecksStep
                  values={{
                    ventilation_satisfactory: appliance.ventilation_satisfactory ?? '',
                    flue_condition: appliance.flue_condition ?? '',
                    stability_test: appliance.stability_test ?? '',
                    gas_tightness_test: appliance.gas_tightness_test ?? '',
                    operating_pressure: appliance.operating_pressure ?? '',
                    heat_input: appliance.heat_input ?? '',
                    co_reading_ppm: appliance.co_reading_ppm ?? '',
                    safety_rating: appliance.safety_rating ?? '',
                    classification_code: appliance.classification_code ?? '',
                  }}
                  onChange={(updates) => handleApplianceChecksChange(index, updates)}
                  safetyOptions={[
                    { label: 'Safe', value: 'safe' },
                    { label: 'At Risk', value: 'at risk' },
                    { label: 'Immediately Dangerous', value: 'immediately dangerous' },
                  ]}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
          <p className="text-sm font-semibold text-muted">Defects & actions</p>
          {hasUnsafeAppliance ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Textarea
                value={defects.defect_description ?? ''}
                onChange={(e) => setDefects((prev) => ({ ...prev, defect_description: e.target.value }))}
                placeholder="Defect description"
                className="min-h-[90px]"
              />
              <Textarea
                value={defects.remedial_action ?? ''}
                onChange={(e) => setDefects((prev) => ({ ...prev, remedial_action: e.target.value }))}
                placeholder="Remedial action"
                className="min-h-[90px]"
              />
              <SelectRow
                label="Warning notice issued"
                value={defects.warning_notice_issued ?? 'NO'}
                options={['YES', 'NO']}
                onChange={(val) => setDefects((prev) => ({ ...prev, warning_notice_issued: val }))}
              />
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground/70">Set a safety rating to reveal defect and warning notice fields.</p>
          )}
        </div>

        <details className="rounded-3xl border border-white/20 bg-white/70 p-4 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-muted">Manual entry (fallback)</summary>
          <div className="mt-3 space-y-4">
            {appliances.map((appliance, index) => (
              <div key={`manual-${index}`} className="grid gap-3 sm:grid-cols-2">
                <OptionSelect
                  label="Appliance type"
                  value={appliance.appliance_type}
                  options={CP12_APPLIANCE_TYPES}
                  onChange={(val) => setApplianceField(index, 'appliance_type', val)}
                />
                <OptionSelect
                  label="Location"
                  value={appliance.location}
                  options={CP12_LOCATIONS}
                  onChange={(val) => setApplianceField(index, 'location', val)}
                />
                <Input
                  value={appliance.make_model}
                  onChange={(e) => setApplianceField(index, 'make_model', e.target.value)}
                  placeholder="Make / Model"
                />
                <Input
                  value={appliance.operating_pressure}
                  onChange={(e) => setApplianceField(index, 'operating_pressure', e.target.value)}
                  placeholder="Operating pressure (mbar)"
                />
                <Input
                  value={appliance.heat_input}
                  onChange={(e) => setApplianceField(index, 'heat_input', e.target.value)}
                  placeholder="Heat input (kW)"
                />
                <OptionSelect
                  label="Flue type"
                  value={appliance.flue_type}
                  options={CP12_FLUE_TYPES}
                  onChange={(val) => setApplianceField(index, 'flue_type', val)}
                />
                <OptionSelect
                  label="Ventilation provision"
                  value={appliance.ventilation_provision}
                  options={CP12_VENTILATION}
                  onChange={(val) => setApplianceField(index, 'ventilation_provision', val)}
                />
                <SelectRow
                  label="Ventilation satisfactory"
                  value={appliance.ventilation_satisfactory}
                  options={['PASS', 'FAIL']}
                  onChange={(val) => setApplianceField(index, 'ventilation_satisfactory', val)}
                />
                <SelectRow
                  label="Flue condition"
                  value={appliance.flue_condition}
                  options={['PASS', 'FAIL']}
                  onChange={(val) => setApplianceField(index, 'flue_condition', val)}
                />
                <SelectRow
                  label="Stability test"
                  value={appliance.stability_test}
                  options={['PASS', 'FAIL']}
                  onChange={(val) => setApplianceField(index, 'stability_test', val)}
                />
                <SelectRow
                  label="Gas tightness test"
                  value={appliance.gas_tightness_test}
                  options={['PASS', 'FAIL']}
                  onChange={(val) => setApplianceField(index, 'gas_tightness_test', val)}
                />
                <Input
                  value={appliance.co_reading_ppm}
                  onChange={(e) => setApplianceField(index, 'co_reading_ppm', e.target.value)}
                  placeholder="CO reading (ppm)"
                />
                <SelectRow
                  label="Safety rating"
                  value={appliance.safety_rating}
                  options={['Safe', 'At Risk', 'Immediately Dangerous']}
                  onChange={(val) => setApplianceField(index, 'safety_rating', val)}
                />
                <SelectRow
                  label="Classification code"
                  value={appliance.classification_code}
                  options={['AR', 'ID', 'NCS']}
                  onChange={(val) => setApplianceField(index, 'classification_code', val)}
                  disabled={(appliance.safety_rating ?? '').toLowerCase() === 'safe'}
                />
              </div>
            ))}
            <Button type="button" variant="outline" className="rounded-full" onClick={addAppliance}>
              + Add appliance
            </Button>
          </div>
        </details>
      </div>
      <div className="mt-6 flex justify-between">
        <Button variant="outline" className="rounded-full" onClick={() => setStep(2)} disabled={isPending}>
          Back
        </Button>
        <Button onClick={handleChecksNext} disabled={isPending} className="rounded-full px-6">
          Next → Sign
        </Button>
      </div>
    </WizardLayout>
  );

  const StepFour = (
    <WizardLayout step={offsetStep(4)} total={totalSteps} title="Signatures & PDF" status="Finish" onBack={() => setStep(3)}>
      <div className="space-y-3">
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
                const { url } = await uploadSignature(data);
                setEngineerSignature(url);
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
          <p className="text-sm font-semibold text-muted">Evidence photos (optional)</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {FINAL_EVIDENCE_CATEGORIES.map((item) => (
              <EvidenceCard
                key={item.key}
                title={item.label}
                fields={[]}
                values={{}}
                onChange={() => null}
                photoPreview={initialPhotoPreviews[item.key]}
                onPhotoUpload={handleEvidenceUpload(item.key)}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" className="rounded-full" onClick={handlePreview} disabled={isPending}>
          Preview CP12 template
        </Button>
        <Button variant="outline" className="rounded-full" onClick={() => router.push(`/jobs/${jobId}`)}>
          Edit before send
        </Button>
        <Button className="rounded-full bg-[var(--action)] px-6 text-white" disabled={isPending} onClick={handleGenerate}>
          {isPending ? 'Generating…' : 'Generate PDF'}
        </Button>
      </div>
    </WizardLayout>
  );

  if (step === 1) return StepOne;
  if (step === 2) return StepTwo;
  if (step === 3) return StepThree;
  return StepFour;
}

const CP12_REQUIRED_FIELDS = ['property_address', 'inspection_date', 'landlord_name', 'landlord_address'] as const;

const hasValue = (val: unknown) => typeof val === 'string' && val.trim().length > 0;
const booleanFromField = (val: unknown) => val === true || val === 'true' || val === 'YES' || val === 'yes';

// Client-side guardrails that mirror docs/specs/cp12.md; server enforces the same before PDF generation.
function validateCp12AgainstSpec(
  info: Cp12InfoState,
  appliances: Cp12Appliance[],
  defects: { defect_description?: string | null; remedial_action?: string | null },
  engineerSignature: string,
  customerSignature: string,
) {
  const errors: string[] = [];
  CP12_REQUIRED_FIELDS.forEach((key) => {
    if (!hasValue(info[key])) errors.push(`${key.replace(/_/g, ' ')} is required`);
  });
  // Engineer/company details are sourced from account settings and signatures; no field entry required here.
  if (!booleanFromField(info.reg_26_9_confirmed)) {
    errors.push('Regulation 26(9) confirmation is required');
  }
  const applianceRows = (appliances ?? []).filter(
    (app) => hasValue(app?.appliance_type) || hasValue(app?.location),
  );
  if (!applianceRows.length) {
    errors.push('At least one appliance with location and description is required');
  } else if (applianceRows.some((app) => !hasValue(app?.location) || !hasValue(app?.appliance_type))) {
    errors.push('Each appliance must include location and description');
  }
  applianceRows.forEach((app) => {
    if (hasValue(app.classification_code) && (app.safety_rating ?? '').toLowerCase() === 'safe') {
      errors.push('Classification code should only be set when safety rating is not safe');
    }
  });
  const defectsPresent = hasValue(defects.defect_description) || hasValue(defects.remedial_action);
  if (defectsPresent && (!hasValue(defects.defect_description) || !hasValue(defects.remedial_action))) {
    errors.push('Defects require both description and remedial action');
  }
  if (!hasValue(engineerSignature)) errors.push('Engineer signature is required');
  if (!hasValue(customerSignature)) errors.push('Customer signature is required');
  return errors;
}

function SelectRow({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{label}</p>
      {disabled ? (
        <p className="rounded-full bg-white/40 px-3 py-1 text-xs font-semibold text-muted">Not required</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                value === option ? 'bg-[var(--accent)] text-white' : 'bg-[var(--muted)] text-muted'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OptionSelect({
  label,
  value,
  options,
  placeholder = 'Select',
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{label}</p>
      <select
        className="w-full rounded-2xl border border-white/40 bg-white/80 px-3 py-2 text-sm text-muted shadow-sm"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
