export const CERTIFICATE_TYPES = ['cp12', 'gas_service', 'general_works'] as const;
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

export const CERTIFICATE_LABELS: Record<CertificateType, string> = {
  'cp12': 'CP12 Gas Safety Certificate',
  'gas_service': 'Boiler Service Record',
  'general_works': 'General Works Report',
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

export type Cp12Appliance = {
  id?: string;
  appliance_type: string;
  location: string;
  make_model: string;
  operating_pressure: string;
  heat_input: string;
  flue_type: string;
  ventilation_provision: string;
  ventilation_satisfactory: string;
  flue_condition: string;
  stability_test: string;
  gas_tightness_test: string;
  co_reading_ppm: string;
  safety_rating: string;
  classification_code: string;
};
