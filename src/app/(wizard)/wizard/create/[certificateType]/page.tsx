// Jobs-centric flow: wizard bootstraps from jobId and prefers job/client data over job_fields for customer/address defaults.
import { notFound, redirect } from 'next/navigation';

import { createJob, getCertificateWizardState } from '@/server/certificates';
import { listClients } from '@/server/clients';
import { ProfileRequiredCard } from '@/components/profile/profile-required-card';
import { CERTIFICATE_TYPES, CERTIFICATE_LABELS, type CertificateType } from '@/types/certificates';
import type { Database } from '@/lib/database.types';
import { getInvoiceReadiness } from '@/lib/handover-readiness';
import { getMissingOnboardingFields, isOnboardingProfileComplete } from '@/lib/onboarding-profile';
import { getProfile } from '@/server/profile';
import type { InitialJobContext } from './_components/initial-job-context';
import { CertificateWizard } from './_components/certificate-wizard';
import { BoilerServiceWizard } from './_components/boiler-service-wizard';
import { GeneralWorksWizard } from './_components/general-works-wizard';
import { GasWarningNoticeWizard } from './_components/gas-warning-notice-wizard';
import { BreakdownWizard } from './_components/breakdown-wizard';
import { CommissioningWizard } from './_components/commissioning-wizard';
import { mergeJobContextFields } from './_components/initial-job-context';
import { CertificateClientStep } from './_components/certificate-client-step';
import { GeneralWorksClientStep } from './_components/general-works-client-step';
import { GasWarningClientStep } from './_components/gas-warning-client-step';
import { BreakdownClientStep } from './_components/breakdown-client-step';
import { CommissioningClientStep } from './_components/commissioning-client-step';

const pickText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
};

const isAuthError = (error: unknown) =>
  error instanceof Error &&
  (error.message === 'Unauthorized' || error.message.includes('Auth session missing'));

function applyCp12ApplianceDefaultsToBoilerService(
  fields: Record<string, string | null | undefined>,
  appliances: Awaited<ReturnType<typeof getCertificateWizardState>>['appliances'],
) {
  if (!appliances.length) return fields;
  const source =
    appliances.find((appliance) => /boiler/i.test(`${appliance.appliance_type ?? ''} ${appliance.make_model ?? ''}`)) ??
    appliances[0];
  const [make, ...modelParts] = String(source.make_model ?? '').split(/\s+/).filter(Boolean);

  return {
    ...fields,
    boiler_type: pickText(fields.boiler_type, source.appliance_type),
    boiler_make: pickText(fields.boiler_make, make),
    boiler_model: pickText(fields.boiler_model, modelParts.join(' ')),
    boiler_location: pickText(fields.boiler_location, source.location),
    flue_type: pickText(fields.flue_type, source.flue_type),
    operating_pressure_mbar: pickText(fields.operating_pressure_mbar, source.operating_pressure),
    heat_input: pickText(fields.heat_input, source.heat_input),
    high_combustion_co_ppm: pickText(fields.high_combustion_co_ppm, source.high_co_ppm, source.co_reading_high),
    high_combustion_co2: pickText(fields.high_combustion_co2, source.high_co2),
    high_combustion_ratio: pickText(fields.high_combustion_ratio, source.high_ratio),
    low_combustion_co_ppm: pickText(fields.low_combustion_co_ppm, source.low_co_ppm, source.co_reading_low),
    low_combustion_co2: pickText(fields.low_combustion_co2, source.low_co2),
    low_combustion_ratio: pickText(fields.low_combustion_ratio, source.low_ratio),
  };
}

const CERTIFICATE_STEP_TOTALS: Record<CertificateType, number> = {
  cp12: 4,
  gas_service: 4,
  general_works: 4,
  gas_warning_notice: 3,
  breakdown: 5,
  commissioning: 4,
};

