'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { WizardLayout } from '@/components/certificates/wizard-layout';
import { EvidenceCard } from './evidence-card';
import { SignatureCard } from '@/components/certificates/signature-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { GENERAL_WORKS_EVIDENCE_FIELDS, GENERAL_WORKS_PHOTO_CATEGORIES } from '@/types/general-works';
import {
  saveGeneralWorksInfo,
  uploadGeneralWorksPhoto,
  generateGeneralWorksPdf,
  uploadSignature,
} from '@/server/certificates';

type GeneralWorksWizardProps = {
  jobId: string;
  initialFields: Record<string, string | null | undefined>;
  initialPhotoPreviews?: Record<string, string>;
};

export function GeneralWorksWizard({ jobId, initialFields, initialPhotoPreviews = {} }: GeneralWorksWizardProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();

  const [info, setInfo] = useState({
    property_address: initialFields.property_address ?? '',
    postcode: initialFields.postcode ?? '',
    work_date: initialFields.work_date ? (initialFields.work_date as string).slice(0, 10) : '',
    customer_name: initialFields.customer_name ?? '',
    engineer_name: initialFields.engineer_name ?? '',
    company_name: initialFields.company_name ?? '',
    customer_email: initialFields.customer_email ?? '',
    customer_phone: initialFields.customer_phone ?? '',
  });

  const [evidence, setEvidence] = useState({
    work_summary: initialFields.work_summary ?? '',
    work_completed: initialFields.work_completed ?? '',
    parts_used: initialFields.parts_used ?? '',
    defects_found: initialFields.defects_found ?? '',
    defects_details: initialFields.defects_details ?? '',
    recommendations: initialFields.recommendations ?? '',
  });

  const [review, setReview] = useState({
    invoice_amount: initialFields.invoice_amount ?? '',
    payment_status: initialFields.payment_status ?? '',
    follow_up_required: initialFields.follow_up_required ?? '',
    follow_up_date: initialFields.follow_up_date ? (initialFields.follow_up_date as string).slice(0, 10) : '',
  });

  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>(initialPhotoPreviews);
  const [engineerSignature, setEngineerSignature] = useState((initialFields.engineer_signature as string) ?? '');
  const [customerSignature, setCustomerSignature] = useState((initialFields.customer_signature as string) ?? '');

  const saveFields = (data: Record<string, string | undefined>) =>
    saveGeneralWorksInfo({ jobId, data });

  const persistThroughStep = async () => {
    await saveFields({ ...info, ...evidence, ...review });
  };

  const handleInfoNext = () => {
    startTransition(async () => {
      try {
        await saveFields(info);
        setStep(2);
        pushToast({ title: 'Saved job basics', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Could not save job info',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleEvidenceNext = () => {
    startTransition(async () => {
      try {
        await saveFields({ ...info, ...evidence });
        setStep(3);
        pushToast({ title: 'Saved evidence', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Could not save evidence',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleReviewNext = () => {
    startTransition(async () => {
      try {
        await saveFields({ ...info, ...evidence, ...review });
        setStep(4);
        pushToast({ title: 'Saved review', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Could not save review',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const handlePreview = () => {
    startTransition(async () => {
      try {
        await persistThroughStep();
        const { pdfUrl } = await generateGeneralWorksPdf({ jobId, previewOnly: true });
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
        await persistThroughStep();
        const { pdfUrl } = await generateGeneralWorksPdf({ jobId, previewOnly: false });
        pushToast({ title: 'General Works PDF generated', variant: 'success' });
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
        <WizardLayout step={1} total={4} title="Job basics" status="General Works">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={info.property_address}
              onChange={(e) => setInfo((prev) => ({ ...prev, property_address: e.target.value }))}
              placeholder="Property address"
              className="sm:col-span-2"
            />
            <Input
              value={info.postcode}
              onChange={(e) => setInfo((prev) => ({ ...prev, postcode: e.target.value }))}
              placeholder="Postcode"
            />
            <Input
              type="date"
              value={info.work_date}
              onChange={(e) => setInfo((prev) => ({ ...prev, work_date: e.target.value }))}
              placeholder="Work date"
            />
            <Input
              value={info.customer_name}
              onChange={(e) => setInfo((prev) => ({ ...prev, customer_name: e.target.value }))}
              placeholder="Customer name (optional)"
            />
            <Input
              value={info.engineer_name}
              onChange={(e) => setInfo((prev) => ({ ...prev, engineer_name: e.target.value }))}
              placeholder="Engineer name"
            />
            <Input
              value={info.company_name}
              onChange={(e) => setInfo((prev) => ({ ...prev, company_name: e.target.value }))}
              placeholder="Company name (optional)"
            />
            <Input
              value={info.customer_email}
              onChange={(e) => setInfo((prev) => ({ ...prev, customer_email: e.target.value }))}
              placeholder="Customer email (optional)"
            />
            <Input
              value={info.customer_phone}
              onChange={(e) => setInfo((prev) => ({ ...prev, customer_phone: e.target.value }))}
              placeholder="Customer phone (optional)"
            />
          </div>
          <div className="mt-6 flex justify-end">
            <Button className="rounded-full px-6" onClick={handleInfoNext} disabled={isPending}>
              Next → Evidence
            </Button>
          </div>
        </WizardLayout>
      ) : null}

      {step === 2 ? (
        <WizardLayout step={2} total={4} title="Evidence capture" status="Work detail" onBack={() => setStep(1)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <EvidenceCard
              title="Work details"
              fields={GENERAL_WORKS_EVIDENCE_FIELDS}
              values={evidence}
              onChange={(key, value) => setEvidence((prev) => ({ ...prev, [key]: value }))}
              photoPreview={photoPreviews.work_summary}
              onPhotoUpload={() =>
                pushToast({
                  title: 'Use photo cards below',
                  description: 'Add photos under Site/Before/After/Issue.',
                  variant: 'default',
                })
              }
              onVoice={() =>
                pushToast({ title: 'Voice capture coming soon', description: 'Add a quick note instead.', variant: 'default' })
              }
              onText={() => pushToast({ title: 'Manual entry', description: 'Edit the fields above.', variant: 'default' })}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {GENERAL_WORKS_PHOTO_CATEGORIES.map((category) => (
                <EvidenceCard
                  key={category}
                  title={`Photo: ${category.replace('_', ' ')}`}
                  fields={[]}
                  values={{}}
                  onChange={() => null}
                  photoPreview={photoPreviews[category]}
                  onPhotoUpload={(file) => {
                    const data = new FormData();
                    data.append('jobId', jobId);
                    data.append('category', category);
                    data.append('file', file);
                    startTransition(async () => {
                      try {
                        const { url } = await uploadGeneralWorksPhoto(data);
                        setPhotoPreviews((prev) => ({ ...prev, [category]: url }));
                        pushToast({ title: `${category} photo saved`, variant: 'success' });
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
                  onText={() => pushToast({ title: 'Manual entry', description: 'Add notes in work details.', variant: 'default' })}
                />
              ))}
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button className="rounded-full px-6" onClick={handleEvidenceNext} disabled={isPending}>
              Next → Review
            </Button>
          </div>
        </WizardLayout>
      ) : null}

      {step === 3 ? (
        <WizardLayout step={3} total={4} title="Review & totals" status="Summary" onBack={() => setStep(2)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={review.invoice_amount}
              onChange={(e) => setReview((prev) => ({ ...prev, invoice_amount: e.target.value }))}
              placeholder="Invoice amount (optional)"
            />
            <Input
              value={review.payment_status}
              onChange={(e) => setReview((prev) => ({ ...prev, payment_status: e.target.value }))}
              placeholder="Payment status (optional)"
            />
            <div className="rounded-2xl border border-white/30 bg-white/80 p-3 shadow-sm">
              <p className="text-sm font-semibold text-muted">Follow up required?</p>
              <div className="mt-2 flex gap-2">
                {['yes', 'no'].map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setReview((prev) => ({ ...prev, follow_up_required: choice }))}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      review.follow_up_required === choice ? 'bg-[var(--accent)] text-white' : 'bg-[var(--muted)] text-gray-700'
                    }`}
                  >
                    {choice.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <Input
              type="date"
              value={review.follow_up_date}
              onChange={(e) => setReview((prev) => ({ ...prev, follow_up_date: e.target.value }))}
              placeholder="Follow-up date"
            />
          </div>

          <div className="mt-6 rounded-2xl border border-white/30 bg-white/70 p-4 shadow-sm">
            <p className="text-sm font-semibold text-muted">Quick review</p>
            <div className="mt-2 grid gap-2 text-sm text-muted-foreground/80">
              <p><span className="font-semibold text-muted">Summary:</span> {evidence.work_summary || 'Not provided'}</p>
              <p><span className="font-semibold text-muted">Completed:</span> {evidence.work_completed || 'Not provided'}</p>
              <p><span className="font-semibold text-muted">Parts:</span> {evidence.parts_used || 'Not provided'}</p>
              <p><span className="font-semibold text-muted">Defects:</span> {evidence.defects_found || 'Not provided'}</p>
              {evidence.defects_found?.toLowerCase() === 'yes' ? (
                <p><span className="font-semibold text-muted">Defect details:</span> {evidence.defects_details || 'Required if defects present'}</p>
              ) : null}
              <p><span className="font-semibold text-muted">Recommendations:</span> {evidence.recommendations || 'Not provided'}</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button className="rounded-full px-6" onClick={handleReviewNext} disabled={isPending}>
              Next → Sign & PDF
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
              Preview General Works template
            </Button>
            <Button className="rounded-full bg-[var(--accent)] px-6 text-white" onClick={handleGenerate} disabled={isPending}>
              {isPending ? 'Generating…' : 'Generate PDF'}
            </Button>
          </div>
        </WizardLayout>
      ) : null}
    </>
  );
}
