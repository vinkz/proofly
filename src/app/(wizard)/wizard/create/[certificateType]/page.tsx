// Jobs-centric flow: wizard bootstraps from jobId and prefers job/client data over job_fields for customer/address defaults.
import { notFound, redirect } from 'next/navigation';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { createJob, getCertificateWizardState } from '@/server/certificates';
import { listClients } from '@/server/clients';
import { CERTIFICATE_TYPES, CERTIFICATE_LABELS, type CertificateType } from '@/types/certificates';
import type { Database } from '@/lib/database.types';
import type { InitialJobContext } from './_components/initial-job-context';
import { CertificateWizard, type SavedPropertyOption } from './_components/certificate-wizard';
import { BoilerServiceWizard } from './_components/boiler-service-wizard';
import { GeneralWorksWizard } from './_components/general-works-wizard';
import { GasWarningNoticeWizard } from './_components/gas-warning-notice-wizard';
import { BreakdownWizard } from './_components/breakdown-wizard';
import { CommissioningWizard } from './_components/commissioning-wizard';
import { mergeJobContextFields } from './_components/initial-job-context';
import { CertificateClientStep } from './_components/certificate-client-step';
import { BoilerServiceClientStep } from './_components/boiler-service-client-step';
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

const splitAddressParts = (value: string | null | undefined) =>
  String(value ?? '')
    .split(/[\r\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

const isAuthError = (error: unknown) =>
  error instanceof Error &&
  (error.message === 'Unauthorized' || error.message.includes('Auth session missing'));

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
  }>;
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
  const isCp12 = normalizedType === 'cp12';
  const prepareOnly = isCp12 && resolvedSearchParams?.prepare === '1';
  const clientStep = !isCp12 && resolvedSearchParams?.clientStep === '1';
  const forceClientStep = !isCp12 && resolvedSearchParams?.forceClientStep === '1';
  const baseSteps = CERTIFICATE_STEP_TOTALS[normalizedType as CertificateType] ?? 4;
  // For CP12 we want the wizard's first step to be job info, even when coming from client selection.
  const stepOffset = clientStep && !isCp12 ? 1 : 0;
  let totalSteps = isCp12 ? baseSteps : baseSteps + 1;

  if (clientStep && forceClientStep && isCp12 && existingJobId) {
    redirect(`/wizard/create/${normalizedType}?jobId=${existingJobId}`);
  }

  if (!existingJobId && !clientId) {
    if (isCp12) {
      try {
        const created = await createJob({ certificateType: normalizedType as CertificateType });
        return redirect(`/wizard/create/${normalizedType}?jobId=${created.jobId}`);
      } catch (error) {
        if (isAuthError(error)) {
          redirect('/login');
        }
        return (
          <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/70 p-6 text-sm text-muted-foreground/80">
            This job could not be started.
          </div>
        );
      }
    }
    try {
      const clients = await listClients();
      if (normalizedType === 'gas_service') {
        return <BoilerServiceClientStep clients={clients} totalSteps={totalSteps} />;
      }
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
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/70 p-6 text-sm text-muted-foreground/80">
          This step could not be loaded.
        </div>
      );
    }
  }

  let jobId = '';
  let wizardState: Awaited<ReturnType<typeof getCertificateWizardState>> | null = null;
  let initialJobContext: InitialJobContext | null = null;
  let availableClients: Awaited<ReturnType<typeof listClients>> = [];
  let savedProperties: SavedPropertyOption[] = [];

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

  if (isCp12) {
    try {
      availableClients = await listClients();
    } catch (error) {
      if (isAuthError(error)) {
        redirect('/login');
      }
      return (
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/70 p-6 text-sm text-muted-foreground/80">
          Client records could not be loaded.
        </div>
      );
    }
  }

  if (isCp12 && wizardState.client?.id) {
    const supabase = await supabaseServerReadOnly();
    const { data: clientJobs, error: jobsErr } = await supabase
      .from('jobs')
      .select('id, address, created_at')
      .eq('client_id', wizardState.client.id)
      .order('created_at', { ascending: false });
    if (jobsErr) throw new Error(jobsErr.message);

    const propertyJobIds = (clientJobs ?? [])
      .map((job) => job.id)
      .filter((id): id is string => typeof id === 'string' && id !== jobId);

    const fieldKeys = [
      'job_address_name',
      'job_address_line1',
      'job_address_line2',
      'job_address_city',
      'job_postcode',
      'job_tel',
    ];

    const { data: propertyFieldRows, error: propertyFieldsErr } = propertyJobIds.length
      ? await supabase
          .from('job_fields')
          .select('job_id, field_key, value')
          .in('job_id', propertyJobIds)
          .in('field_key', fieldKeys)
      : { data: [], error: null };
    if (propertyFieldsErr) throw new Error(propertyFieldsErr.message);

    const fieldsByJob = (propertyFieldRows ?? []).reduce<Record<string, Record<string, string>>>((acc, row) => {
      const propertyJobId = row.job_id ?? '';
      const fieldKey = row.field_key ?? '';
      const value = row.value?.trim() ?? '';
      if (!propertyJobId || !fieldKey || !value) return acc;
      acc[propertyJobId] = acc[propertyJobId] ?? {};
      acc[propertyJobId][fieldKey] = value;
      return acc;
    }, {});

    const seenPropertyKeys = new Set<string>();
    savedProperties = (clientJobs ?? []).flatMap((job) => {
      if (!job?.id || job.id === jobId) return [];
      const fields = fieldsByJob[job.id] ?? {};
      const parts = splitAddressParts(job.address);
      const job_address_name = pickText(fields.job_address_name);
      const job_address_line1 = pickText(fields.job_address_line1, parts[0]);
      const job_address_line2 = pickText(fields.job_address_line2, parts.length > 2 ? parts.slice(1, -1).join(', ') : parts[1]);
      const job_address_city = pickText(fields.job_address_city, parts.length > 2 ? parts.at(-1) ?? '' : '');
      const job_postcode = pickText(fields.job_postcode);
      const job_tel = pickText(fields.job_tel);
      const dedupeKey = [job_address_name, job_address_line1, job_address_line2, job_address_city, job_postcode, job_tel]
        .join('::')
        .toLowerCase();
      if (!job_address_line1 || seenPropertyKeys.has(dedupeKey)) return [];
      seenPropertyKeys.add(dedupeKey);
      return [
        {
          key: job.id,
          label: [job_address_name || job_address_line1, [job_address_line1, job_address_city, job_postcode].filter(Boolean).join(', ')]
            .filter(Boolean)
            .join(' - '),
          job_address_name,
          job_address_line1,
          job_address_line2,
          job_address_city,
          job_postcode,
          job_tel,
        },
      ];
    });
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
        initialAppliances={wizardState?.appliances ?? []}
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
      key={`${jobId}:${initialJobContext?.customer?.id ?? 'none'}`}
      jobId={jobId}
      certificateType={certificateType as CertificateType}
      certificateLabel={CERTIFICATE_LABELS[certificateType as CertificateType]}
      initialInfo={initialInfo}
      initialJobContext={initialJobContext}
      clients={availableClients}
      savedProperties={savedProperties}
      initialPhotoPreviews={wizardState.photoPreviews}
      initialAppliances={wizardState.appliances}
      stepOffset={stepOffset}
      startStep={1}
      hideBillingCustomerStep={hideBillingCustomerStep}
      prepareOnly={prepareOnly}
    />
  );
}
