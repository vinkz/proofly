export type GasWarningClassification = 'IMMEDIATELY_DANGEROUS' | 'AT_RISK';

export type GasWarningNoticeFields = {
  property_address?: string;
  postcode?: string;
  customer_name?: string;
  customer_contact?: string;
  appliance_location?: string;
  appliance_type?: string;
  make_model?: string;
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
