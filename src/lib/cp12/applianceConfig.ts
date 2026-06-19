// Data-driven appliance-type configuration for CP12 certificates.
//
// A real CP12 covers ALL gas appliances in a property, not just boilers. This file
// is the single source of truth for:
//   (a) Step 2  — the appliance category picker, and the boiler-only subtype picker;
//   (b) Step 3  — which check fields render for each appliance category;
//   (c) the PDF — which appliance-grid cells must read "N/A" because the field does
//                 not apply to that category (a blank CP12 cell reads as "not checked").
//
// To tune the rules later, edit the CP12_APPLIANCE_CONFIG map below — no component
// logic needs to change.
//
// ⚠️ NEEDS GAS-SAFE VALIDATION before launch: the field-applicability rules tagged
// `// NEEDS GAS-SAFE VALIDATION` were set by a developer, not a registered Gas Safe
// engineer. A registered engineer must confirm them before production use. The
// flued-only flue rules and the cooker-stability rule are confirmed; the combustion
// rule for gas fires / water heaters is the one still pending sign-off.

export type Cp12ApplianceCategory = 'boiler' | 'hob_cooker' | 'gas_fire' | 'water_heater' | 'other';

// Fields whose visibility/validation varies by category. Fields not listed here
// (e.g. make, model, location, serial, landlord's appliance, inspected, defect
// notes) apply to every category and are always shown.
export type Cp12CheckField =
  | 'flue_type'
  | 'operating_pressure'
  | 'heat_input'
  | 'combustion' // the high/low CO ppm + CO2 % + ratio block, treated as one unit
  | 'safety_devices_correct'
  | 'ventilation_satisfactory'
  | 'flue_condition' // visual condition of flue & termination
  | 'flue_performance_test'
  | 'gas_tightness_test'
  | 'cooker_stability' // free-standing cooker stability bracket/chain
  | 'appliance_serviced'
  | 'safe_to_use'
  | 'classification'; // Safe / NCS / AR / ID

// 'shown'    — always render + count toward completion.
// 'optional' — hidden by default, engineer can opt in (combustion on fires/heaters).
//              In the PDF an opted-out cell reads "N/A".
// 'hidden'   — never render; the PDF cell reads "N/A".
export type Cp12FieldVisibility = 'shown' | 'optional' | 'hidden';

export const CP12_APPLIANCE_CATEGORIES: ReadonlyArray<{ value: Cp12ApplianceCategory; label: string }> = [
  { value: 'boiler', label: 'Boiler' },
  { value: 'hob_cooker', label: 'Gas Hob/Cooker' },
  { value: 'gas_fire', label: 'Gas Fire' },
  { value: 'water_heater', label: 'Water Heater' },
  { value: 'other', label: 'Other' },
];

// Boiler subtype. These four values were previously (and wrongly) offered as the
// appliance *type* — they only make sense for category = Boiler.
export const CP12_BOILER_SUBTYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'combi', label: 'Combi' },
  { value: 'system', label: 'System' },
  { value: 'regular', label: 'Regular' },
  { value: 'other', label: 'Other' },
];

export const DEFAULT_CP12_CATEGORY: Cp12ApplianceCategory = 'boiler';

export type Cp12CategoryConfig = {
  label: string;
  flued: boolean;
  hasSubtype: boolean; // shows the boiler subtype picker in Step 2
  fields: Record<Cp12CheckField, Cp12FieldVisibility>;
};

// Common checks that apply to every appliance category.
const COMMON_FIELDS: Pick<
  Record<Cp12CheckField, Cp12FieldVisibility>,
  | 'operating_pressure'
  | 'heat_input'
  | 'safety_devices_correct'
  | 'ventilation_satisfactory'
  | 'gas_tightness_test'
  | 'appliance_serviced'
  | 'safe_to_use'
  | 'classification'
> = {
  // Operating pressure + heat input stay available for all combustion appliances.
  operating_pressure: 'shown',
  heat_input: 'shown',
  // Safety device, ventilation, serviced, safe-to-use and classification apply to ALL.
  safety_devices_correct: 'shown',
  ventilation_satisfactory: 'shown',
  gas_tightness_test: 'shown',
  appliance_serviced: 'shown',
  safe_to_use: 'shown',
  classification: 'shown',
};

