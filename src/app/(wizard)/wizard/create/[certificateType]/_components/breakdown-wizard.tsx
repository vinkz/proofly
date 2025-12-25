'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

import { WizardLayout } from '@/components/certificates/wizard-layout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { EvidenceCard } from './evidence-card';
import { ApplianceStep } from '@/components/wizard/steps/appliance-step';
import { ChecksStep } from '@/components/wizard/steps/checks-step';
import { UnitNumberInput } from '@/components/wizard/inputs/unit-number-input';
import { createGasBreakdownReport } from '@/server/jobs';
import { uploadJobPhoto } from '@/server/certificates';
import { mergeJobContextFields, type InitialJobContext } from './initial-job-context';
import type { PhotoCategory } from '@/types/certificates';

type BreakdownWizardProps = {
  jobId: string;
  initialFields: Record<string, string | null | undefined>;
  initialJobContext?: InitialJobContext | null;
  stepOffset?: number;
};

type BreakdownFormState = {
  job_reference: string;
  job_visit_date: string;
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
  client_city: string;
  client_postcode: string;
  client_tel: string;
  client_email: string;
  landlord_name: string;
  landlord_address: string;
  engineer_name: string;
  company_name: string;
  company_address_line1: string;
  company_address_line2: string;
  company_city: string;
  company_postcode: string;
  company_tel: string;
  gas_safe_number: string;
  engineer_id_card_number: string;
  appliance_type: string;
  appliance_make: string;
  appliance_model: string;
  appliance_location: string;
  appliance_serial: string;
  combustion_co: string;
  combustion_co2: string;
  combustion_ratio: string;
  safety_operating_correctly: boolean;
  safety_conforms_standards: boolean;
  safety_notice_explained: boolean;
  safety_controls_checked: boolean;
  operating_pressure: string;
  heat_input: string;
  reported_issue: string;
  diagnostics: string;
  actions_taken: string;
  flueing_safe: boolean;
  ventilation_safe: boolean;
  combustion_test: boolean;
  burner_pressure_correct: boolean;
  tightness_test: boolean;
  fault_location: string;
  part_fitted: string;
  fault_resolved: boolean;
  parts_required: string;
  advice_appliance_safe: boolean;
  advice_system_improvements: boolean;
  advice_all_parts_available: boolean;
  advice_replacement_recommended: boolean;
  advice_magnetic_filter: boolean;
  advice_co_alarm: boolean;
  advice_text: string;
  engineer_comments: string;
  issued_by_name: string;
  received_by_name: string;
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

const Step1Schema = z
  .object({
    job_reference: z.string().min(1, 'Job reference is required'),
    job_visit_date: z.string().min(1, 'Visit date is required'),
    job_address_line1: z.string().min(1, 'Job address line 1 is required'),
    job_postcode: z.string().min(1, 'Job postcode is required'),
    client_name: z.string().min(1, 'Client name is required'),
    client_tel: z.string().optional(),
    client_email: z.string().optional(),
  })
  .refine((data) => Boolean(data.client_tel?.trim() || data.client_email?.trim()), {
    message: 'Client phone or email is required',
    path: ['client_tel'],
  });

const Step2Schema = z.object({
  engineer_name: z.string().min(1, 'Engineer name is required'),
  company_name: z.string().min(1, 'Company name is required'),
  gas_safe_number: z.string().min(1, 'Gas Safe number is required'),
});

const Step3Schema = z.object({
  appliance_type: z.string().min(1, 'Appliance type is required'),
  appliance_make: z.string().min(1, 'Appliance make is required'),
  appliance_model: z.string().min(1, 'Appliance model is required'),
  appliance_location: z.string().min(1, 'Appliance location is required'),
  appliance_serial: z.string().min(1, 'Appliance serial is required'),
});

const Step4Schema = z.object({
  operating_pressure: z.string().min(1, 'Operating pressure is required'),
  heat_input: z.string().min(1, 'Heat input is required'),
  reported_issue: z.string().min(1, 'Reported issue is required'),
  diagnostics: z.string().min(1, 'Diagnostics are required'),
  actions_taken: z.string().min(1, 'Actions taken are required'),
  fault_location: z.string().min(1, 'Fault location is required'),
  fault_resolved: z.boolean(),
});

const Step5Schema = z.object({
  issued_by_name: z.string().min(1, 'Issued by name is required'),
});

const RequiredSchema = Step1Schema.merge(Step2Schema).merge(Step3Schema).merge(Step4Schema).merge(Step5Schema);

const APPLIANCE_TYPE_OPTIONS = [
  { label: 'Combi', value: 'combi' },
  { label: 'System', value: 'system' },
  { label: 'Regular', value: 'regular' },
  { label: 'Other', value: 'other' },
];

export function BreakdownWizard({ jobId, initialFields, initialJobContext = null, stepOffset = 0 }: BreakdownWizardProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const resolvedFields = mergeJobContextFields(initialFields, initialJobContext);
  const today = new Date().toISOString().slice(0, 10);
  const demoEnabled = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const totalSteps = 5 + stepOffset;
  const offsetStep = (value: number) => value + stepOffset;

  const [fields, setFields] = useState<BreakdownFormState>({
    job_reference: pickText(resolvedFields.job_reference, resolvedFields.cert_no, resolvedFields.record_id),
    job_visit_date: pickText(toDateInput(resolvedFields.job_visit_date), toDateInput(resolvedFields.service_date), today),
    job_address_name: toText(resolvedFields.property_name),
    job_address_line1: toText(resolvedFields.property_address),
    job_address_line2: toText(resolvedFields.property_address_line2),
    job_address_city: toText(resolvedFields.property_town),
    job_postcode: toText(resolvedFields.postcode),
    job_tel: toText(resolvedFields.job_phone),
    client_name: toText(resolvedFields.customer_name),
    client_company: toText(resolvedFields.customer_company),
    client_address_line1: toText(resolvedFields.customer_address),
    client_address_line2: toText(resolvedFields.customer_address_line2),
    client_city: toText(resolvedFields.customer_town),
    client_postcode: toText(resolvedFields.postcode),
    client_tel: pickText(resolvedFields.customer_phone, resolvedFields.customer_contact),
    client_email: toText(resolvedFields.customer_email),
    landlord_name: toText(resolvedFields.landlord_name),
    landlord_address: toText(resolvedFields.landlord_address),
    engineer_name: toText(resolvedFields.engineer_name),
    company_name: pickText(resolvedFields.company_name, resolvedFields.engineer_company),
    company_address_line1: toText(resolvedFields.company_address_line1),
    company_address_line2: toText(resolvedFields.company_address_line2),
    company_city: toText(resolvedFields.company_town),
    company_postcode: toText(resolvedFields.company_postcode),
    company_tel: toText(resolvedFields.company_phone),
    gas_safe_number: toText(resolvedFields.gas_safe_number),
    engineer_id_card_number: toText(resolvedFields.engineer_id_card_number),
    appliance_type: toText(resolvedFields.appliance_type),
    appliance_make: toText(resolvedFields.appliance_make),
    appliance_model: toText(resolvedFields.appliance_model),
    appliance_location: toText(resolvedFields.appliance_location),
    appliance_serial: toText(resolvedFields.serial_no),
    combustion_co: toText(resolvedFields.combustion_co),
    combustion_co2: toText(resolvedFields.combustion_co2),
    combustion_ratio: toText(resolvedFields.combustion_ratio),
    safety_operating_correctly: resolvedFields.safety_operating_correctly === 'true',
    safety_conforms_standards: resolvedFields.safety_conforms_standards === 'true',
    safety_notice_explained: resolvedFields.safety_notice_explained === 'true',
    safety_controls_checked: resolvedFields.safety_controls_checked === 'true',
    operating_pressure: toText(resolvedFields.operating_pressure),
    heat_input: toText(resolvedFields.heat_input),
    reported_issue: toText(resolvedFields.reported_issue),
    diagnostics: toText(resolvedFields.diagnostics),
    actions_taken: toText(resolvedFields.actions_taken),
    flueing_safe: resolvedFields.flueing_safe === 'true',
    ventilation_safe: resolvedFields.ventilation_safe === 'true',
    combustion_test: resolvedFields.combustion_test === 'true',
    burner_pressure_correct: resolvedFields.burner_pressure_correct === 'true',
    tightness_test: resolvedFields.tightness_test === 'true',
    fault_location: toText(resolvedFields.fault_location),
    part_fitted: toText(resolvedFields.part_fitted),
    fault_resolved: resolvedFields.fault_resolved === 'true',
    parts_required: toText(resolvedFields.parts_required),
    advice_appliance_safe: resolvedFields.advice_appliance_safe === 'true',
    advice_system_improvements: resolvedFields.advice_system_improvements === 'true',
    advice_all_parts_available: resolvedFields.advice_all_parts_available === 'true',
    advice_replacement_recommended: resolvedFields.advice_replacement_recommended === 'true',
    advice_magnetic_filter: resolvedFields.advice_magnetic_filter === 'true',
    advice_co_alarm: resolvedFields.advice_co_alarm === 'true',
    advice_text: toText(resolvedFields.advice_text),
    engineer_comments: toText(resolvedFields.engineer_comments),
    issued_by_name: pickText(resolvedFields.issued_by_name, resolvedFields.engineer_name),
    received_by_name: pickText(resolvedFields.received_by_name, resolvedFields.customer_name),
  });

  const handleDemoFill = () => {
    if (!demoEnabled) return;
    const demo: BreakdownFormState = {
      job_reference: fields.job_reference || 'CN-102345',
      job_visit_date: today,
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
      client_city: 'London',
      client_postcode: 'E10 6AA',
      client_tel: '07123 456789',
      client_email: 'jamie@example.com',
      landlord_name: 'Sam Patel',
      landlord_address: '1 Market Rd, London E10 7AB',
      engineer_name: 'Alex Turner',
      company_name: 'CertNow Heating',
      company_address_line1: 'Unit 3',
      company_address_line2: 'Park Industrial Estate',
      company_city: 'London',
      company_postcode: 'E7 9AB',
      company_tel: '020 7946 0011',
      gas_safe_number: '123456',
      engineer_id_card_number: 'GS-987654',
      appliance_type: 'Combi boiler',
      appliance_make: 'Worcester Bosch',
      appliance_model: 'Greenstar 30i',
      appliance_location: 'Kitchen cupboard',
      appliance_serial: 'WB30I-84736291',
      combustion_co: '35',
      combustion_co2: '9.2',
      combustion_ratio: '0.0038',
      safety_operating_correctly: true,
      safety_conforms_standards: true,
      safety_notice_explained: false,
      safety_controls_checked: true,
      operating_pressure: '20',
      heat_input: '24',
      reported_issue: 'No hot water, intermittent ignition.',
      diagnostics: 'Checked PCB and ignition sequence. Gas valve tested.',
      actions_taken: 'Reset boiler and cleaned condensate trap.',
      flueing_safe: true,
      ventilation_safe: true,
      combustion_test: true,
      burner_pressure_correct: true,
      tightness_test: true,
      fault_location: 'Ignition electrode',
      part_fitted: 'Ignition electrode',
      fault_resolved: true,
      parts_required: 'None',
      advice_appliance_safe: true,
      advice_system_improvements: false,
      advice_all_parts_available: true,
      advice_replacement_recommended: false,
      advice_magnetic_filter: true,
      advice_co_alarm: true,
      advice_text: 'Recommend annual service and CO alarm test.',
      engineer_comments: 'System operating normally after part replacement.',
      issued_by_name: 'Alex Turner',
      received_by_name: 'Jamie Collins',
    };
    setFields(demo);
    pushToast({ title: 'Breakdown demo filled', variant: 'success' });
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
        const result = await createGasBreakdownReport({
          jobId,
          fields,
        });
        pushToast({
          title: 'Breakdown record generated',
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
          title: 'Could not generate breakdown record',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const safetyChecksLeft = [
    { key: 'safety_operating_correctly', label: 'Operating correctly' },
    { key: 'safety_conforms_standards', label: 'Conforms to safety standards' },
    { key: 'safety_notice_explained', label: 'Warning/advice notice explained and left' },
    { key: 'safety_controls_checked', label: 'Controls checked/adjusted' },
  ] as const;

  const safetyChecksRight = [
    { key: 'flueing_safe', label: 'Flueing safe' },
    { key: 'ventilation_safe', label: 'Ventilation safe' },
    { key: 'combustion_test', label: 'Emission/combustion test' },
    { key: 'burner_pressure_correct', label: 'Burner pressure/gas rate correct' },
    { key: 'tightness_test', label: 'Tightness test carried out' },
  ] as const;

  const adviceChecks = [
    { key: 'advice_appliance_safe', label: 'Appliance is safe' },
    { key: 'advice_system_improvements', label: 'System improvements recommended' },
    { key: 'advice_all_parts_available', label: 'All functional parts available' },
    { key: 'advice_replacement_recommended', label: 'Recommended appliance replacement' },
    { key: 'advice_magnetic_filter', label: 'Magnetic filter fitted' },
    { key: 'advice_co_alarm', label: 'CO alarm fitted' },
  ] as const;

  return (
    <>
      {step === 1 ? (
        <WizardLayout step={offsetStep(1)} total={totalSteps} title="Job + client" status="Breakdown">
          {demoEnabled ? (
            <div className="mb-3 flex justify-end">
              <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
                Fill demo Breakdown
              </Button>
            </div>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Job + property</CardTitle>
              <CardDescription>Confirm the job reference and client/property details.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={fields.job_reference}
                  onChange={(e) => setFields((prev) => ({ ...prev, job_reference: e.target.value }))}
                  placeholder="Job reference (Cert No)"
                />
                <Input
                  type="date"
                  value={fields.job_visit_date}
                  onChange={(e) => setFields((prev) => ({ ...prev, job_visit_date: e.target.value }))}
                  placeholder="Visit date"
                />
                <Input
                  value={fields.job_address_name}
                  onChange={(e) => setFields((prev) => ({ ...prev, job_address_name: e.target.value }))}
                  placeholder="Job address name (optional)"
                  className="sm:col-span-2"
                />
                <Input
                  value={fields.job_address_line1}
                  onChange={(e) => setFields((prev) => ({ ...prev, job_address_line1: e.target.value }))}
                  placeholder="Job address line 1"
                  className="sm:col-span-2"
                />
                <Input
                  value={fields.job_address_line2}
                  onChange={(e) => setFields((prev) => ({ ...prev, job_address_line2: e.target.value }))}
                  placeholder="Job address line 2 (optional)"
                />
                <Input
                  value={fields.job_address_city}
                  onChange={(e) => setFields((prev) => ({ ...prev, job_address_city: e.target.value }))}
                  placeholder="Town/City (optional)"
                />
                <Input
                  value={fields.job_postcode}
                  onChange={(e) => setFields((prev) => ({ ...prev, job_postcode: e.target.value }))}
                  placeholder="Postcode"
                />
                <Input
                  value={fields.job_tel}
                  onChange={(e) => setFields((prev) => ({ ...prev, job_tel: e.target.value }))}
                  placeholder="Job phone (optional)"
                />
                <div className="sm:col-span-2 mt-3 border-t border-white/10 pt-3 text-sm font-semibold text-muted">
                  Client / Landlord
                </div>
                <Input
                  value={fields.client_name}
                  onChange={(e) => setFields((prev) => ({ ...prev, client_name: e.target.value }))}
                  placeholder="Client name"
                />
                <Input
                  value={fields.client_company}
                  onChange={(e) => setFields((prev) => ({ ...prev, client_company: e.target.value }))}
                  placeholder="Client company (optional)"
                />
                <Input
                  value={fields.client_address_line1}
                  onChange={(e) => setFields((prev) => ({ ...prev, client_address_line1: e.target.value }))}
                  placeholder="Client address line 1"
                  className="sm:col-span-2"
                />
                <Input
                  value={fields.client_address_line2}
                  onChange={(e) => setFields((prev) => ({ ...prev, client_address_line2: e.target.value }))}
                  placeholder="Client address line 2 (optional)"
                />
                <Input
                  value={fields.client_city}
                  onChange={(e) => setFields((prev) => ({ ...prev, client_city: e.target.value }))}
                  placeholder="Town/City (optional)"
                />
                <Input
                  value={fields.client_postcode}
                  onChange={(e) => setFields((prev) => ({ ...prev, client_postcode: e.target.value }))}
                  placeholder="Client postcode (optional)"
                />
                <Input
                  value={fields.client_tel}
                  onChange={(e) => setFields((prev) => ({ ...prev, client_tel: e.target.value }))}
                  placeholder="Client phone"
                />
                <Input
                  value={fields.client_email}
                  onChange={(e) => setFields((prev) => ({ ...prev, client_email: e.target.value }))}
                  placeholder="Client email (optional)"
                />
                <Input
                  value={fields.landlord_name}
                  onChange={(e) => setFields((prev) => ({ ...prev, landlord_name: e.target.value }))}
                  placeholder="Landlord name (optional)"
                />
                <Input
                  value={fields.landlord_address}
                  onChange={(e) => setFields((prev) => ({ ...prev, landlord_address: e.target.value }))}
                  placeholder="Landlord address (optional)"
                  className="sm:col-span-2"
                />
              </div>
            </CardContent>
            <CardFooter className="justify-between">
              <Button asChild variant="outline" className="rounded-full">
                <Link href={`/jobs/${jobId}`}>Back to job</Link>
              </Button>
              <Button className="rounded-full" onClick={() => handleNext(Step1Schema)} disabled={isPending}>
                Next → Company
              </Button>
            </CardFooter>
          </Card>
        </WizardLayout>
      ) : null}

      {step === 2 ? (
        <WizardLayout step={offsetStep(2)} total={totalSteps} title="Company + engineer" status="Breakdown" onBack={() => setStep(1)}>
          {demoEnabled ? (
            <div className="mb-3 flex justify-end">
              <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
                Fill demo Breakdown
              </Button>
            </div>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Company + engineer</CardTitle>
              <CardDescription>Confirm installer and Gas Safe details.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={fields.engineer_name}
                  onChange={(e) => setFields((prev) => ({ ...prev, engineer_name: e.target.value }))}
                  placeholder="Engineer name"
                />
                <Input
                  value={fields.gas_safe_number}
                  onChange={(e) => setFields((prev) => ({ ...prev, gas_safe_number: e.target.value }))}
                  placeholder="Gas Safe registration number"
                />
                <Input
                  value={fields.engineer_id_card_number}
                  onChange={(e) => setFields((prev) => ({ ...prev, engineer_id_card_number: e.target.value }))}
                  placeholder="Engineer ID card number (optional)"
                />
                <Input
                  value={fields.company_name}
                  onChange={(e) => setFields((prev) => ({ ...prev, company_name: e.target.value }))}
                  placeholder="Company name"
                />
                <Input
                  value={fields.company_address_line1}
                  onChange={(e) => setFields((prev) => ({ ...prev, company_address_line1: e.target.value }))}
                  placeholder="Company address line 1"
                  className="sm:col-span-2"
                />
                <Input
                  value={fields.company_address_line2}
                  onChange={(e) => setFields((prev) => ({ ...prev, company_address_line2: e.target.value }))}
                  placeholder="Company address line 2 (optional)"
                />
                <Input
                  value={fields.company_city}
                  onChange={(e) => setFields((prev) => ({ ...prev, company_city: e.target.value }))}
                  placeholder="Town/City (optional)"
                />
                <Input
                  value={fields.company_postcode}
                  onChange={(e) => setFields((prev) => ({ ...prev, company_postcode: e.target.value }))}
                  placeholder="Company postcode (optional)"
                />
                <Input
                  value={fields.company_tel}
                  onChange={(e) => setFields((prev) => ({ ...prev, company_tel: e.target.value }))}
                  placeholder="Company phone (optional)"
                />
              </div>
            </CardContent>
            <CardFooter className="justify-between">
              <Button variant="outline" className="rounded-full" onClick={() => setStep(1)}>
                ← Back
              </Button>
              <Button className="rounded-full" onClick={() => handleNext(Step2Schema)} disabled={isPending}>
                Next → Appliance
              </Button>
            </CardFooter>
          </Card>
        </WizardLayout>
      ) : null}

      {step === 3 ? (
        <WizardLayout step={offsetStep(3)} total={totalSteps} title="Appliance details" status="Breakdown" onBack={() => setStep(2)}>
          {demoEnabled ? (
            <div className="mb-3 flex justify-end">
              <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
                Fill demo Breakdown
              </Button>
            </div>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Appliance</CardTitle>
              <CardDescription>Capture appliance details and combustion readings.</CardDescription>
            </CardHeader>
          <CardContent>
              <div className="space-y-4">
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
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <UnitNumberInput
                    label="CO reading"
                    unit="ppm"
                    value={fields.combustion_co}
                    onChange={(value) => setFields((prev) => ({ ...prev, combustion_co: value }))}
                    placeholder="CO (ppm) (optional)"
                  />
                  <UnitNumberInput
                    label="CO2 reading"
                    unit="%"
                    value={fields.combustion_co2}
                    onChange={(value) => setFields((prev) => ({ ...prev, combustion_co2: value }))}
                    placeholder="CO2 (%) (optional)"
                  />
                  <Input
                    value={fields.combustion_ratio}
                    onChange={(e) => setFields((prev) => ({ ...prev, combustion_ratio: e.target.value }))}
                    placeholder="CO/CO2 ratio (optional)"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-between">
              <Button variant="outline" className="rounded-full" onClick={() => setStep(2)}>
                ← Back
              </Button>
              <Button className="rounded-full" onClick={() => handleNext(Step3Schema)} disabled={isPending}>
                Next → Safety
              </Button>
            </CardFooter>
          </Card>
        </WizardLayout>
      ) : null}

      {step === 4 ? (
        <WizardLayout step={offsetStep(4)} total={totalSteps} title="Safety checks" status="Breakdown" onBack={() => setStep(3)}>
          {demoEnabled ? (
            <div className="mb-3 flex justify-end">
              <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
                Fill demo Breakdown
              </Button>
            </div>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Safety + breakdown</CardTitle>
              <CardDescription>Record safety checks and breakdown details.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <ChecksStep
                    values={{
                      operating_pressure: fields.operating_pressure,
                      heat_input: fields.heat_input,
                    }}
                    onChange={(updates) =>
                      setFields((prev) => ({
                        ...prev,
                        operating_pressure: updates.operating_pressure ?? prev.operating_pressure,
                        heat_input: updates.heat_input ?? prev.heat_input,
                      }))
                    }
                    operatingPressureLabel="Operating pressure"
                  />
                </div>
                <Textarea
                  value={fields.reported_issue}
                  onChange={(e) => setFields((prev) => ({ ...prev, reported_issue: e.target.value }))}
                  placeholder="Reported issue"
                  className="min-h-[90px] sm:col-span-2"
                />
                <Textarea
                  value={fields.diagnostics}
                  onChange={(e) => setFields((prev) => ({ ...prev, diagnostics: e.target.value }))}
                  placeholder="Diagnostics carried out"
                  className="min-h-[90px] sm:col-span-2"
                />
                <Textarea
                  value={fields.actions_taken}
                  onChange={(e) => setFields((prev) => ({ ...prev, actions_taken: e.target.value }))}
                  placeholder="Actions taken"
                  className="min-h-[90px] sm:col-span-2"
                />
                <div className="sm:col-span-2 grid gap-3 rounded-2xl border border-white/40 bg-white/70 p-4 sm:grid-cols-2">
                  {safetyChecksLeft.map(({ key, label }) => (
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
                  {safetyChecksRight.map(({ key, label }) => (
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
                <Input
                  value={fields.fault_location}
                  onChange={(e) => setFields((prev) => ({ ...prev, fault_location: e.target.value }))}
                  placeholder="Location of fault"
                  className="sm:col-span-2"
                />
                <Input
                  value={fields.part_fitted}
                  onChange={(e) => setFields((prev) => ({ ...prev, part_fitted: e.target.value }))}
                  placeholder="Part fitted (optional)"
                />
                <Input
                  value={fields.parts_required}
                  onChange={(e) => setFields((prev) => ({ ...prev, parts_required: e.target.value }))}
                  placeholder="Parts required (optional)"
                />
                <label className="flex items-center gap-3 text-sm text-muted sm:col-span-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--accent)]"
                    checked={fields.fault_resolved}
                    onChange={(e) => setFields((prev) => ({ ...prev, fault_resolved: e.target.checked }))}
                  />
                  Fault resolved
                </label>
              </div>
            </CardContent>
            <CardFooter className="justify-between">
              <Button variant="outline" className="rounded-full" onClick={() => setStep(3)}>
                ← Back
              </Button>
              <Button className="rounded-full" onClick={() => handleNext(Step4Schema)} disabled={isPending}>
                Next → Advice
              </Button>
            </CardFooter>
          </Card>
        </WizardLayout>
      ) : null}

      {step === 5 ? (
        <WizardLayout step={offsetStep(5)} total={totalSteps} title="Advice + sign-off" status="Breakdown" onBack={() => setStep(4)}>
          {demoEnabled ? (
            <div className="mb-3 flex justify-end">
              <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
                Fill demo Breakdown
              </Button>
            </div>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Advice + sign-off</CardTitle>
              <CardDescription>Capture advice, recommendations, and printed names.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <div className="grid gap-3 rounded-2xl border border-white/40 bg-white/70 p-4 sm:grid-cols-2">
                  {adviceChecks.map(({ key, label }) => (
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
                <Textarea
                  value={fields.advice_text}
                  onChange={(e) => setFields((prev) => ({ ...prev, advice_text: e.target.value }))}
                  placeholder="Advice and recommendations (optional)"
                  className="min-h-[90px]"
                />
                <Textarea
                  value={fields.engineer_comments}
                  onChange={(e) => setFields((prev) => ({ ...prev, engineer_comments: e.target.value }))}
                  placeholder="Engineer comments (optional)"
                  className="min-h-[90px]"
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
                    value={fields.issued_by_name}
                    onChange={(e) => setFields((prev) => ({ ...prev, issued_by_name: e.target.value }))}
                    placeholder="Issued by (print name)"
                  />
                  <Input
                    value={fields.received_by_name}
                    onChange={(e) => setFields((prev) => ({ ...prev, received_by_name: e.target.value }))}
                    placeholder="Received by (print name) (optional)"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-between">
              <Button variant="outline" className="rounded-full" onClick={() => setStep(4)}>
                ← Back
              </Button>
              <Button className="rounded-full" onClick={handleGenerate} disabled={isPending}>
                {isPending ? 'Generating...' : 'Generate record'}
              </Button>
            </CardFooter>
          </Card>
        </WizardLayout>
      ) : null}
    </>
  );
}
