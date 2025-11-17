import type { ClientSummary } from '@/types/job-wizard';

export interface ClientListItem extends ClientSummary {
  user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}
