/**
 * The CP12 field policy is deliberately framework-free. It is consumed by the
 * wizard for guidance, by the server for final issue validation, and by the
 * renderer when deciding which conventional sections are worth printing.
 */
export type Cp12FieldTier = 'tier_one' | 'tier_two' | 'tier_three';
export type Cp12WizardBehaviour = 'required' | 'conditional' | 'optional' | 'profile';
export type Cp12PdfBehaviour = 'always' | 'when_present' | 'when_applicable' | 'omit';

export type Cp12FieldConfig = {
  label: string;
  tier: Cp12FieldTier;
  wizard: Cp12WizardBehaviour;
  pdf: Cp12PdfBehaviour;
};

export const CP12_TEMPLATE_VERSION = 'cp12-template-v2' as const;

export const CP12_FIELD_CONFIG = {
  inspection_date: { label: 'Inspection date', tier: 'tier_one', wizard: 'required', pdf: 'always' },
  property_address: { label: 'Property address', tier: 'tier_one', wizard: 'required', pdf: 'always' },
  landlord_name: { label: 'Landlord or agent name', tier: 'tier_one', wizard: 'required', pdf: 'always' },
  landlord_address: { label: 'Landlord or agent correspondence address', tier: 'tier_one', wizard: 'required', pdf: 'always' },
  engineer_name: { label: 'Engineer name', tier: 'tier_one', wizard: 'profile', pdf: 'always' },
  gas_safe_number: { label: 'Gas Safe registration number', tier: 'tier_one', wizard: 'profile', pdf: 'always' },
  engineer_signature: { label: 'Engineer signature', tier: 'tier_one', wizard: 'required', pdf: 'always' },
  customer_signature: { label: 'Customer acknowledgement', tier: 'tier_two', wizard: 'conditional', pdf: 'when_present' },
  reg_26_9_confirmed: { label: 'Regulation 26(9) confirmation', tier: 'tier_one', wizard: 'required', pdf: 'always' },
  appliance_description: { label: 'Appliance description', tier: 'tier_one', wizard: 'required', pdf: 'always' },
  appliance_location: { label: 'Appliance location', tier: 'tier_one', wizard: 'required', pdf: 'always' },
  flue_location: { label: 'Flue location', tier: 'tier_two', wizard: 'conditional', pdf: 'when_applicable' },
  defects: { label: 'Defects identified', tier: 'tier_one', wizard: 'conditional', pdf: 'always' },
  remedial_action: { label: 'Remedial action taken', tier: 'tier_one', wizard: 'conditional', pdf: 'always' },
  company_details: { label: 'Company details', tier: 'tier_two', wizard: 'profile', pdf: 'when_present' },
  co_alarms: { label: 'CO alarm checks', tier: 'tier_two', wizard: 'optional', pdf: 'when_present' },
  whole_house_checks: { label: 'Whole-house checks', tier: 'tier_two', wizard: 'optional', pdf: 'when_present' },
  notes: { label: 'Additional notes', tier: 'tier_three', wizard: 'optional', pdf: 'when_present' },
} as const satisfies Record<string, Cp12FieldConfig>;

export type Cp12FieldKey = keyof typeof CP12_FIELD_CONFIG;

export function cp12FieldShouldRender(key: Cp12FieldKey, value: unknown) {
  const behaviour = CP12_FIELD_CONFIG[key].pdf;
  if (behaviour === 'always') return true;
  return typeof value === 'boolean' ? value : String(value ?? '').trim().length > 0;
}
