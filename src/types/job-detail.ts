import type { Database } from '@/lib/database.types';

export type JobChecklistStatus = Database['public']['Tables']['job_checklist']['Row']['status'];

export interface JobChecklistItem {
  id: string;
  job_id: string;
  label: string;
  status: JobChecklistStatus;
  note: string | null;
  created_at: string | null;
  user_id: string;
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
    client_name: string | null;
    address: string | null;
    status: string | null;
    created_at: string | null;
    template_id: string | null;
    user_id: string | null;
    notes: string | null;
  };
  items: JobChecklistItem[];
  photos: JobPhoto[];
  signatures: JobSignatures | null;
  report: JobReport | null;
}
