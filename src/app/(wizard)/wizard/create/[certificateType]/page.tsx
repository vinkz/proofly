// Jobs-centric flow: wizard bootstraps from jobId and prefers job/client data over job_fields for customer/address defaults.
import { notFound, redirect } from 'next/navigation';

import { createJob, getCertificateWizardState } from '@/server/certificates';
import { listClients } from '@/server/clients';
import { CERTIFICATE_TYPES, CERTIFICATE_LABELS, type CertificateType } from '@/types/certificates';
import type { Database } from '@/lib/database.types';
import type { InitialJobContext } from './_components/initial-job-context';
import { CertificateWizard } from './_components/certificate-wizard';
import { BoilerServiceWizard } from './_components/boiler-service-wizard';
import { GeneralWorksWizard } from './_components/general-works-wizard';
import { GasWarningNoticeWizard } from './_components/gas-warning-notice-wizard';
import { BreakdownWizard } from './_components/breakdown-wizard';
import { CommissioningWizard } from './_components/commissioning-wizard';
import { mergeJobContextFields } from './_components/initial-job-context';
import { CertificateClientStep } from './_components/certificate-client-step';

const pickText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
};

const isAuthError = (error: unknown) =>
  error instanceof Error &&
  (error.message === 'Unauthorized' || error.message.includes('Auth session missing'));

const CERTIFICATE_STEP_TOTALS: Record<CertificateType, number> = {
  cp12: 4,
  gas_service: 4,
  general_works: 4,
  gas_warning_notice: 3,
  breakdown: 5,
  commissioning: 5,
};

export default async function CertificateWizardPage({
  params,
  searchParams,
}: {
  params: Promise<{ certificateType: string }>;
  searchParams: Promise<{ jobId?: string; clientId?: string; clientStep?: string; skipJobInfo?: string }>;
}) {
  const { certificateType } = await params;
  const resolvedSearchParams = await searchParams;
  const normalizedType = certificateType === 'boiler_service' ? 'gas_service' : certificateType;
  if (!CERTIFICATE_TYPES.includes(normalizedType as CertificateType)) {
    notFound();
  }

  const clientId =
    typeof resolvedSearchParams?.clientId === 'string' ? resolvedSearchParams.clientId : null;
  const existingJobId =
    typeof resolvedSearchParams?.jobId === 'string' ? resolvedSearchParams.jobId : null;
  const clientStep = resolvedSearchParams?.clientStep === '1';
  const skipJobInfo = resolvedSearchParams?.skipJobInfo === '1';
  const isCp12 = normalizedType === 'cp12';
  const baseSteps = CERTIFICATE_STEP_TOTALS[normalizedType as CertificateType] ?? 4;
  const stepOffset = clientStep && !(isCp12 && skipJobInfo) ? 1 : 0;
  const totalSteps = isCp12 ? baseSteps : baseSteps + 1;

  if (!existingJobId && !clientId) {
    try {
      const clients = await listClients();
      return (
        <CertificateClientStep
          certificateType={normalizedType as CertificateType}
          clients={clients}
          totalSteps={totalSteps}
        />
      );
    } catch (error) {
      if (isAuthError(error)) {
        redirect('/login');
      }
      return (
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/70 p-6 text-sm text-muted-foreground/80">
          This step could not be loaded.
        </div>
      );
    }
  }

  let jobId = '';
  let wizardState: Awaited<ReturnType<typeof getCertificateWizardState>> | null = null;
  let initialJobContext: InitialJobContext | null = null;

  if (existingJobId) {
    try {
      wizardState = await getCertificateWizardState(existingJobId);
      jobId = existingJobId;
    } catch (error) {
      if (isAuthError(error)) {
        redirect('/login');
      }
      return (
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/70 p-6 text-sm text-muted-foreground/80">
          This job could not be loaded.
        </div>
      );
    }
  } else {
    try {
      const created = await createJob({
        certificateType: normalizedType as CertificateType,
        clientId: clientId ?? undefined,
      });
      jobId = created.jobId;
      wizardState = await getCertificateWizardState(jobId);
    } catch (error) {
      if (isAuthError(error)) {
        redirect('/login');
      }
      return (
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/70 p-6 text-sm text-muted-foreground/80">
          This job could not be loaded.
        </div>
      );
    }
  }

  if (!wizardState) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/70 p-6 text-sm text-muted-foreground/80">
        This job could not be loaded.
      </div>
    );
  }

  const job = wizardState.job as Database['public']['Tables']['jobs']['Row'] | null;
  const propertySummary = pickText(
    wizardState.jobAddress?.summary ?? null,
    wizardState.fields.property_address ?? null,
    job?.address ?? null,
  );
  const propertyPostcode = pickText(
    wizardState.jobAddress?.postcode ?? null,
    wizardState.fields.postcode ?? null,
  );
  initialJobContext = {
    job: wizardState.job,
    customer: wizardState.client ?? null,
    propertyAddress: {
      summary: propertySummary,
      line1: wizardState.fields.property_address_line1 ?? null,
      line2: wizardState.fields.property_address_line2 ?? null,
      town: wizardState.fields.property_town ?? null,
      postcode: propertyPostcode,
    },
  };

  const serviceDate = job?.scheduled_for ?? wizardState.fields.service_date ?? '';
  const initialInfo = mergeJobContextFields(
    {
      ...wizardState.fields,
      service_date: serviceDate,
    },
    initialJobContext,
  );

  if (normalizedType === 'gas_service') {
    return (
      <BoilerServiceWizard
        jobId={jobId}
        initialFields={initialInfo}
        initialJobContext={initialJobContext}
        initialPhotoPreviews={wizardState.photoPreviews}
        stepOffset={stepOffset}
      />
    );
  }

  if (normalizedType === 'general_works') {
    return (
      <GeneralWorksWizard
        jobId={jobId}
        initialFields={initialInfo}
        initialJobContext={initialJobContext}
        initialPhotoPreviews={wizardState.photoPreviews}
        stepOffset={stepOffset}
      />
    );
  }

  if (normalizedType === 'gas_warning_notice') {
    return (
      <GasWarningNoticeWizard
        jobId={jobId}
        initialFields={initialInfo}
        initialJobContext={initialJobContext}
        certificateType={normalizedType as CertificateType}
        stepOffset={stepOffset}
      />
    );
  }

  if (normalizedType === 'breakdown') {
    return (
      <BreakdownWizard
        jobId={jobId}
        initialFields={initialInfo}
        initialJobContext={initialJobContext}
        stepOffset={stepOffset}
      />
    );
  }

  if (normalizedType === 'commissioning') {
    return (
      <CommissioningWizard
        jobId={jobId}
        initialFields={initialInfo}
        initialJobContext={initialJobContext}
        stepOffset={stepOffset}
      />
    );
  }

  return (
    <CertificateWizard
      jobId={jobId}
      certificateType={certificateType as CertificateType}
      certificateLabel={CERTIFICATE_LABELS[certificateType as CertificateType]}
      initialInfo={initialInfo}
      initialJobContext={initialJobContext}
      initialPhotoPreviews={wizardState.photoPreviews}
      initialAppliances={wizardState.appliances}
      stepOffset={stepOffset}
      startStep={isCp12 && skipJobInfo ? 2 : 1}
    />
  );
}
