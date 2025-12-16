import { notFound } from 'next/navigation';

import { createJob, getCertificateWizardState } from '@/server/certificates';
import { CERTIFICATE_TYPES, CERTIFICATE_LABELS, type CertificateType } from '@/types/certificates';
import { CertificateWizard } from './_components/certificate-wizard';

export default async function CertificateWizardPage({
  params,
  searchParams,
}: {
  params: Promise<{ certificateType: string }>;
  searchParams: Promise<{ jobId?: string }>;
}) {
  const { certificateType } = await params;
  const qs = await searchParams;
  if (!CERTIFICATE_TYPES.includes(certificateType as CertificateType)) {
    notFound();
  }

  const existingJobId = qs.jobId;
  const { jobId } =
    existingJobId && existingJobId.length > 10
      ? { jobId: existingJobId }
      : await createJob({ certificateType: certificateType as CertificateType });
  const wizardState = await getCertificateWizardState(jobId);
  const initialInfo = {
    ...wizardState.fields,
    customer_name: wizardState.fields.customer_name ?? (wizardState.job as any)?.client_name ?? '',
    property_address: wizardState.fields.property_address ?? (wizardState.job as any)?.address ?? '',
  };

  return (
    <CertificateWizard
      jobId={jobId}
      certificateType={certificateType as CertificateType}
      certificateLabel={CERTIFICATE_LABELS[certificateType as CertificateType]}
      initialInfo={initialInfo}
      initialPhotoNotes={wizardState.photoNotes}
      initialPhotoPreviews={wizardState.photoPreviews}
      initialAppliances={wizardState.appliances}
    />
  );
}
