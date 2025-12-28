'use client';

import { useState, useTransition } from 'react';
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
import type { CertificateType, PhotoCategory } from '@/types/certificates';
import { mergeJobContextFields, type InitialJobContext } from './initial-job-context';

type GasWarningNoticeWizardProps = {
  jobId: string;
  initialFields: Record<string, string | null | undefined>;
  initialJobContext?: InitialJobContext | null;
  certificateType: CertificateType;
  stepOffset?: number;
};

type GasWarningFormState = {
  property_address: string;
  postcode: string;
  customer_name: string;
  customer_contact: string;
  appliance_location: string;
  appliance_type: string;
  make_model: string;
  gas_supply_isolated: boolean;
  appliance_capped_off: boolean;
  customer_refused_isolation: boolean;
  classification: GasWarningClassification | '';
  classification_code: string;
  unsafe_situation_description: string;
  underlying_cause: string;
  actions_taken: string;
  emergency_services_contacted: boolean;
  emergency_reference: string;
  danger_do_not_use_label_fitted: boolean;
  meter_or_appliance_tagged: boolean;
  customer_informed: boolean;
  customer_understands_risks: boolean;
  customer_signed_at: string;
  engineer_name: string;
  engineer_company: string;
  gas_safe_number: string;
  engineer_id_card_number: string;
  issued_at: string;
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

export function GasWarningNoticeWizard({
  jobId,
  initialFields,
  initialJobContext = null,
  certificateType,
  stepOffset = 0,
}: GasWarningNoticeWizardProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const resolvedFields = mergeJobContextFields(initialFields, initialJobContext);
  const demoEnabled = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const totalSteps = 3 + stepOffset;
  const offsetStep = (value: number) => value + stepOffset;

  const [fields, setFields] = useState<GasWarningFormState>({
    property_address: resolvedFields.property_address ?? '',
    postcode: resolvedFields.postcode ?? '',
    customer_name: resolvedFields.customer_name ?? '',
    customer_contact: resolvedFields.customer_contact ?? '',
    appliance_location: resolvedFields.appliance_location ?? '',
    appliance_type: resolvedFields.appliance_type ?? '',
    make_model: resolvedFields.make_model ?? '',
    gas_supply_isolated: parseBool(resolvedFields.gas_supply_isolated),
    appliance_capped_off: parseBool(resolvedFields.appliance_capped_off),
    customer_refused_isolation: parseBool(resolvedFields.customer_refused_isolation),
    classification: (resolvedFields.classification as GasWarningClassification) ?? '',
    classification_code: resolvedFields.classification_code ?? '',
    unsafe_situation_description: resolvedFields.unsafe_situation_description ?? '',
    underlying_cause: resolvedFields.underlying_cause ?? '',
    actions_taken: resolvedFields.actions_taken ?? '',
    emergency_services_contacted: parseBool(resolvedFields.emergency_services_contacted),
    emergency_reference: resolvedFields.emergency_reference ?? '',
    danger_do_not_use_label_fitted: parseBool(resolvedFields.danger_do_not_use_label_fitted),
    meter_or_appliance_tagged: parseBool(resolvedFields.meter_or_appliance_tagged),
    customer_informed: parseBool(resolvedFields.customer_informed),
    customer_understands_risks: parseBool(resolvedFields.customer_understands_risks),
    customer_signed_at: resolvedFields.customer_signed_at ? resolvedFields.customer_signed_at.slice(0, 10) : '',
    engineer_name: resolvedFields.engineer_name ?? '',
    engineer_company: resolvedFields.engineer_company ?? '',
    gas_safe_number: resolvedFields.gas_safe_number ?? '',
    engineer_id_card_number: resolvedFields.engineer_id_card_number ?? '',
    issued_at: resolvedFields.issued_at ? resolvedFields.issued_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
  });

  const [engineerSignature, setEngineerSignature] = useState((resolvedFields.engineer_signature as string) ?? '');
  const [customerSignature, setCustomerSignature] = useState((resolvedFields.customer_signature as string) ?? '');

  const handleDemoFill = () => {
    if (!demoEnabled) return;
    const today = new Date().toISOString().slice(0, 10);
    const demo: GasWarningFormState = {
      property_address: '12 High Street, Leyton',
      postcode: 'E10 6AA',
      customer_name: 'Jamie Collins',
      customer_contact: '07123 456789',
      appliance_location: 'Kitchen cupboard',
      appliance_type: 'Combi boiler',
      make_model: 'Worcester Bosch Greenstar 30i',
      gas_supply_isolated: true,
      appliance_capped_off: false,
      customer_refused_isolation: false,
      classification: 'AT_RISK',
      classification_code: 'AR',
      unsafe_situation_description: 'Flue seal degraded causing minor spillage risk.',
      underlying_cause: 'Flue seal deterioration.',
      actions_taken: 'Isolated appliance and advised replacement seal.',
      emergency_services_contacted: false,
      emergency_reference: '',
      danger_do_not_use_label_fitted: true,
      meter_or_appliance_tagged: true,
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
    pushToast({ title: 'Gas Warning demo filled', variant: 'success' });
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
          data: {
            appliance_location: fields.appliance_location,
            appliance_type: fields.appliance_type,
            make_model: fields.make_model,
            gas_supply_isolated: fields.gas_supply_isolated,
            appliance_capped_off: fields.appliance_capped_off,
            customer_refused_isolation: fields.customer_refused_isolation,
            classification: fields.classification,
            classification_code: fields.classification_code,
            unsafe_situation_description: fields.unsafe_situation_description,
            underlying_cause: fields.underlying_cause,
            actions_taken: fields.actions_taken,
            emergency_services_contacted: fields.emergency_services_contacted,
            emergency_reference: fields.emergency_reference,
            danger_do_not_use_label_fitted: fields.danger_do_not_use_label_fitted,
            meter_or_appliance_tagged: fields.meter_or_appliance_tagged,
          },
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
          data: {
            customer_informed: fields.customer_informed,
            customer_understands_risks: fields.customer_understands_risks,
            customer_signed_at: fields.customer_signed_at,
            engineer_name: fields.engineer_name,
            engineer_company: fields.engineer_company,
            gas_safe_number: fields.gas_safe_number,
            engineer_id_card_number: fields.engineer_id_card_number,
            issued_at: fields.issued_at,
          },
        });
        pushToast({ title: 'Saved engineer + acknowledgement', variant: 'success' });
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
      },
    });
    await saveGasWarningDetails({
      jobId,
      data: {
        appliance_location: fields.appliance_location,
        appliance_type: fields.appliance_type,
        make_model: fields.make_model,
        gas_supply_isolated: fields.gas_supply_isolated,
        appliance_capped_off: fields.appliance_capped_off,
        customer_refused_isolation: fields.customer_refused_isolation,
        classification: fields.classification,
        classification_code: fields.classification_code,
        unsafe_situation_description: fields.unsafe_situation_description,
        underlying_cause: fields.underlying_cause,
        actions_taken: fields.actions_taken,
        emergency_services_contacted: fields.emergency_services_contacted,
        emergency_reference: fields.emergency_reference,
        danger_do_not_use_label_fitted: fields.danger_do_not_use_label_fitted,
        meter_or_appliance_tagged: fields.meter_or_appliance_tagged,
        customer_informed: fields.customer_informed,
        customer_understands_risks: fields.customer_understands_risks,
        customer_signed_at: fields.customer_signed_at,
        engineer_name: fields.engineer_name,
        engineer_company: fields.engineer_company,
        gas_safe_number: fields.gas_safe_number,
        engineer_id_card_number: fields.engineer_id_card_number,
        issued_at: fields.issued_at,
      },
    });
  };

  const handlePreview = () => {
    startTransition(async () => {
      try {
        await persistAll();
        const { pdfUrl } = await generateCertificatePdf({ jobId, certificateType, previewOnly: true, fields });
        pushToast({ title: 'Preview ready', variant: 'success' });
        router.push(`/jobs/${jobId}/pdf?url=${encodeURIComponent(pdfUrl)}&preview=1`);
      } catch (error) {
        pushToast({
          title: 'Could not preview PDF',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        await persistAll();
        const { pdfUrl, jobId: resultJobId } = await generateCertificatePdf({ jobId, certificateType, previewOnly: false, fields });
        pushToast({
          title: 'Gas Warning Notice generated successfully',
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

  return (
    <>
      {step === 1 ? (
        <WizardLayout step={offsetStep(1)} total={totalSteps} title="Job / property" status="Gas Warning Notice">
          <div className="space-y-3">
          {demoEnabled ? (
            <div className="mb-3 flex justify-end">
              <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
                Fill demo Gas Warning
              </Button>
            </div>
          ) : null}
          <p className="text-sm text-muted">Engineer and company details are pulled from account settings.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={fields.property_address}
              onChange={(e) => setFields((prev) => ({ ...prev, property_address: e.target.value }))}
              placeholder="Property address"
              className="rounded-2xl sm:col-span-2"
            />
            <Input
              value={fields.postcode}
              onChange={(e) => setFields((prev) => ({ ...prev, postcode: e.target.value }))}
              placeholder="Postcode"
              className="rounded-2xl"
            />
            <Input
              value={fields.customer_name}
              onChange={(e) => setFields((prev) => ({ ...prev, customer_name: e.target.value }))}
              placeholder="Customer name"
              className="rounded-2xl"
            />
            <Input
              value={fields.customer_contact}
              onChange={(e) => setFields((prev) => ({ ...prev, customer_contact: e.target.value }))}
              placeholder="Customer contact (phone/email)"
              className="rounded-2xl"
            />
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
        <WizardLayout step={offsetStep(2)} total={totalSteps} title="Appliance + classification" status="Gas Warning" onBack={() => setStep(1)}>
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
              <Select
                value={fields.classification}
                onChange={(e) => setFields((prev) => ({ ...prev, classification: e.target.value as GasWarningClassification }))}
              >
                <option value="">Classification</option>
                {GAS_WARNING_CLASSIFICATIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <Input
                value={fields.classification_code}
                onChange={(e) => setFields((prev) => ({ ...prev, classification_code: e.target.value }))}
                placeholder="Classification code (optional)"
                className="rounded-2xl"
              />
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
          </div>
          <div className="mt-6 flex justify-end">
            <Button className="rounded-full px-6" onClick={handleApplianceNext} disabled={isPending}>
              Next → Sign-off
            </Button>
          </div>
        </WizardLayout>
      ) : null}

      {step === 3 ? (
        <WizardLayout step={offsetStep(3)} total={totalSteps} title="Acknowledgement + engineer" status="Gas Warning" onBack={() => setStep(2)}>
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
          <CollapsibleSection title="Engineer details" subtitle="Required to issue notice" defaultOpen>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={fields.engineer_name}
                onChange={(e) => setFields((prev) => ({ ...prev, engineer_name: e.target.value }))}
                placeholder="Engineer name"
                className="rounded-2xl"
              />
              <Input
                value={fields.engineer_company}
                onChange={(e) => setFields((prev) => ({ ...prev, engineer_company: e.target.value }))}
                placeholder="Engineer company"
                className="rounded-2xl"
              />
              <Input
                value={fields.gas_safe_number}
                onChange={(e) => setFields((prev) => ({ ...prev, gas_safe_number: e.target.value }))}
                placeholder="Gas Safe number"
                className="rounded-2xl"
              />
              <Input
                value={fields.engineer_id_card_number}
                onChange={(e) => setFields((prev) => ({ ...prev, engineer_id_card_number: e.target.value }))}
                placeholder="Engineer ID card number (optional)"
                className="rounded-2xl"
              />
              <Input
                type="date"
                value={fields.issued_at}
                onChange={(e) => setFields((prev) => ({ ...prev, issued_at: e.target.value }))}
                placeholder="Issued at"
                className="rounded-2xl"
              />
              <Input
                type="date"
                value={fields.customer_signed_at}
                onChange={(e) => setFields((prev) => ({ ...prev, customer_signed_at: e.target.value }))}
                placeholder="Customer signed at (optional)"
                className="rounded-2xl"
              />
            </div>
          </CollapsibleSection>
          <CollapsibleSection title="Customer acknowledgement" subtitle="Confirm customer informed">
            <div className="space-y-2 rounded-2xl border border-white/40 bg-white/70 p-4">
              {[
                ['customer_informed', 'Customer informed (required)'],
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
          </CollapsibleSection>
          <CollapsibleSection title="Signatures" subtitle="Customer + engineer">
            <div className="grid gap-4 sm:grid-cols-2">
              <SignatureCard label="Customer" existingUrl={customerSignature} onUpload={signatureUpload('customer')} />
              <SignatureCard label="Engineer" existingUrl={engineerSignature} onUpload={signatureUpload('engineer')} />
            </div>
          </CollapsibleSection>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="rounded-full px-6" onClick={handlePreview} disabled={isPending}>
              Preview PDF
            </Button>
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
