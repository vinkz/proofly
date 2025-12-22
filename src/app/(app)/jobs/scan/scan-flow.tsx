'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { WizardLayout } from '@/components/certificates/wizard-layout';
import { PhotoUploadCard } from '@/components/certificates/photo-upload-card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { generateCertificatePdf, createJob, saveJobInfo } from '@/server/certificates';
import { CERTIFICATE_LABELS } from '@/types/certificates';
import { useToast } from '@/components/ui/use-toast';

export function ScanJobSheetFlow() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [jobId, setJobId] = useState<string | null>(null);

  const [form, setForm] = useState({
    customer: 'Mrs Smith',
    address: '15 Acacia Avenue',
    summary: 'Boiler service and safety check',
    work: 'Serviced boiler, cleaned filters, checked pressure',
    parts: 'Filter gasket',
    price: '£120',
    engineer: 'You',
    date: new Date().toISOString().slice(0, 16),
  });

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        const id = jobId
          ? jobId
          : (await createJob({ certificateType: 'general_works', title: 'Scanned Job Sheet' })).jobId;
        setJobId(id);
        await saveJobInfo({
          jobId: id,
          certificateType: 'general_works',
          fields: {
            customer_name: form.customer,
            address: form.address,
            job_type: 'General Works',
            datetime: form.date,
          },
        });
        const { pdfUrl } = await generateCertificatePdf({ jobId: id, certificateType: 'general_works', previewOnly: false });
        pushToast({ title: 'PDF ready', variant: 'success' });
        router.push(`/jobs/${id}/pdf?url=${encodeURIComponent(pdfUrl)}`);
      } catch (error) {
        pushToast({
          title: 'Could not generate PDF',
          description: error instanceof Error ? error.message : 'Try again.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <>
      {step === 1 ? (
        <WizardLayout step={1} total={3} title="Scan job sheet" status="OCR prep">
          <p className="text-sm text-muted-foreground/70">
            Capture the handwritten job sheet. We’ll enhance and prep it for OCR.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <PhotoUploadCard label="Upload or capture" onSelect={() => setStep(2)} />
            <PhotoUploadCard label="Alternate angle" onSelect={() => setStep(2)} />
          </div>
        </WizardLayout>
      ) : null}

      {step === 2 ? (
        <WizardLayout step={2} total={3} title="Auto-filled form" status="Detected fields" onBack={() => setStep(1)}>
          <div className="space-y-3">
            <Input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} placeholder="Customer" />
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" />
            <Textarea
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder="Job summary"
              className="min-h-[80px]"
            />
            <Textarea
              value={form.work}
              onChange={(e) => setForm({ ...form, work: e.target.value })}
              placeholder="Work carried out"
              className="min-h-[80px]"
            />
            <Input value={form.parts} onChange={(e) => setForm({ ...form, parts: e.target.value })} placeholder="Parts" />
            <Input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Price" />
            <Input value={form.engineer} onChange={(e) => setForm({ ...form, engineer: e.target.value })} placeholder="Engineer" />
            <Input
              type="datetime-local"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div className="mt-6 flex justify-end">
            <Button className="rounded-full px-6" onClick={() => setStep(3)}>
              Next → PDF
            </Button>
          </div>
        </WizardLayout>
      ) : null}

      {step === 3 ? (
        <WizardLayout
          step={3}
          total={3}
          title="PDF ready"
          status={CERTIFICATE_LABELS['general_works']}
          onBack={() => setStep(2)}
        >
          <p className="text-sm text-muted-foreground/70">
            We’ll generate a General Works certificate from the scanned sheet and your edits.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="rounded-full">
              Save as template
            </Button>
            <Button className="rounded-full bg-[var(--action)] px-6 text-white" disabled={isPending} onClick={handleGenerate}>
              {isPending ? 'Generating…' : 'Generate PDF'}
            </Button>
          </div>
        </WizardLayout>
      ) : null}
    </>
  );
}
