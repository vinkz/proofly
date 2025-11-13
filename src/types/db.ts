export interface Job {
  id: string;
  client_name: string;
  address: string;
  status: 'active' | 'completed';
  created_at: string;
}

export interface TemplateItem {
  label?: string;
  title?: string;
  type?: string | null;
  description?: string | null;
}

export interface Template {
  id: string;
  name: string;
  trade_type: string;
  is_public?: boolean | null;
  created_by?: string | null;
  items: TemplateItem[];
}

export interface ChecklistItem {
  id: string;
  job_id: string;
  label: string;
  status: 'pending' | 'pass' | 'fail';
  note?: string | null;
}
