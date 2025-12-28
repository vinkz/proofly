'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

import { WizardLayout } from '@/components/certificates/wizard-layout';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { EvidenceCard } from './evidence-card';
import { ApplianceStep } from '@/components/wizard/steps/appliance-step';
import { ChecksStep } from '@/components/wizard/steps/checks-step';
import { UnitNumberInput } from '@/components/wizard/inputs/unit-number-input';
import { createCommissioningChecklistReport, previewCommissioningChecklistReport } from '@/server/jobs';
import { uploadJobPhoto } from '@/server/certificates';
import { mergeJobContextFields, type InitialJobContext } from './initial-job-context';
import type { PhotoCategory } from '@/types/certificates';

type CommissioningWizardProps = {
  jobId: string;
  initialFields: Record<string, string | null | undefined>;
  initialJobContext?: InitialJobContext | null;
  stepOffset?: number;
};

type CommissioningFormState = {
  engineer_name: string;
  company_name: string;
  company_address_line1: string;
  company_address_line2: string;
  company_address_city: string;
  company_postcode: string;
  company_tel: string;
  gas_safe_number: string;
  engineer_id_card_number: string;
  job_reference: string;
  job_address_name: string;
  job_address_line1: string;
  job_address_line2: string;
  job_address_city: string;
  job_postcode: string;
  job_tel: string;
  client_name: string;
  client_company: string;
  client_address_line1: string;
  client_address_line2: string;
  client_address_city: string;
  client_postcode: string;
  client_tel: string;
  appliance_type: string;
  appliance_make: string;
  appliance_model: string;
  appliance_location: string;
  appliance_serial: string;
  gc_number: string;
  landlord_equipment: boolean;
  flue_type: string;
  heat_input: string;
  running_set_point_temp: string;
  safety_devices: boolean;
  ventilation: boolean;
  high_combustion_co_ppm: string;
  high_combustion_co2: string;
  high_combustion_ratio: string;
  low_combustion_co_ppm: string;
  low_combustion_co2: string;
  low_combustion_ratio: string;
  gas_rate: string;
  gas_tightness: boolean;
  equipotential_earth_bonding: boolean;
  gas_meter_pressure: string;
  inlet_test_point_pressure: string;
  max_rate_gas_meter_pressure: string;
  inlet_test_point_max_rate_pressure: string;
  engineer_comments: string;
  print_name_issued: string;
  print_name_received: string;
  commissioning_date: string;
  next_service_due: string;
};

const FINAL_EVIDENCE_CATEGORIES: Array<{ key: PhotoCategory; label: string }> = [
  { key: 'appliance_photo', label: 'Appliance' },
  { key: 'issue_photo', label: 'Issue/Defect' },
  { key: 'site', label: 'Site' },
];

const toText = (value: unknown) => (typeof value === 'string' ? value : '');
const toDateInput = (value: unknown) => {
  if (typeof value === 'string' && value.trim()) return value.slice(0, 10);
  return '';
};
const pickText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
};
const parseBool = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'y', 'on'].includes(value.toLowerCase());
  }
  return false;
};

const Step1Schema = z
  .object({
    job_address_name: z.string(),
    job_address_line1: z.string(),
    job_postcode: z.string().min(1, 'Job postcode is required'),
    commissioning_date: z.string().min(1, 'Commissioning date is required'),
  })
  .refine((data) => Boolean(data.job_address_name.trim() || data.job_address_line1.trim()), {
    message: 'Job address name or line 1 is required',
    path: ['job_address_name'],
  });

const Step2Schema = z.object({
  appliance_make: z.string().min(1, 'Boiler make is required'),
  appliance_model: z.string().min(1, 'Boiler model is required'),
  appliance_serial: z.string().min(1, 'Serial number is required'),
});

const Step4Schema = z.object({
  engineer_name: z.string().min(1, 'Engineer name is required'),
  gas_safe_number: z.string().min(1, 'Gas Safe registration number is required'),
});

const RequiredSchema = Step1Schema.merge(Step2Schema).merge(Step4Schema);

const APPLIANCE_TYPE_OPTIONS = [
  { label: 'Combi', value: 'combi' },
  { label: 'System', value: 'system' },
  { label: 'Regular', value: 'regular' },
  { label: 'Other', value: 'other' },
];

