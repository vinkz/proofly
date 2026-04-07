import type { JobType } from '@/types/job-records';
import type { CertificateType } from '@/types/certificates';

const WIZARD_ROUTE_BY_JOB_TYPE: Record<JobType, string> = {
  safety_check: 'cp12',
  service: 'boiler_service',
  breakdown: 'breakdown',
  installation: 'commissioning',
  warning_notice: 'gas_warning_notice',
  general: 'general_works',
};

const WIZARD_ROUTE_BY_CERTIFICATE_TYPE: Record<CertificateType, string> = {
  cp12: 'cp12',
  gas_service: 'boiler_service',
  general_works: 'general_works',
  gas_warning_notice: 'gas_warning_notice',
  breakdown: 'breakdown',
  commissioning: 'commissioning',
};

const DEFAULT_EDIT_STEP_BY_CERTIFICATE_TYPE: Record<CertificateType, number> = {
  cp12: 4,
  gas_service: 4,
  general_works: 4,
  gas_warning_notice: 3,
  breakdown: 4,
  commissioning: 4,
};

const DEFAULT_EDIT_STEP_BY_JOB_TYPE: Record<JobType, number> = {
  safety_check: 4,
  service: 4,
  breakdown: 4,
  installation: 4,
  warning_notice: 3,
  general: 4,
};

export function getCertificateWizardRouteForJobType(jobType: string | null | undefined) {
  if (!jobType) return null;
  return WIZARD_ROUTE_BY_JOB_TYPE[jobType as JobType] ?? null;
}

export function getCertificateWizardRouteForCertificateType(certificateType: string | null | undefined) {
  if (!certificateType) return null;
  return WIZARD_ROUTE_BY_CERTIFICATE_TYPE[certificateType as CertificateType] ?? null;
}

export function getDefaultEditStepForCertificateType(certificateType: string | null | undefined) {
  if (!certificateType) return null;
  return DEFAULT_EDIT_STEP_BY_CERTIFICATE_TYPE[certificateType as CertificateType] ?? null;
}

export function getDefaultEditStepForJobType(jobType: string | null | undefined) {
  if (!jobType) return null;
  return DEFAULT_EDIT_STEP_BY_JOB_TYPE[jobType as JobType] ?? null;
}

export function getResumeStepFromRecord(record: unknown) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const resumeStep = (record as { resume_step?: unknown }).resume_step;
  if (typeof resumeStep === 'number' && Number.isFinite(resumeStep)) {
    return Math.max(1, Math.floor(resumeStep));
  }
  if (typeof resumeStep === 'string') {
    const parsed = Number.parseInt(resumeStep, 10);
    if (Number.isFinite(parsed)) return Math.max(1, parsed);
  }
  return null;
}

export function buildCertificateResumeHref(params: {
  jobId: string;
  jobType: string | null | undefined;
  startStep?: number | null;
}) {
  const route = getCertificateWizardRouteForJobType(params.jobType);
  if (!route) return `/jobs/${params.jobId}`;
  const query = new URLSearchParams({ jobId: params.jobId });
  if (params.startStep && params.startStep > 1) {
    query.set('startStep', String(params.startStep));
  }
  return `/wizard/create/${route}?${query.toString()}`;
}

export function buildCertificateEditHref(params: {
  jobId: string;
  certificateType: string | null | undefined;
  startStep?: number | null;
}) {
  const route = getCertificateWizardRouteForCertificateType(params.certificateType);
  if (!route) return `/jobs/${params.jobId}`;
  const query = new URLSearchParams({ jobId: params.jobId });
  if (params.startStep && params.startStep > 1) {
    query.set('startStep', String(params.startStep));
  }
  return `/wizard/create/${route}?${query.toString()}`;
}
