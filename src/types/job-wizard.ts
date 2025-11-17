import type { JobDetailPayload } from '@/types/job-detail';
import type { TemplateModel } from '@/types/template';

export interface ClientSummary {
  id: string;
  name: string;
  organization: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface JobWizardState extends JobDetailPayload {
  client: ClientSummary | null;
  template: TemplateModel | null;
}
