import type { EvidenceField } from '@/types/cp12';

export const GENERAL_WORKS_PHOTO_CATEGORIES = [
  'site',
  'before',
  'after',
  'issue_defect',
  'parts',
  'receipt_invoice',
] as const;
export type GeneralWorksPhotoCategory = (typeof GENERAL_WORKS_PHOTO_CATEGORIES)[number];

export type GeneralWorksFields = {
  property_address: string;
  postcode: string;
  work_date: string;
  customer_name: string;
  engineer_name: string;
  company_name: string;
  customer_email: string;
  customer_phone: string;
  work_summary: string;
  work_completed: string;
  parts_used: string;
  defects_found: string;
  defects_details: string;
  recommendations: string;
  invoice_amount: string;
  payment_status: string;
  follow_up_required: string;
  follow_up_date: string;
  engineer_signature: string;
  customer_signature: string;
};

export const GENERAL_WORKS_REQUIRED_FIELDS: Array<keyof GeneralWorksFields> = [
  'property_address',
  'work_date',
  'engineer_name',
  'work_summary',
  'work_completed',
  'engineer_signature',
  'customer_signature',
];

export const GENERAL_WORKS_EVIDENCE_FIELDS: EvidenceField[] = [
  { key: 'work_summary', label: 'Work summary' },
  { key: 'work_completed', label: 'Work completed', type: 'text' },
  { key: 'parts_used', label: 'Parts used', type: 'text' },
  { key: 'defects_found', label: 'Defects found', type: 'select', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
  { key: 'defects_details', label: 'Defect details', type: 'text' },
  { key: 'recommendations', label: 'Recommendations', type: 'text' },
];
