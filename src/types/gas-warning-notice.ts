export type GasWarningClassification = 'IMMEDIATELY_DANGEROUS' | 'AT_RISK';

export type GasWarningNoticeFields = {
  property_address?: string;
  postcode?: string;
  customer_name?: string;
  customer_contact?: string;
  customer_company?: string;
  customer_address_line1?: string;
  customer_address_line2?: string;
  customer_city?: string;
  customer_address?: string;
  customer_postcode?: string;
  company_address?: string;
  company_postcode?: string;
  company_phone?: string;
  job_address_name?: string;
  job_address_line1?: string;
  job_address_line2?: string;
  job_address_city?: string;
  job_postcode?: string;
  job_tel?: string;
  serial_number?: string;
  appliance_location?: string;
  appliance_type?: string;
  make_model?: string;
  gas_escape_issue?: string | boolean;
  pipework_issue?: string | boolean;
  ventilation_issue?: string | boolean;
  meter_issue?: string | boolean;
  chimney_flue_issue?: string | boolean;
  other_issue?: string | boolean;
  other_issue_details?: string;
  gas_supply_isolated?: string | boolean;
  appliance_capped_off?: string | boolean;
  customer_refused_isolation?: string | boolean;
  classification?: GasWarningClassification | string;
  classification_code?: string;
  unsafe_situation_description?: string;
  underlying_cause?: string;
  actions_taken?: string;
  emergency_services_contacted?: string | boolean;
  emergency_reference?: string;
  danger_do_not_use_label_fitted?: string | boolean;
  meter_or_appliance_tagged?: string | boolean;
  riddor_11_1_reported?: string | boolean;
  riddor_11_2_reported?: string | boolean;
  customer_present?: string | boolean;
  notice_left_on_premises?: string | boolean;
  customer_informed?: string | boolean;
  customer_understands_risks?: string | boolean;
  customer_signature_url?: string;
  customer_signed_at?: string;
  engineer_name?: string;
  engineer_company?: string;
  gas_safe_number?: string;
  engineer_id_card_number?: string;
  engineer_signature_url?: string;
  issued_at?: string;
  record_id?: string;
};

export const GAS_WARNING_REQUIRED_FOR_ISSUE = [
  'property_address',
  'customer_name',
  'appliance_location',
  'appliance_type',
  'serial_number',
  'classification',
  'unsafe_situation_description',
  'actions_taken',
  'engineer_name',
  'gas_safe_number',
  'issued_at',
  'record_id',
  'customer_informed',
] as const;

export const GAS_WARNING_CLASSIFICATIONS: Array<{ value: GasWarningClassification; label: string }> = [
  { value: 'IMMEDIATELY_DANGEROUS', label: 'Immediately Dangerous' },
  { value: 'AT_RISK', label: 'At Risk' },
];

export function getGasWarningClassificationLabel(
  classification: GasWarningClassification | string | null | undefined,
  classificationCode?: string | null | undefined,
) {
  const normalizedClassification = String(classification ?? '').trim().toUpperCase();
  if (normalizedClassification === 'IMMEDIATELY_DANGEROUS') return 'Immediately Dangerous';
  if (normalizedClassification === 'AT_RISK') return 'At Risk';

  const normalizedCode = String(classificationCode ?? '').trim().toUpperCase();
  if (normalizedCode === 'ID') return 'Immediately Dangerous';
  if (normalizedCode === 'AR') return 'At Risk';

  return String(classification ?? '').trim();
}

export const GAS_WARNING_ACTION_FLAGS = [
  { key: 'gas_supply_isolated', label: 'Gas supply isolated' },
  { key: 'appliance_capped_off', label: 'Appliance capped off' },
  { key: 'customer_refused_isolation', label: 'Customer refused isolation' },
  { key: 'emergency_services_contacted', label: 'Emergency services contacted' },
  { key: 'danger_do_not_use_label_fitted', label: 'Danger: Do Not Use label fitted' },
  { key: 'meter_or_appliance_tagged', label: 'Meter or appliance tagged' },
  { key: 'customer_informed', label: 'Customer informed' },
  { key: 'customer_understands_risks', label: 'Customer understands risks' },
] as const;

export const GAS_WARNING_WORKFLOW_SUMMARY = {
  customerPresentPath: 'Customer present: show acknowledgement fields, allow customer signature, and require confirmation that the customer was informed.',
  customerNotPresentPath: 'Customer not present: hide customer acknowledgement/signature fields and use notice-left-on-premises as the handover confirmation.',
  immediatelyDangerousPath: 'Immediately Dangerous: default label fitted and isolation/capping actions on, unless the engineer explicitly records refusal instead.',
  atRiskPath: 'At Risk: keep action controls available without forcing the Immediately Dangerous defaults.',
} as const;
