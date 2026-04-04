import type { EvidenceField } from '@/types/cp12';

// Dropdown options (values are persisted as-is in job_fields).
export const BOILER_SERVICE_TYPES = [
  { value: 'combi', label: 'Combi' },
  { value: 'system', label: 'System' },
  { value: 'regular', label: 'Regular' },
  { value: 'other', label: 'Other' },
] as const;

export const BOILER_SERVICE_MOUNT_TYPES = [
  { value: 'wall', label: 'Wall' },
  { value: 'floor', label: 'Floor' },
] as const;

export const BOILER_SERVICE_GAS_TYPES = [
  { value: 'natural gas', label: 'Natural gas' },
  { value: 'lpg', label: 'LPG' },
] as const;

export const BOILER_SERVICE_FLUE_TYPES = [
  { value: 'room sealed', label: 'Room sealed' },
  { value: 'open flue', label: 'Open flue' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'other', label: 'Other' },
] as const;

export const BOILER_SERVICE_PHOTO_CATEGORIES = ['boiler', 'serial_label', 'flue', 'before_after', 'issue_defect'] as const;
export type BoilerServicePhotoCategory = (typeof BOILER_SERVICE_PHOTO_CATEGORIES)[number];

export type BoilerServiceJobInfo = {
  customer_name: string;
  customer_company: string;
  customer_address_line1: string;
  customer_address_line2: string;
  customer_city: string;
  customer_postcode: string;
  customer_phone: string;
  property_address: string;
  postcode: string;
  service_date: string;
  engineer_name: string;
  gas_safe_number: string;
  company_name: string;
  company_address: string;
};

export type BoilerServiceDetails = {
  boiler_make: string;
  boiler_model: string;
  boiler_type: string;
  boiler_location: string;
  serial_number: string;
  gas_type: string;
  mount_type: string;
  flue_type: string;
};

export type BoilerServiceChecks = {
  service_visual_inspection: string;
  service_burner_cleaned: string;
  service_heat_exchanger_cleaned: string;
  service_condensate_trap_checked: string;
  service_seals_checked: string;
  service_filters_cleaned: string;
  service_flue_checked: string;
  service_ventilation_checked: string;
  service_controls_checked: string;
  service_leaks_checked: string;
  operating_pressure_mbar: string;
  inlet_pressure_mbar: string;
  heat_input: string;
  co_ppm: string;
  co2_percent: string;
  flue_gas_temp_c: string;
  system_pressure_bar: string;
  appliance_conforms_standards: string;
  cylinder_condition_checked: string;
  co_alarm_fitted: string;
  all_functional_parts_available: string;
  warm_air_grills_working: string;
  magnetic_filter_fitted: string;
  water_quality_acceptable: string;
  warning_notice_explained: string;
  appliance_replacement_recommended: string;
  system_improvements_recommended: string;
  service_summary: string;
  recommendations: string;
  defects_found: string;
  defects_details: string;
  parts_used: string;
  next_service_due: string;
};

export type BoilerServiceSignatureKey = 'engineer_signature' | 'customer_signature';

export const BOILER_SERVICE_REQUIRED_FOR_ISSUE: Array<
  | keyof BoilerServiceJobInfo
  | keyof BoilerServiceDetails
  | keyof BoilerServiceChecks
  | BoilerServiceSignatureKey
> = [
  'property_address',
  'service_date',
  'engineer_name',
  'gas_safe_number',
  'boiler_make',
  'boiler_model',
  'boiler_location',
  'service_summary',
  'recommendations',
  'engineer_signature',
  'customer_signature',
];

export const BOILER_SERVICE_EVIDENCE_CARDS: {
  key: BoilerServicePhotoCategory;
  title: string;
  fields: EvidenceField[];
}[] = [
  {
    key: 'boiler',
    title: 'Boiler details',
    fields: [
      { key: 'boiler_make', label: 'Boiler make' },
      { key: 'boiler_model', label: 'Boiler model' },
      { key: 'boiler_type', label: 'Boiler type', type: 'select', options: BOILER_SERVICE_TYPES },
      { key: 'boiler_location', label: 'Location' },
      { key: 'mount_type', label: 'Mount type', type: 'select', options: BOILER_SERVICE_MOUNT_TYPES },
      { key: 'gas_type', label: 'Gas type', type: 'select', options: BOILER_SERVICE_GAS_TYPES },
      { key: 'flue_type', label: 'Flue type', type: 'select', options: BOILER_SERVICE_FLUE_TYPES },
    ],
  },
  {
    key: 'serial_label',
    title: 'Serial / Label',
    fields: [{ key: 'serial_number', label: 'Serial number' }],
  },
  {
    key: 'flue',
    title: 'Flue evidence',
    fields: [],
  },
  {
    key: 'before_after',
    title: 'Before / After',
    fields: [],
  },
  {
    key: 'issue_defect',
    title: 'Issue / Defect',
    fields: [],
  },
];

export const BOILER_SERVICE_DEMO_INFO: BoilerServiceJobInfo = {
  customer_name: 'Demo Customer',
  customer_company: 'Demo Property Ltd',
  customer_address_line1: '12 Example Road',
  customer_address_line2: 'Suite 4',
  customer_city: 'London',
  customer_postcode: 'SW1A 1AA',
  customer_phone: '07700 900123',
  property_address: '15 Acacia Avenue, London',
  postcode: 'SW1A 1AA',
  service_date: () => new Date().toISOString().slice(0, 10),
  engineer_name: 'Alex Engineer',
  gas_safe_number: 'GS123456',
  company_name: 'certnow Heating Services Ltd',
  company_address: '12 Example Road, London',
} as unknown as BoilerServiceJobInfo;

export const BOILER_SERVICE_DEMO_DETAILS: BoilerServiceDetails = {
  boiler_make: 'Worcester Bosch',
  boiler_model: 'Greenstar 30i',
  boiler_type: 'combi',
  boiler_location: 'Kitchen cupboard',
  serial_number: 'WB30I-84736291',
  gas_type: 'natural gas',
  mount_type: 'wall',
  flue_type: 'room sealed',
};

export const BOILER_SERVICE_DEMO_CHECKS: BoilerServiceChecks = {
  service_visual_inspection: 'yes',
  service_burner_cleaned: 'yes',
  service_heat_exchanger_cleaned: 'yes',
  service_condensate_trap_checked: 'yes',
  service_seals_checked: 'yes',
  service_filters_cleaned: 'yes',
  service_flue_checked: 'yes',
  service_ventilation_checked: 'yes',
  service_controls_checked: 'yes',
  service_leaks_checked: 'yes',
  operating_pressure_mbar: '20',
  inlet_pressure_mbar: '20',
  heat_input: '24',
  co_ppm: '8',
  co2_percent: '8.5',
  flue_gas_temp_c: '68',
  system_pressure_bar: '1.2',
  appliance_conforms_standards: 'yes',
  cylinder_condition_checked: 'yes',
  co_alarm_fitted: 'yes',
  all_functional_parts_available: 'yes',
  warm_air_grills_working: 'yes',
  magnetic_filter_fitted: 'yes',
  water_quality_acceptable: 'yes',
  warning_notice_explained: 'no',
  appliance_replacement_recommended: 'no',
  system_improvements_recommended: 'yes',
  service_summary: 'Serviced boiler, cleaned condensate trap, verified safety devices.',
  recommendations: 'Monitor pressure weekly; consider magnetic filter next visit.',
  defects_found: 'no',
  defects_details: '',
  parts_used: 'Condensate trap seal',
  next_service_due: `${new Date().getFullYear() + 1}-01-15`,
};
