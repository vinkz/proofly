export const JOB_TYPES = ['safety_check', 'service', 'breakdown', 'installation', 'warning_notice', 'general'] as const;
export type JobType = (typeof JOB_TYPES)[number];
export const DEFAULT_JOB_TYPE: JobType = 'general';
export const JOB_TYPE_LABELS: Record<JobType, string> = {
  safety_check: 'Landlord safety check',
  service: 'Service',
  breakdown: 'Breakdown',
  installation: 'Installation',
  warning_notice: 'Gas Warning Notice',
  general: 'Other',
};

export type JobRecord = Record<string, unknown>;

export type JobRecordRow = {
  job_id: string;
  record: JobRecord;
  created_at: string;
  updated_at: string;
};