export const CP12_APPLIANCE_CONFIG: Record<Cp12ApplianceCategory, Cp12CategoryConfig> = {
  boiler: {
    label: 'Boiler',
    flued: true,
    hasSubtype: true,
    fields: {
      ...COMMON_FIELDS,
      flue_type: 'shown',
      flue_condition: 'shown',
      flue_performance_test: 'shown',
      combustion: 'shown',
      cooker_stability: 'hidden',
    },
  },
  hob_cooker: {
    label: 'Gas Hob/Cooker',
    flued: false, // hobs/cookers are flueless
    hasSubtype: false,
    fields: {
      ...COMMON_FIELDS,
      // Flueless: no flue fields at all.
      flue_type: 'hidden',
      flue_condition: 'hidden',
      flue_performance_test: 'hidden',
      // Flueless appliances are not combustion-analysed on a CP12.
      combustion: 'hidden',
      // Free-standing cookers need a stability check boilers don't.
      cooker_stability: 'shown',
    },
  },
  gas_fire: {
    label: 'Gas Fire',
    flued: true,
    hasSubtype: false,
    fields: {
      ...COMMON_FIELDS,
      flue_type: 'shown',
      flue_condition: 'shown',
      flue_performance_test: 'shown',
      // NEEDS GAS-SAFE VALIDATION: combustion hidden by default for fires; engineer opts in.
      combustion: 'optional',
      cooker_stability: 'hidden',
    },
  },
  water_heater: {
    label: 'Water Heater',
    flued: true,
    hasSubtype: false,
    fields: {
      ...COMMON_FIELDS,
      flue_type: 'shown',
      flue_condition: 'shown',
      flue_performance_test: 'shown',
      // NEEDS GAS-SAFE VALIDATION: combustion hidden by default for water heaters; engineer opts in.
      combustion: 'optional',
      cooker_stability: 'hidden',
    },
  },
  other: {
    label: 'Other',
    flued: true, // unknown — keep flue + readings available so nothing is forced off
    hasSubtype: false,
    fields: {
      ...COMMON_FIELDS,
      flue_type: 'shown',
      flue_condition: 'shown',
      flue_performance_test: 'shown',
      combustion: 'optional',
      cooker_stability: 'hidden',
    },
  },
};

// Legacy `appliance_type` rows stored boiler subtypes ('combi'/'system'/'regular'/
// 'other') or the older mixed labels ('gas fire', 'gas hob', 'cooker', ...). Map any
// stored value to a canonical category so old certificates keep rendering correctly.
export function resolveCp12Category(value: string | null | undefined): Cp12ApplianceCategory {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return DEFAULT_CP12_CATEGORY;
  if (v in CP12_APPLIANCE_CONFIG) return v as Cp12ApplianceCategory;
  if (/(hob|cooker)/.test(v)) return 'hob_cooker';
  if (/fire/.test(v)) return 'gas_fire';
  if (/water\s*heater/.test(v)) return 'water_heater';
  if (/boiler|combi|system|regular|back/.test(v)) return 'boiler';
  // Bare legacy 'other' came from the old boiler-only subtype picker → treat as boiler.
  if (v === 'other') return 'boiler';
  return 'other';
}

// Resolve the boiler subtype, falling back to a legacy `appliance_type` value when a
// dedicated subtype was never stored.
export function resolveCp12Subtype(
  category: Cp12ApplianceCategory,
  subtype: string | null | undefined,
  legacyType?: string | null,
): string {
  if (category !== 'boiler') return '';
  const explicit = String(subtype ?? '').trim().toLowerCase();
  if (explicit) return explicit;
  const legacy = String(legacyType ?? '').trim().toLowerCase();
  const match = CP12_BOILER_SUBTYPES.find((s) => legacy.includes(s.value));
  return match?.value ?? '';
}

export function cp12FieldVisibility(
  category: Cp12ApplianceCategory,
  field: Cp12CheckField,
): Cp12FieldVisibility {
  return CP12_APPLIANCE_CONFIG[category]?.fields[field] ?? 'shown';
}

// True when a field should render in the form for this category (shown OR opt-in).
export function cp12FieldVisible(category: Cp12ApplianceCategory, field: Cp12CheckField): boolean {
  return cp12FieldVisibility(category, field) !== 'hidden';
}

// Human label for the PDF "type" column and summaries, e.g. "Combi boiler", "Gas Fire".
export function cp12ApplianceTypeLabel(
  category: Cp12ApplianceCategory,
  subtype?: string | null,
): string {
  const base = CP12_APPLIANCE_CONFIG[category]?.label ?? 'Other';
  if (category === 'boiler') {
    const sub = CP12_BOILER_SUBTYPES.find((s) => s.value === String(subtype ?? '').trim().toLowerCase());
    if (sub && sub.value !== 'other') return `${sub.label} boiler`;
  }
  return base;
}

export const CP12_NOT_APPLICABLE = 'N/A';
