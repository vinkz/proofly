export type TemplateItemType = 'toggle' | 'text' | 'number' | 'note';

export interface TemplateItem {
  id: string;
  label: string;
  type: TemplateItemType;
  required?: boolean;
  photo?: boolean;
}

export interface TemplateModel {
  id: string;
  name: string;
  trade_type: string;
  is_public: boolean;
  is_general: boolean;
  items: TemplateItem[];
  description?: string | null;
  user_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}
