'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { WizardLayout } from '@/components/certificates/wizard-layout';
import { EvidenceCard } from './evidence-card';
import { SignatureCard } from '@/components/certificates/signature-card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  BOILER_SERVICE_EVIDENCE_CARDS,
  BOILER_SERVICE_DEMO_INFO,
  BOILER_SERVICE_DEMO_DETAILS,
  BOILER_SERVICE_DEMO_CHECKS,
} from '@/types/boiler-service';
import {
  saveBoilerServiceJobInfo,
  saveBoilerServiceDetails,
  saveBoilerServiceChecks,
  uploadBoilerServicePhoto,
  generateBoilerServicePdf,
  uploadSignature,
} from '@/server/certificates';

type BoilerServiceWizardProps = {
  jobId: string;
  initialFields: Record<string, string | null | undefined>;
  initialPhotoPreviews?: Record<string, string>;
};

const EMPTY_CHECKS = {
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

export function BoilerServiceWizard({ jobId, initialFields, initialPhotoPreviews = {} }: BoilerServiceWizardProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();

  const [jobInfo, setJobInfo] = useState({
    customer_name: initialFields.customer_name ?? '',
    property_address: initialFields.property_address ?? '',
    postcode: initialFields.postcode ?? '',
    service_date: initialFields.service_date ? (initialFields.service_date as string).slice(0, 10) : '',
    engineer_name: initialFields.engineer_name ?? '',
    gas_safe_number: initialFields.gas_safe_number ?? '',
    company_name: initialFields.company_name ?? '',
    company_address: initialFields.company_address ?? '',
  });

  const [details, setDetails] = useState<Record<string, string>>({
    boiler_make: initialFields.boiler_make ?? '',
    boiler_model: initialFields.boiler_model ?? '',
    boiler_type: initialFields.boiler_type ?? '',
    boiler_location: initialFields.boiler_location ?? '',
    serial_number: initialFields.serial_number ?? '',
    gas_type: initialFields.gas_type ?? '',
    mount_type: initialFields.mount_type ?? '',
    flue_type: initialFields.flue_type ?? '',
  });

  const [checks, setChecks] = useState<Record<string, string>>({
    ...EMPTY_CHECKS,
    ...Object.entries(EMPTY_CHECKS).reduce<Record<string, string>>((acc, [key]) => {
      const existing = initialFields[key];
      acc[key] = typeof existing === 'boolean' ? String(existing) : (existing as string) ?? '';
      return acc;
    }, {}),
  });

  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>(initialPhotoPreviews);
  const [engineerSignature, setEngineerSignature] = useState((initialFields.engineer_signature as string) ?? '');
  const [customerSignature, setCustomerSignature] = useState((initialFields.customer_signature as string) ?? '');
  const demoEnabled = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  const handleDemoFill = () => {
    if (!demoEnabled) return;
    startTransition(async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const demoInfo = {
          ...jobInfo,
          ...BOILER_SERVICE_DEMO_INFO,
          service_date: typeof BOILER_SERVICE_DEMO_INFO.service_date === 'function' ? BOILER_SERVICE_DEMO_INFO.service_date() : today,
        } as Record<string, string>;
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

  const handleJobInfoNext = () => {
    startTransition(async () => {
      try {
        await saveBoilerServiceJobInfo({ jobId, data: jobInfo });
        setStep(2);
        pushToast({ title: 'Saved job info', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Could not save job info',
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
    await saveBoilerServiceJobInfo({ jobId, data: jobInfo });
    await saveBoilerServiceDetails({ jobId, data: details });
    await saveBoilerServiceChecks({ jobId, data: checks });
  };

  const handlePreview = () => {
    startTransition(async () => {
      try {
        await persistBeforePdf();
        const { pdfUrl } = await generateBoilerServicePdf({ jobId, previewOnly: true });
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
        const { pdfUrl } = await generateBoilerServicePdf({ jobId, previewOnly: false });
        pushToast({ title: 'Boiler Service PDF generated', variant: 'success' });
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

  const setCheckValue = (key: string, value: string) => {
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

  return (
    <>
      {step === 1 ? (
        <WizardLayout step={1} total={4} title="Job & engineer info" status="Boiler Service Record">
          {demoEnabled ? (
            <div className="mb-3 flex justify-end">
              <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
                Fill demo Boiler Service
              </Button>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={jobInfo.customer_name}
              onChange={(e) => setJobInfo((prev) => ({ ...prev, customer_name: e.target.value }))}
              placeholder="Customer name"
            />
            <Input
              value={jobInfo.service_date}
              onChange={(e) => setJobInfo((prev) => ({ ...prev, service_date: e.target.value }))}
              type="date"
              placeholder="Service date"
            />
            <Input
              value={jobInfo.property_address}
              onChange={(e) => setJobInfo((prev) => ({ ...prev, property_address: e.target.value }))}
              placeholder="Property address"
              className="sm:col-span-2"
            />
            <Input
              value={jobInfo.postcode}
              onChange={(e) => setJobInfo((prev) => ({ ...prev, postcode: e.target.value }))}
              placeholder="Postcode"
            />
            <Input
              value={jobInfo.engineer_name}
              onChange={(e) => setJobInfo((prev) => ({ ...prev, engineer_name: e.target.value }))}
              placeholder="Engineer name"
            />
            <Input
              value={jobInfo.gas_safe_number}
              onChange={(e) => setJobInfo((prev) => ({ ...prev, gas_safe_number: e.target.value }))}
              placeholder="Gas Safe number"
            />
            <Input
              value={jobInfo.company_name}
              onChange={(e) => setJobInfo((prev) => ({ ...prev, company_name: e.target.value }))}
              placeholder="Company name"
            />
            <Input
              value={jobInfo.company_address}
              onChange={(e) => setJobInfo((prev) => ({ ...prev, company_address: e.target.value }))}
              placeholder="Company address"
              className="sm:col-span-2"
            />
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
          step={2}
          total={4}
          title="Boiler details & evidence"
          status="Capture evidence"
          onBack={() => setStep(1)}
        >
          {demoEnabled ? (
            <div className="mb-3 flex justify-end">
              <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
                Fill demo Boiler Service
              </Button>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {BOILER_SERVICE_EVIDENCE_CARDS.map((card) => (
              <EvidenceCard
                key={card.key}
                title={card.title}
                fields={card.fields}
                values={details}
                onChange={(key, value) => setDetails((prev) => ({ ...prev, [key]: value }))}
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
                      pushToast({ title: `${card.title} photo saved`, variant: 'success' });
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
          <div className="mt-6 flex justify-end">
            <Button className="rounded-full px-6" onClick={handleDetailsNext} disabled={isPending}>
              Next → Checks
            </Button>
          </div>
        </WizardLayout>
      ) : null}

      {step === 3 ? (
        <WizardLayout step={3} total={4} title="Service checks & readings" status="On-site checks" onBack={() => setStep(2)}>
          {demoEnabled ? (
            <div className="mb-3 flex justify-end">
              <Button type="button" variant="outline" className="rounded-full text-xs" onClick={handleDemoFill} disabled={isPending}>
                Fill demo Boiler Service
              </Button>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {[
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
            ].map((item) => (
              <div key={item.key} className="rounded-2xl border border-white/30 bg-white/80 p-3 shadow-sm">
                <p className="text-sm font-semibold text-muted">{item.label}</p>
                <div className="mt-2 flex gap-2">
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

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
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

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
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

          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr,1fr,1fr]">
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

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input
              value={checks.next_service_due}
              onChange={(e) => setCheckValue('next_service_due', e.target.value)}
              placeholder="Next service due (date or note)"
            />
          </div>

          <div className="mt-6 flex justify-end">
            <Button className="rounded-full px-6" onClick={handleChecksNext} disabled={isPending}>
              Next → Sign & Preview
            </Button>
          </div>
        </WizardLayout>
      ) : null}

      {step === 4 ? (
        <WizardLayout step={4} total={4} title="Signatures & PDF" status="Finish" onBack={() => setStep(3)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <SignatureCard label="Engineer" existingUrl={engineerSignature} onUpload={signatureUpload('engineer')} />
            <SignatureCard label="Customer" existingUrl={customerSignature} onUpload={signatureUpload('customer')} />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="outline" className="rounded-full" onClick={handlePreview} disabled={isPending}>
              Preview Boiler Service template
            </Button>
            <Button className="rounded-full bg-[var(--accent)] px-6 text-white" onClick={handleGenerate} disabled={isPending}>
              {isPending ? 'Generating…' : 'Generate Boiler Service PDF'}
            </Button>
          </div>
        </WizardLayout>
      ) : null}
    </>
  );
}
