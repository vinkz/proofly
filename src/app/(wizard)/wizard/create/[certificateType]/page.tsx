// Jobs-centric flow: wizard bootstraps from jobId and prefers job/client data over job_fields for customer/address defaults.
import { notFound } from 'next/navigation';

import { createJob, getCertificateWizardState } from '@/server/certificates';
import { CERTIFICATE_TYPES, CERTIFICATE_LABELS, type CertificateType } from '@/types/certificates';
import type { Database } from '@/lib/database.types';
import { CertificateWizard } from './_components/certificate-wizard';
import { BoilerServiceWizard } from './_components/boiler-service-wizard';
import { GeneralWorksWizard } from './_components/general-works-wizard';
import { GasWarningNoticeWizard } from './_components/gas-warning-notice-wizard';

export default async function CertificateWizardPage({
  params,
  searchParams,
}: {
  params: Promise<{ certificateType: string }>;
  searchParams: Promise<{ jobId?: string }>;
}) {
  const { certificateType } = await params;
  const normalizedType = certificateType === 'boiler_service' ? 'gas_service' : certificateType;
  const qs = await searchParams;
  if (!CERTIFICATE_TYPES.includes(normalizedType as CertificateType)) {
    notFound();
  }

  const existingJobId = qs.jobId;
  const { jobId } =
    existingJobId && existingJobId.length > 10
      ? { jobId: existingJobId }
      : await createJob({ certificateType: normalizedType as CertificateType });
  const wizardState = await getCertificateWizardState(jobId);
  const job = wizardState.job as Database['public']['Tables']['jobs']['Row'] | null;
  const customerName =
    job?.client_name ?? wizardState.client?.name ?? wizardState.fields.customer_name ?? '';
  const propertyAddress = job?.address || wizardState.fields.property_address || '';
  const postcode = wizardState.fields.postcode ?? '';
  const serviceDate = job?.scheduled_for ?? wizardState.fields.service_date ?? '';
  const initialInfo = {
    ...wizardState.fields,
    customer_name: customerName,
    property_address: propertyAddress,
    postcode,
    service_date: serviceDate,
  };

  if (normalizedType === 'gas_service') {
    return (
      <BoilerServiceWizard
        jobId={jobId}
        initialFields={initialInfo}
        initialPhotoPreviews={wizardState.photoPreviews}
      />
    );
  }

  if (normalizedType === 'general_works') {
    return (
      <GeneralWorksWizard
        jobId={jobId}
        initialFields={initialInfo}
        initialPhotoPreviews={wizardState.photoPreviews}
      />
    );
  }

  if (normalizedType === 'gas_warning_notice') {
    return <GasWarningNoticeWizard jobId={jobId} initialFields={initialInfo} certificateType={normalizedType as CertificateType} />;
  }

  return (
    <CertificateWizard
      jobId={jobId}
      certificateType={certificateType as CertificateType}
      certificateLabel={CERTIFICATE_LABELS[certificateType as CertificateType]}
      initialInfo={initialInfo}
      initialPhotoPreviews={wizardState.photoPreviews}
      initialAppliances={wizardState.appliances}
    />
  );
}
