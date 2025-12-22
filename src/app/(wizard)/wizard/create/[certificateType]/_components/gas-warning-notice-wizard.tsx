'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { WizardLayout } from '@/components/certificates/wizard-layout';
import { SignatureCard } from '@/components/certificates/signature-card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { GAS_WARNING_CLASSIFICATIONS, type GasWarningClassification } from '@/types/gas-warning-notice';
import {
  saveGasWarningJobInfo,
  saveGasWarningDetails,
  generateCertificatePdf,
  uploadSignature,
} from '@/server/certificates';
import type { CertificateType } from '@/types/certificates';

type GasWarningNoticeWizardProps = {
  jobId: string;
  initialFields: Record<string, string | null | undefined>;
  certificateType: CertificateType;
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

const parseBool = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'y', 'on'].includes(value.toLowerCase());
  }
  return false;
};

export function GasWarningNoticeWizard({ jobId, initialFields, certificateType }: GasWarningNoticeWizardProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();

  const [fields, setFields] = useState<GasWarningFormState>({
    property_address: initialFields.property_address ?? '',
    postcode: initialFields.postcode ?? '',
    customer_name: initialFields.customer_name ?? '',
    customer_contact: initialFields.customer_contact ?? '',
    appliance_location: initialFields.appliance_location ?? '',
    appliance_type: initialFields.appliance_type ?? '',
    make_model: initialFields.make_model ?? '',
    gas_supply_isolated: parseBool(initialFields.gas_supply_isolated),
    appliance_capped_off: parseBool(initialFields.appliance_capped_off),
    customer_refused_isolation: parseBool(initialFields.customer_refused_isolation),
    classification: (initialFields.classification as GasWarningClassification) ?? '',
    classification_code: initialFields.classification_code ?? '',
    unsafe_situation_description: initialFields.unsafe_situation_description ?? '',
    underlying_cause: initialFields.underlying_cause ?? '',
    actions_taken: initialFields.actions_taken ?? '',
    emergency_services_contacted: parseBool(initialFields.emergency_services_contacted),
    emergency_reference: initialFields.emergency_reference ?? '',
    danger_do_not_use_label_fitted: parseBool(initialFields.danger_do_not_use_label_fitted),
    meter_or_appliance_tagged: parseBool(initialFields.meter_or_appliance_tagged),
    customer_informed: parseBool(initialFields.customer_informed),
    customer_understands_risks: parseBool(initialFields.customer_understands_risks),
    customer_signed_at: initialFields.customer_signed_at ? initialFields.customer_signed_at.slice(0, 10) : '',
    engineer_name: initialFields.engineer_name ?? '',
    engineer_company: initialFields.engineer_company ?? '',
    gas_safe_number: initialFields.gas_safe_number ?? '',
    engineer_id_card_number: initialFields.engineer_id_card_number ?? '',
    issued_at: initialFields.issued_at ? initialFields.issued_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
  });

  const [engineerSignature, setEngineerSignature] = useState((initialFields.engineer_signature as string) ?? '');
  const [customerSignature, setCustomerSignature] = useState((initialFields.customer_signature as string) ?? '');

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
        const { pdfUrl } = await generateCertificatePdf({ jobId, certificateType, previewOnly: true });
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
        const { pdfUrl } = await generateCertificatePdf({ jobId, certificateType, previewOnly: false });
        pushToast({ title: 'Gas Warning Notice generated', variant: 'success' });
        router.push(`/jobs/${jobId}/pdf?url=${encodeURIComponent(pdfUrl)}`);
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
        <WizardLayout step={1} total={3} title="Job / property" status="Gas Warning Notice">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={fields.property_address}
              onChange={(e) => setFields((prev) => ({ ...prev, property_address: e.target.value }))}
              placeholder="Property address"
              className="sm:col-span-2"
            />
            <Input
              value={fields.postcode}
              onChange={(e) => setFields((prev) => ({ ...prev, postcode: e.target.value }))}
              placeholder="Postcode"
            />
            <Input
              value={fields.customer_name}
              onChange={(e) => setFields((prev) => ({ ...prev, customer_name: e.target.value }))}
              placeholder="Customer name"
            />
            <Input
              value={fields.customer_contact}
              onChange={(e) => setFields((prev) => ({ ...prev, customer_contact: e.target.value }))}
              placeholder="Customer contact (phone/email)"
            />
          </div>
          <div className="mt-6 flex justify-end">
            <Button className="rounded-full px-6" onClick={handleJobNext} disabled={isPending}>
              Next → Appliance
            </Button>
          </div>
        </WizardLayout>
      ) : null}

      {step === 2 ? (
        <WizardLayout step={2} total={3} title="Appliance + classification" status="Gas Warning" onBack={() => setStep(1)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={fields.appliance_location}
              onChange={(e) => setFields((prev) => ({ ...prev, appliance_location: e.target.value }))}
              placeholder="Appliance location"
            />
            <Input
              value={fields.appliance_type}
              onChange={(e) => setFields((prev) => ({ ...prev, appliance_type: e.target.value }))}
              placeholder="Appliance type"
            />
            <Input
              value={fields.make_model}
              onChange={(e) => setFields((prev) => ({ ...prev, make_model: e.target.value }))}
              placeholder="Make / model (optional)"
              className="sm:col-span-2"
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
            />
            <Textarea
              value={fields.unsafe_situation_description}
              onChange={(e) => setFields((prev) => ({ ...prev, unsafe_situation_description: e.target.value }))}
              placeholder="Unsafe situation description"
              className="min-h-[90px] sm:col-span-2"
            />
            <Textarea
              value={fields.underlying_cause}
              onChange={(e) => setFields((prev) => ({ ...prev, underlying_cause: e.target.value }))}
              placeholder="Underlying cause (optional)"
              className="min-h-[90px] sm:col-span-2"
            />
            <Textarea
              value={fields.actions_taken}
              onChange={(e) => setFields((prev) => ({ ...prev, actions_taken: e.target.value }))}
              placeholder="Actions taken"
              className="min-h-[90px] sm:col-span-2"
            />
            <Input
              value={fields.emergency_reference}
              onChange={(e) => setFields((prev) => ({ ...prev, emergency_reference: e.target.value }))}
              placeholder="Emergency reference (optional)"
              className="sm:col-span-2"
            />
          </div>
          <div className="mt-4 space-y-2 rounded-2xl border border-white/40 bg-white/70 p-4">
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
          <div className="mt-6 flex justify-end">
            <Button className="rounded-full px-6" onClick={handleApplianceNext} disabled={isPending}>
              Next → Sign-off
            </Button>
          </div>
        </WizardLayout>
      ) : null}

      {step === 3 ? (
        <WizardLayout step={3} total={3} title="Acknowledgement + engineer" status="Gas Warning" onBack={() => setStep(2)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={fields.engineer_name}
              onChange={(e) => setFields((prev) => ({ ...prev, engineer_name: e.target.value }))}
              placeholder="Engineer name"
            />
            <Input
              value={fields.engineer_company}
              onChange={(e) => setFields((prev) => ({ ...prev, engineer_company: e.target.value }))}
              placeholder="Engineer company"
            />
            <Input
              value={fields.gas_safe_number}
              onChange={(e) => setFields((prev) => ({ ...prev, gas_safe_number: e.target.value }))}
              placeholder="Gas Safe number"
            />
            <Input
              value={fields.engineer_id_card_number}
              onChange={(e) => setFields((prev) => ({ ...prev, engineer_id_card_number: e.target.value }))}
              placeholder="Engineer ID card number (optional)"
            />
            <Input
              type="date"
              value={fields.issued_at}
              onChange={(e) => setFields((prev) => ({ ...prev, issued_at: e.target.value }))}
              placeholder="Issued at"
            />
            <Input
              type="date"
              value={fields.customer_signed_at}
              onChange={(e) => setFields((prev) => ({ ...prev, customer_signed_at: e.target.value }))}
              placeholder="Customer signed at (optional)"
            />
          </div>
          <div className="mt-4 space-y-2 rounded-2xl border border-white/40 bg-white/70 p-4">
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
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <SignatureCard label="Customer" existingUrl={customerSignature} onUpload={signatureUpload('customer')} />
            <SignatureCard label="Engineer" existingUrl={engineerSignature} onUpload={signatureUpload('engineer')} />
          </div>
          <div className="mt-6 flex flex-wrap gap-3 justify-end">
            <Button variant="outline" className="rounded-full px-6" onClick={handlePreview} disabled={isPending}>
              Preview PDF
            </Button>
            <Button className="rounded-full px-6" onClick={handleGenerate} disabled={isPending}>
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