export function CommissioningWizard({ jobId, initialFields, initialJobContext = null, stepOffset = 0 }: CommissioningWizardProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const resolvedFields = mergeJobContextFields(initialFields, initialJobContext);
  const today = new Date().toISOString().slice(0, 10);
  const demoEnabled = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const totalSteps = 4 + stepOffset;
  const offsetStep = (value: number) => value + stepOffset;

  const [fields, setFields] = useState<CommissioningFormState>({
    engineer_name: toText(resolvedFields.engineer_name),
    company_name: pickText(resolvedFields.company_name, resolvedFields.engineer_company),
    company_address_line1: toText(resolvedFields.company_address_line1),
    company_address_line2: toText(resolvedFields.company_address_line2),
    company_address_city: toText(resolvedFields.company_town),
    company_postcode: toText(resolvedFields.company_postcode),
    company_tel: toText(resolvedFields.company_phone),
    gas_safe_number: toText(resolvedFields.gas_safe_number),
    engineer_id_card_number: toText(resolvedFields.engineer_id_card_number),
    job_reference: pickText(resolvedFields.job_reference, resolvedFields.cert_no, resolvedFields.record_id),
    job_address_name: toText(resolvedFields.property_name),
    job_address_line1: pickText(resolvedFields.property_address, resolvedFields.property_address_line1),
    job_address_line2: toText(resolvedFields.property_address_line2),
    job_address_city: toText(resolvedFields.property_town),
    job_postcode: toText(resolvedFields.postcode),
    job_tel: toText(resolvedFields.job_phone),
    client_name: toText(resolvedFields.customer_name),
    client_company: toText(resolvedFields.customer_company),
    client_address_line1: toText(resolvedFields.customer_address),
    client_address_line2: toText(resolvedFields.customer_address_line2),
    client_address_city: toText(resolvedFields.customer_town),
    client_postcode: toText(resolvedFields.postcode),
    client_tel: pickText(resolvedFields.customer_phone, resolvedFields.customer_contact),
    appliance_type: toText(resolvedFields.appliance_type),
    appliance_make: toText(resolvedFields.appliance_make),
    appliance_model: toText(resolvedFields.appliance_model),
    appliance_location: toText(resolvedFields.appliance_location),
    appliance_serial: toText(resolvedFields.serial_no),
    gc_number: toText(resolvedFields.gc_number),
    landlord_equipment: parseBool(resolvedFields.landlord_equipment),
    flue_type: toText(resolvedFields.flue_type),
    heat_input: toText(resolvedFields.heat_input),
    running_set_point_temp: toText(resolvedFields.running_set_point_temp),
    safety_devices: parseBool(resolvedFields.safety_devices),
    ventilation: parseBool(resolvedFields.ventilation),
    high_combustion_co_ppm: toText(resolvedFields.high_combustion_co_ppm),
    high_combustion_co2: toText(resolvedFields.high_combustion_co2),
    high_combustion_ratio: toText(resolvedFields.high_combustion_ratio),
    low_combustion_co_ppm: toText(resolvedFields.low_combustion_co_ppm),
    low_combustion_co2: toText(resolvedFields.low_combustion_co2),
    low_combustion_ratio: toText(resolvedFields.low_combustion_ratio),
    gas_rate: toText(resolvedFields.gas_rate),
    gas_tightness: parseBool(resolvedFields.gas_tightness),
    equipotential_earth_bonding: parseBool(resolvedFields.equipotential_earth_bonding),
    gas_meter_pressure: toText(resolvedFields.gas_meter_pressure),
    inlet_test_point_pressure: toText(resolvedFields.inlet_test_point_pressure),
    max_rate_gas_meter_pressure: toText(resolvedFields.max_rate_gas_meter_pressure),
    inlet_test_point_max_rate_pressure: toText(resolvedFields.inlet_test_point_max_rate_pressure),
    engineer_comments: toText(resolvedFields.engineer_comments),
    print_name_issued: pickText(resolvedFields.print_name_issued, resolvedFields.engineer_name),
    print_name_received: pickText(resolvedFields.print_name_received, resolvedFields.customer_name),
    commissioning_date: pickText(toDateInput(resolvedFields.commissioning_date), toDateInput(resolvedFields.service_date), today),
    next_service_due: toDateInput(resolvedFields.next_service_due),
  });

  const handleDemoFill = () => {
    if (!demoEnabled) return;
    const nextServiceDate = new Date();
    nextServiceDate.setFullYear(nextServiceDate.getFullYear() + 1);
    const demo: CommissioningFormState = {
      engineer_name: 'Alex Turner',
      company_name: 'CertNow Heating',
      company_address_line1: 'Unit 3',
      company_address_line2: 'Park Industrial Estate',
      company_address_city: 'London',
      company_postcode: 'E7 9AB',
      company_tel: '020 7946 0011',
      gas_safe_number: '123456',
      engineer_id_card_number: 'GS-987654',
      job_reference: fields.job_reference || 'CN-204589',
      job_address_name: 'Flat 2, Maple House',
      job_address_line1: '12 High Street',
      job_address_line2: 'Leyton',
      job_address_city: 'London',
      job_postcode: 'E10 6AA',
      job_tel: '07123 456789',
      client_name: 'Jamie Collins',
      client_company: 'Collins Property Ltd',
      client_address_line1: '12 High Street',
      client_address_line2: 'Leyton',
      client_address_city: 'London',
      client_postcode: 'E10 6AA',
      client_tel: '07123 456789',
      appliance_type: 'Combi boiler',
      appliance_make: 'Worcester Bosch',
      appliance_model: 'Greenstar 30i',
      appliance_location: 'Kitchen cupboard',
      appliance_serial: 'WB30I-84736291',
      gc_number: '47-311-92',
      landlord_equipment: false,
      flue_type: 'Room sealed',
      heat_input: '24',
      running_set_point_temp: '65',
      safety_devices: true,
      ventilation: true,
      high_combustion_co_ppm: '45',
      high_combustion_co2: '9.3',
      high_combustion_ratio: '0.0048',
      low_combustion_co_ppm: '32',
      low_combustion_co2: '8.9',
      low_combustion_ratio: '0.0036',
      gas_rate: '2.2',
      gas_tightness: true,
      equipotential_earth_bonding: true,
      gas_meter_pressure: '21',
      inlet_test_point_pressure: '20',
      max_rate_gas_meter_pressure: '19',
      inlet_test_point_max_rate_pressure: '18.5',
      engineer_comments: 'Commissioning completed to manufacturer guidance.',
      print_name_issued: 'Alex Turner',
      print_name_received: 'Jamie Collins',
      commissioning_date: today,
      next_service_due: nextServiceDate.toISOString().slice(0, 10),
    };
    setFields(demo);
    pushToast({ title: 'Commissioning demo filled', variant: 'success' });
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

  const validateStep = (schema: z.ZodTypeAny) => {
    const result = schema.safeParse(fields);
    if (!result.success) {
      const issue = result.error.issues[0];
      pushToast({
        title: 'Missing required fields',
        description: issue?.message ?? 'Please complete required fields before continuing.',
        variant: 'error',
      });
      return false;
    }
    return true;
  };

  const handleNext = (schema: z.ZodTypeAny) => {
    if (!validateStep(schema)) return;
    setStep((prev) => prev + 1);
  };

  const handleGenerate = () => {
    if (!validateStep(RequiredSchema)) return;

    startTransition(async () => {
      try {
        const result = await createCommissioningChecklistReport({
          jobId,
          fields,
        });
        pushToast({
          title: 'Commissioning checklist generated',
          variant: 'success',
        });
        router.refresh();
        router.push(`/reports/${jobId}`);
        if (result.signedUrl && typeof window !== 'undefined') {
          try {
            window.open(result.signedUrl, '_blank');
          } catch {
            // ignore window blocking
          }
        }
      } catch (error) {
        pushToast({
          title: 'Could not generate checklist',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const handlePreview = () => {
    if (!validateStep(RequiredSchema)) return;

    startTransition(async () => {
      try {
        const result = await previewCommissioningChecklistReport({
          jobId,
          fields,
        });
        pushToast({
          title: 'Preview ready',
          variant: 'success',
        });
        if (result.pdfUrl && typeof window !== 'undefined') {
          try {
            window.open(result.pdfUrl, '_blank');
          } catch {
            // ignore window blocking
          }
        }
      } catch (error) {
        pushToast({
          title: 'Could not load preview',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const safetyChecks = [
    { key: 'safety_devices', label: 'Safety devices correct operation' },
    { key: 'ventilation', label: 'Ventilation per manufacturer recommendation' },
    { key: 'gas_tightness', label: 'Gas tightness satisfactory' },
    { key: 'equipotential_earth_bonding', label: 'Equipotential earth bonding' },
  ] as const;

  return (
    <>
      {step === 1 ? (
        <WizardLayout step={offsetStep(1)} total={totalSteps} title="Job address" status="Commissioning">
          <div className="space-y-3">
          {demoEnabled ? (
            <div className="mb-3 flex justify-end">
              <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
                Fill demo Commissioning
              </Button>
            </div>
          ) : null}
          <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
            <p className="text-sm font-semibold text-muted">Job address + commissioning date</p>
            <p className="mt-1 text-xs text-muted-foreground/70">Confirm the property and reference details.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input
                value={fields.job_reference}
                onChange={(e) => setFields((prev) => ({ ...prev, job_reference: e.target.value }))}
                placeholder="Job reference (Cert No.) (optional)"
                className="rounded-2xl"
              />
              <Input
                type="date"
                value={fields.commissioning_date}
                onChange={(e) => setFields((prev) => ({ ...prev, commissioning_date: e.target.value }))}
                placeholder="Commissioning date"
                className="rounded-2xl"
              />
              <Input
                value={fields.job_address_name}
                onChange={(e) => setFields((prev) => ({ ...prev, job_address_name: e.target.value }))}
                placeholder="Job address name"
                className="rounded-2xl sm:col-span-2"
              />
              <Input
                value={fields.job_address_line1}
                onChange={(e) => setFields((prev) => ({ ...prev, job_address_line1: e.target.value }))}
                placeholder="Job address line 1"
                className="rounded-2xl sm:col-span-2"
              />
              <Input
                value={fields.job_address_line2}
                onChange={(e) => setFields((prev) => ({ ...prev, job_address_line2: e.target.value }))}
                placeholder="Job address line 2 (optional)"
                className="rounded-2xl"
              />
              <Input
                value={fields.job_address_city}
                onChange={(e) => setFields((prev) => ({ ...prev, job_address_city: e.target.value }))}
                placeholder="Town/City (optional)"
                className="rounded-2xl"
              />
              <Input
                value={fields.job_postcode}
                onChange={(e) => setFields((prev) => ({ ...prev, job_postcode: e.target.value }))}
                placeholder="Postcode"
                className="rounded-2xl"
              />
              <Input
                value={fields.job_tel}
                onChange={(e) => setFields((prev) => ({ ...prev, job_tel: e.target.value }))}
                placeholder="Job phone (optional)"
                className="rounded-2xl"
              />
            </div>
          </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button className="rounded-full" onClick={() => handleNext(Step1Schema)} disabled={isPending}>
              Next → Appliance
            </Button>
          </div>
        </WizardLayout>
      ) : null}

      {step === 2 ? (
        <WizardLayout step={offsetStep(2)} total={totalSteps} title="Appliance details" status="Commissioning" onBack={() => setStep(1)}>
          <div className="space-y-4">
          {demoEnabled ? (
            <div className="mb-3 flex justify-end">
              <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
                Fill demo Commissioning
              </Button>
            </div>
          ) : null}
          <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
            <p className="text-sm font-semibold text-muted">Appliance</p>
            <p className="mt-1 text-xs text-muted-foreground/70">Capture boiler and flue information.</p>
            <div className="mt-4 space-y-4">
              <ApplianceStep
                appliance={{
                  type: fields.appliance_type,
                  make: fields.appliance_make,
                  model: fields.appliance_model,
                  location: fields.appliance_location,
                  serial: fields.appliance_serial,
                }}
                onApplianceChange={(next) =>
                  setFields((prev) => ({
                    ...prev,
                    appliance_type: next.type ?? '',
                    appliance_make: next.make ?? '',
                    appliance_model: next.model ?? '',
                    appliance_location: next.location ?? '',
                    appliance_serial: next.serial ?? '',
                  }))
                }
                typeOptions={APPLIANCE_TYPE_OPTIONS}
                showExtendedFields
                inlineEditor
                allowMultiple={false}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={fields.gc_number}
                  onChange={(e) => setFields((prev) => ({ ...prev, gc_number: e.target.value }))}
                  placeholder="GC number (optional)"
                  className="rounded-2xl"
                />
                <Input
                  value={fields.flue_type}
                  onChange={(e) => setFields((prev) => ({ ...prev, flue_type: e.target.value }))}
                  placeholder="Flue type (optional)"
                  className="rounded-2xl"
                />
                <label className="flex items-center gap-3 text-sm text-muted sm:col-span-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--accent)]"
                    checked={fields.landlord_equipment}
                    onChange={(e) => setFields((prev) => ({ ...prev, landlord_equipment: e.target.checked }))}
                  />
                  Landlord equipment
                </label>
              </div>
            </div>
          </div>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => setStep(1)}>
              ← Back
            </Button>
            <Button className="rounded-full" onClick={() => handleNext(Step2Schema)} disabled={isPending}>
              Next → Safety
            </Button>
          </div>
        </WizardLayout>
      ) : null}

      {step === 3 ? (
        <WizardLayout step={offsetStep(3)} total={totalSteps} title="Safety + gas checks" status="Commissioning" onBack={() => setStep(2)}>
          <div className="space-y-4">
          {demoEnabled ? (
            <div className="mb-3 flex justify-end">
              <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
                Fill demo Commissioning
              </Button>
            </div>
          ) : null}
          <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
            <p className="text-sm font-semibold text-muted">Safety + combustion</p>
            <p className="mt-1 text-xs text-muted-foreground/70">Record combustion readings, gas pressures, and checks.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <ChecksStep
                  values={{
                    heat_input: fields.heat_input,
                    gas_rate: fields.gas_rate,
                  }}
                  onChange={(updates) =>
                    setFields((prev) => ({
                      ...prev,
                      heat_input: updates.heat_input ?? prev.heat_input,
                      gas_rate: updates.gas_rate ?? prev.gas_rate,
                    }))
                  }
                  gasRateUnit="m³/h"
                  gasRateLabel="Gas rate"
                  heatInputLabel="Heat input"
                />
              </div>
              <UnitNumberInput
                label="Running set point temp"
                unit="°C"
                value={fields.running_set_point_temp}
                onChange={(value) => setFields((prev) => ({ ...prev, running_set_point_temp: value }))}
                placeholder="Running set point temp (optional)"
              />
              <div className="sm:col-span-2 grid gap-3 rounded-2xl border border-white/40 bg-white/70 p-4 sm:grid-cols-2">
                {safetyChecks.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 text-sm text-muted">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--accent)]"
                      checked={fields[key]}
                      onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <UnitNumberInput
                label="Standing pressure at gas meter"
                unit="mbar"
                value={fields.gas_meter_pressure}
                onChange={(value) => setFields((prev) => ({ ...prev, gas_meter_pressure: value }))}
                placeholder="Standing pressure at gas meter (optional)"
              />
              <UnitNumberInput
                label="Standing pressure at appliance inlet"
                unit="mbar"
                value={fields.inlet_test_point_pressure}
                onChange={(value) => setFields((prev) => ({ ...prev, inlet_test_point_pressure: value }))}
                placeholder="Standing pressure at appliance inlet (optional)"
              />
              <UnitNumberInput
                label="Working pressure at gas meter max rate"
                unit="mbar"
                value={fields.max_rate_gas_meter_pressure}
                onChange={(value) => setFields((prev) => ({ ...prev, max_rate_gas_meter_pressure: value }))}
                placeholder="Working pressure at gas meter max rate (optional)"
              />
              <UnitNumberInput
                label="Working pressure at appliance inlet max rate"
                unit="mbar"
                value={fields.inlet_test_point_max_rate_pressure}
                onChange={(value) => setFields((prev) => ({ ...prev, inlet_test_point_max_rate_pressure: value }))}
                placeholder="Working pressure at appliance inlet max rate (optional)"
              />
              <div className="sm:col-span-2 mt-2 text-sm font-semibold text-muted">Combustion readings (high)</div>
              <UnitNumberInput
                label="CO (high)"
                unit="ppm"
                value={fields.high_combustion_co_ppm}
                onChange={(value) => setFields((prev) => ({ ...prev, high_combustion_co_ppm: value }))}
                placeholder="CO ppm (optional)"
              />
              <UnitNumberInput
                label="CO2 (high)"
                unit="%"
                value={fields.high_combustion_co2}
                onChange={(value) => setFields((prev) => ({ ...prev, high_combustion_co2: value }))}
                placeholder="CO2 % (optional)"
              />
              <Input
                value={fields.high_combustion_ratio}
                onChange={(e) => setFields((prev) => ({ ...prev, high_combustion_ratio: e.target.value }))}
                placeholder="CO/CO2 ratio (optional)"
                className="rounded-2xl"
              />
              <div className="sm:col-span-2 mt-2 text-sm font-semibold text-muted">Combustion readings (low)</div>
              <UnitNumberInput
                label="CO (low)"
                unit="ppm"
                value={fields.low_combustion_co_ppm}
                onChange={(value) => setFields((prev) => ({ ...prev, low_combustion_co_ppm: value }))}
                placeholder="CO ppm (optional)"
              />
              <UnitNumberInput
                label="CO2 (low)"
                unit="%"
                value={fields.low_combustion_co2}
                onChange={(value) => setFields((prev) => ({ ...prev, low_combustion_co2: value }))}
                placeholder="CO2 % (optional)"
              />
              <Input
                value={fields.low_combustion_ratio}
                onChange={(e) => setFields((prev) => ({ ...prev, low_combustion_ratio: e.target.value }))}
                placeholder="CO/CO2 ratio (optional)"
                className="rounded-2xl"
              />
            </div>
          </div>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => setStep(2)}>
              ← Back
            </Button>
            <Button className="rounded-full" onClick={() => handleNext(z.object({}))} disabled={isPending}>
              Next → Comments
            </Button>
          </div>
        </WizardLayout>
      ) : null}

      {step === 4 ? (
        <WizardLayout step={offsetStep(4)} total={totalSteps} title="Comments + sign-off" status="Commissioning" onBack={() => setStep(3)}>
          <div className="space-y-4">
          {demoEnabled ? (
            <div className="mb-3 flex justify-end">
              <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
                Fill demo Commissioning
              </Button>
            </div>
          ) : null}
          <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
            <p className="text-sm font-semibold text-muted">Comments + sign-off</p>
            <p className="mt-1 text-xs text-muted-foreground/70">Capture commissioning comments and printed names.</p>
            <div className="mt-4 grid gap-3">
              <Textarea
                value={fields.engineer_comments}
                onChange={(e) => setFields((prev) => ({ ...prev, engineer_comments: e.target.value }))}
                placeholder="Engineer's comments (optional)"
                className="min-h-[90px] rounded-2xl"
              />
              <div className="rounded-2xl border border-white/40 bg-white/70 p-4">
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
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={fields.engineer_name}
                  onChange={(e) => setFields((prev) => ({ ...prev, engineer_name: e.target.value }))}
                  placeholder="Engineer name"
                  className="rounded-2xl"
                />
                <Input
                  value={fields.gas_safe_number}
                  onChange={(e) => setFields((prev) => ({ ...prev, gas_safe_number: e.target.value }))}
                  placeholder="Gas Safe registration number"
                  className="rounded-2xl"
                />
                <Input
                  value={fields.engineer_id_card_number}
                  onChange={(e) => setFields((prev) => ({ ...prev, engineer_id_card_number: e.target.value }))}
                  placeholder="Engineer ID card number (optional)"
                  className="rounded-2xl"
                />
                <Input
                  value={fields.company_name}
                  onChange={(e) => setFields((prev) => ({ ...prev, company_name: e.target.value }))}
                  placeholder="Company name (optional)"
                  className="rounded-2xl"
                />
                <Input
                  value={fields.print_name_issued}
                  onChange={(e) => setFields((prev) => ({ ...prev, print_name_issued: e.target.value }))}
                  placeholder="Issued by (print name)"
                  className="rounded-2xl"
                />
                <Input
                  value={fields.print_name_received}
                  onChange={(e) => setFields((prev) => ({ ...prev, print_name_received: e.target.value }))}
                  placeholder="Received by (print name) (optional)"
                  className="rounded-2xl"
                />
                <Input
                  type="date"
                  value={fields.commissioning_date}
                  onChange={(e) => setFields((prev) => ({ ...prev, commissioning_date: e.target.value }))}
                  placeholder="Commissioning date"
                  className="rounded-2xl"
                />
                <Input
                  type="date"
                  value={fields.next_service_due}
                  onChange={(e) => setFields((prev) => ({ ...prev, next_service_due: e.target.value }))}
                  placeholder="Next service due (optional)"
                  className="rounded-2xl"
                />
              </div>
            </div>
          </div>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => setStep(3)}>
              ← Back
            </Button>
            <Button variant="outline" className="rounded-full" onClick={handlePreview} disabled={isPending}>
              Preview PDF
            </Button>
            <Button className="rounded-full" onClick={handleGenerate} disabled={isPending}>
              {isPending ? 'Generating...' : 'Generate checklist'}
            </Button>
          </div>
        </WizardLayout>
      ) : null}
    </>
  );
}
