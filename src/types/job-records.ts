export const JOB_TYPES = ['safety_check', 'service', 'breakdown', 'installation', 'general'] as const;
export type JobType = (typeof JOB_TYPES)[number];
export const DEFAULT_JOB_TYPE: JobType = 'general';

export type JobRecord = Record<string, unknown>;

export type JobRecordRow = {
  job_id: string;
  record: JobRecord;
  created_at: string;
  updated_at: string;
};