export default async function CertificateWizardPage({
  params,
  searchParams,
}: {
  params: Promise<{ certificateType: string }>;
  searchParams: Promise<{
    jobId?: string;
    clientId?: string;
    clientStep?: string;
    skipJobInfo?: string;
    forceClientStep?: string;
    prepare?: string;
    startStep?: string;
  }>;
}) {
  const { certificateType } = await params;
  const resolvedSearchParams = await searchParams;
  const normalizedType = certificateType === 'boiler_service' ? 'gas_service' : certificateType;
  if (!CERTIFICATE_TYPES.includes(normalizedType as CertificateType)) {
    notFound();
  }

  const { profile } = await getProfile();
  const invoiceReadiness = getInvoiceReadiness(profile as Parameters<typeof getInvoiceReadiness>[0]);
  if (!isOnboardingProfileComplete(profile)) {
    return (
      <ProfileRequiredCard
        title={`Finish your profile before starting ${CERTIFICATE_LABELS[normalizedType as CertificateType] ?? 'this certificate'}`}
        missingFields={getMissingOnboardingFields(profile)}
      />
    );
  }

  const clientId =
    typeof resolvedSearchParams?.clientId === 'string' ? resolvedSearchParams.clientId : null;
  const existingJobId =
    typeof resolvedSearchParams?.jobId === 'string' ? resolvedSearchParams.jobId : null;
  const isCp12 = normalizedType === 'cp12';
  const startsInWizard = normalizedType === 'cp12' || normalizedType === 'gas_service';
  const hasSeparateClientStep = !startsInWizard;
  const prepareOnly = isCp12 && resolvedSearchParams?.prepare === '1';
  const startStepParam =
    typeof resolvedSearchParams?.startStep === 'string' ? Number.parseInt(resolvedSearchParams.startStep, 10) : NaN;
  const requestedStartStep = Number.isFinite(startStepParam) ? Math.max(1, startStepParam) : 1;
  const clientStep = hasSeparateClientStep && resolvedSearchParams?.clientStep === '1';
  const forceClientStep = hasSeparateClientStep && resolvedSearchParams?.forceClientStep === '1';
  const baseSteps = CERTIFICATE_STEP_TOTALS[normalizedType as CertificateType] ?? 4;
  // CP12 and Boiler Service now start inside the wizard; other flows keep their client pre-step.
  const stepOffset = clientStep && hasSeparateClientStep ? 1 : 0;
  let totalSteps = startsInWizard ? baseSteps : baseSteps + 1;

  if (clientStep && forceClientStep && isCp12 && existingJobId) {
    redirect(`/wizard/create/${normalizedType}?jobId=${existingJobId}`);
  }

  if (!existingJobId && !clientId) {
    if (startsInWizard) {
      try {
        const created = await createJob({ certificateType: normalizedType as CertificateType });
        return redirect(`/wizard/create/${normalizedType}?jobId=${created.jobId}`);
      } catch (error) {
        if (isAuthError(error)) {
          redirect('/login');
        }
        return (
          <div className="mx-auto max-w-3xl rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-6 text-[13px] text-[var(--color-text-secondary)]">
            This job could not be started.
          </div>
        );
      }
    }
    try {
      const clients = await listClients();
      if (normalizedType === 'general_works') {
        return <GeneralWorksClientStep clients={clients} totalSteps={totalSteps} />;
      }
      if (normalizedType === 'gas_warning_notice') {
        return <GasWarningClientStep clients={clients} totalSteps={totalSteps} />;
      }
      if (normalizedType === 'breakdown') {
        return <BreakdownClientStep clients={clients} totalSteps={totalSteps} />;
      }
      if (normalizedType === 'commissioning') {
        return <CommissioningClientStep clients={clients} totalSteps={totalSteps} />;
      }
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
        <div className="mx-auto max-w-3xl rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-6 text-[13px] text-[var(--color-text-secondary)]">
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
        <div className="mx-auto max-w-3xl rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-6 text-[13px] text-[var(--color-text-secondary)]">
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
        <div className="mx-auto max-w-3xl rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-6 text-[13px] text-[var(--color-text-secondary)]">
          This job could not be loaded.
        </div>
      );
    }
  }

  if (!wizardState) {
    return (
      <div className="mx-auto max-w-3xl rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-6 text-[13px] text-[var(--color-text-secondary)]">
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
  let initialInfo = mergeJobContextFields(
    {
      ...wizardState.fields,
      service_date: serviceDate,
    },
    initialJobContext,
  );
  if (normalizedType === 'gas_service') {
    initialInfo = applyCp12ApplianceDefaultsToBoilerService(initialInfo, wizardState.appliances);
  }

  const hideBillingCustomerStep = isCp12 ? true : false;
  if (isCp12) {
    totalSteps = baseSteps;
  }

  if (normalizedType === 'gas_service') {
    return (
      <BoilerServiceWizard
        jobId={jobId}
        initialFields={initialInfo}
        initialJobContext={initialJobContext}
        initialPhotoPreviews={wizardState.photoPreviews}
        stepOffset={stepOffset}
        startStep={requestedStartStep}
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
        startStep={requestedStartStep}
      />
    );
  }

  if (normalizedType === 'gas_warning_notice') {
    return (
      <GasWarningNoticeWizard
        jobId={jobId}
        initialFields={initialInfo}
        initialJobContext={initialJobContext}
        initialAppliances={wizardState?.appliances ?? []}
        certificateType={normalizedType as CertificateType}
        stepOffset={stepOffset}
        startStep={requestedStartStep}
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
        startStep={requestedStartStep}
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
        startStep={requestedStartStep}
      />
    );
  }

  return (
    <CertificateWizard
      key={`${jobId}:${initialJobContext?.customer?.id ?? 'none'}`}
      jobId={jobId}
      certificateType={certificateType as CertificateType}
      certificateLabel={CERTIFICATE_LABELS[certificateType as CertificateType]}
      initialInfo={initialInfo}
      initialJobContext={initialJobContext}
      initialPhotoPreviews={wizardState.photoPreviews}
      initialAppliances={wizardState.appliances}
      invoiceReadiness={{
        ready: invoiceReadiness.ready,
        hasStandardRates: invoiceReadiness.hasStandardRates,
        hasBankTransferDetails: invoiceReadiness.hasBankTransferDetails,
        missingFields: invoiceReadiness.missingFields,
      }}
      stepOffset={stepOffset}
      startStep={requestedStartStep}
      hideBillingCustomerStep={hideBillingCustomerStep}
      prepareOnly={prepareOnly}
    />
  );
}
