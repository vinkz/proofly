import type { Database } from '@/lib/database.types';
import type { JobType } from '@/types/job-records';

export type JobChecklistResult = Database['public']['Tables']['job_items']['Row']['result'];

export interface JobChecklistItem {
  id: string;
  job_id: string;
  template_item_id: string | null;
  label: string;
  result: JobChecklistResult;
  note: string | null;
  photos: string[] | null;
  position: number | null;
}

export interface JobPhoto {
  id: string;
  job_id: string;
  checklist_id: string | null;
  storage_path: string;
  caption: string | null;
  created_at: string | null;
}

export interface JobSignatures {
  plumber_sig_path: string | null;
  client_sig_path: string | null;
  signed_at: string | null;
}

export interface JobReport {
  storage_path: string;
  generated_at: string | null;
}

export interface JobDetailPayload {
  job: {
    id: string;
    client_id: string | null;
    client_name: string | null;
    address: string | null;
    title: string | null;
    status: string | null;
    created_at: string | null;
    scheduled_for: string | null;
    completed_at: string | null;
    engineer_signature_path: string | null;
    client_signature_path: string | null;
    technician_name: string | null;
    template_id: string | null;
    user_id: string | null;
    notes: string | null;
    job_type?: JobType | null;
  };
  items: JobChecklistItem[];
  photos: JobPhoto[];
  signatures: JobSignatures | null;
  report: JobReport | null;
}
