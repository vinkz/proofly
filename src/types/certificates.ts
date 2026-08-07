export const CERTIFICATE_TYPES = [
  'cp12',
  'gas_service',
  'general_works',
  'gas_warning_notice',
  'breakdown',
  'commissioning',
] as const;
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

export const CERTIFICATE_LABELS: Record<CertificateType, string> = {
  'cp12': 'CP12 Gas Safety Certificate',
  'gas_service': 'Boiler Service Record',
  'general_works': 'General Works Report',
  'gas_warning_notice': 'Gas Warning Notice',
  'breakdown': 'Gas Breakdown Record',
  'commissioning': 'Commissioning Checklist',
};

export const PHOTO_CATEGORIES = [
  { key: 'appliance_photo', label: 'Appliance photo' },
  { key: 'serial_label', label: 'Serial/Label' },
  { key: 'flue_photo', label: 'Flue photo' },
  { key: 'meter_reading', label: 'Meter reading' },
  { key: 'ventilation', label: 'Ventilation' },
  { key: 'issue_photo', label: 'Issue/Defect' },
  { key: 'boiler', label: 'Boiler' },
  { key: 'flue', label: 'Flue' },
  { key: 'before_after', label: 'Before/After' },
  { key: 'issue_defect', label: 'Issue/Defect' },
  { key: 'site', label: 'Site' },
  { key: 'before', label: 'Before' },
  { key: 'after', label: 'After' },
  { key: 'parts', label: 'Parts' },
  { key: 'receipt_invoice', label: 'Receipt/Invoice' },
] as const;

export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number]['key'];

export type JobFieldPayload = Record<string, string | null | undefined>;

export type Cp12SafetyClassification = 'safe' | 'ncs' | 'ar' | 'id';

export type Cp12Appliance = {
  id?: string;
  // appliance_type holds the appliance CATEGORY (boiler | hob_cooker | gas_fire |
  // water_heater | other). See src/lib/cp12/applianceConfig.ts.
  appliance_type: string;
  // Boiler-only subtype (combi/system/regular/other); '' for non-boilers.
  appliance_subtype: string;
  // Free-standing cooker stability check; only used for hob/cooker category.
  cooker_stability: string;
  landlords_appliance: string;
  appliance_inspected: string;
  location: string;
  make_model: string;
  /**
   * Natural gas or LPG, per appliance.
   *
   * Held here rather than once per record because one property can run a mains
   * gas boiler alongside an LPG appliance on a bottle — a record-level value
   * would have to claim one fuel for both, and the fuel is the field that
   * decides which part of an engineer's registration the work falls under.
   */
  gas_type: string;
  /**
   * Gas Council number from the appliance data plate, e.g. "47-311-92".
   *
   * Free text and never inferred from make/model: not every appliance has one
   * (modern units carry a CE/UKCA PIN instead), and where one exists it belongs
   * to a model variant rather than the model, so there is no safe lookup. A
   * wrong GC number on a safety record is worse than a blank one. Not required
   * by Reg 36(3) either — this is a convention engineers expect, not a legal
   * minimum, so nothing validates it.
   */
  gc_number: string;
  operating_pressure: string;
  heat_input: string;
  high_co_ppm: string;
  high_co2: string;
  high_ratio: string;
  low_co_ppm: string;
  low_co2: string;
  low_ratio: string;
  co_reading_high: string;
  co_reading_low: string;
  flue_type: string;
  flue_location: string;
  ventilation_provision: string;
  ventilation_satisfactory: string;
  flue_condition: string;
  stability_test: string;
  gas_tightness_test: string;
  co_reading_ppm: string;
  safety_devices_correct: string;
  /** Flue flow test — open-flued appliances only. */
  flue_performance_test: string;
  /** Flue integrity test — room-sealed / balanced-flue appliances only. */
  flue_integrity_test: string;
  /** Air-inlet CO2 % at high and low rate. Optional evidence for the above. */
  flue_integrity_co2_high: string;
  flue_integrity_co2_low: string;
  /** Spillage test — open-flued appliances only. */
  spillage_test: string;
  appliance_serviced: string;
  combustion_notes: string;
  safety_rating: string;
  classification_code: string;
  safety_classification: Cp12SafetyClassification | '';
  defect_notes: string;
  actions_taken: string;
  actions_required: string;
  warning_notice_issued: boolean;
  appliance_disconnected: boolean;
  danger_do_not_use_attached: boolean;
  reg_26_9_confirmed: boolean;
};
