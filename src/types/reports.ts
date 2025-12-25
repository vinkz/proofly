import type { JobType } from '@/types/job-records';

export const REPORT_KINDS = [
  'cp12',
  'boiler_service',
  'warning_notice',
  'general_works',
  'job_sheet',
  'breakdown',
  'commissioning',
] as const;

export type ReportKind = (typeof REPORT_KINDS)[number];

const REPORT_KIND_BY_JOB_TYPE: Record<JobType, ReportKind> = {
  safety_check: 'cp12',
  service: 'boiler_service',
  breakdown: 'breakdown',
  installation: 'commissioning',
  general: 'general_works',
};

export const reportKindForJobType = (jobType: JobType | null | undefined): ReportKind => {
  if (!jobType) return 'general_works';
  return REPORT_KIND_BY_JOB_TYPE[jobType] ?? 'general_works';
};
