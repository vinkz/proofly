// CP12 dropdown options and demo defaults. Keep values stable for storage.

export const CP12_APPLIANCE_TYPES = [
  { value: 'combi boiler', label: 'Combi boiler' },
  { value: 'system boiler', label: 'System boiler' },
  { value: 'back boiler', label: 'Back boiler' },
  { value: 'gas fire', label: 'Gas fire' },
  { value: 'gas hob', label: 'Gas hob' },
  { value: 'cooker', label: 'Cooker' },
  { value: 'water heater', label: 'Water heater' },
  { value: 'other', label: 'Other' },
] as const;

export const CP12_FLUE_TYPES = [
  { value: 'room sealed', label: 'Room sealed' },
  { value: 'open flue', label: 'Open flue' },
  { value: 'balanced flue', label: 'Balanced flue' },
  { value: 'flueless', label: 'Flueless' },
  { value: 'other', label: 'Other' },
] as const;

export const CP12_LOCATIONS = [
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'kitchen cupboard', label: 'Kitchen cupboard' },
  { value: 'utility room', label: 'Utility room' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'hallway', label: 'Hallway' },
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'living room', label: 'Living room' },
  { value: 'loft', label: 'Loft' },
  { value: 'garage', label: 'Garage' },
  { value: 'external', label: 'External' },
  { value: 'other', label: 'Other' },
] as const;

export const CP12_VENTILATION = [
  { value: 'adequate ventilation', label: 'Adequate ventilation' },
  { value: 'permanent ventilation present', label: 'Permanent ventilation present' },
  { value: 'no permanent ventilation required', label: 'No permanent ventilation required' },
  { value: 'ventilation inadequate', label: 'Ventilation inadequate' },
] as const;

export type EvidenceField = {
  key: string;
  label: string;
  type?: 'text' | 'select' | 'number';
  options?: { value: string; label: string }[];
};

export const CP12_EVIDENCE_CONFIG: {
  key: string;
  title: string;
  fields: EvidenceField[];
  demo?: Record<string, string>;
}[] = [
  {
    key: 'appliance_photo',
    title: 'Appliance',
    fields: [
      { key: 'boiler_make', label: 'Boiler make' },
      { key: 'boiler_model', label: 'Boiler model' },
      { key: 'boiler_type', label: 'Boiler type', type: 'select', options: CP12_APPLIANCE_TYPES as any },
      { key: 'mount_type', label: 'Mount type', type: 'select', options: [{ value: 'wall', label: 'Wall' }, { value: 'floor', label: 'Floor' }] },
      { key: 'location', label: 'Location', type: 'select', options: CP12_LOCATIONS as any },
    ],
    demo: {
      boiler_make: 'Worcester Bosch',
      boiler_model: 'Greenstar 30i',
      boiler_type: 'combi boiler',
      mount_type: 'wall',
      location: 'kitchen cupboard',
    },
  },
  {
    key: 'serial_label',
    title: 'Serial / Label',
    fields: [
      { key: 'serial_number', label: 'Serial number' },
      { key: 'gas_type', label: 'Gas type' },
      { key: 'manufacture_year', label: 'Year of manufacture' },
    ],
    demo: {
      serial_number: 'WB30I-84736291',
      gas_type: 'Natural Gas (G20)',
      manufacture_year: '2019',
    },
  },
  {
    key: 'flue_photo',
    title: 'Flue photo',
    fields: [
      { key: 'flue_type', label: 'Flue type', type: 'select', options: CP12_FLUE_TYPES as any },
      { key: 'termination', label: 'Termination' },
      { key: 'condition', label: 'Condition' },
    ],
    demo: {
      flue_type: 'room sealed',
      termination: 'External wall',
      condition: 'Good',
    },
  },
  {
    key: 'meter_reading',
    title: 'Meter reading',
    fields: [
      { key: 'meter_reading', label: 'Reading' },
      { key: 'unit', label: 'Unit', type: 'select', options: [{ value: 'm3', label: 'm³' }, { value: 'ft3', label: 'ft³' }] },
      { key: 'meter_location', label: 'Location' },
    ],
    demo: {
      meter_reading: '012345',
      unit: 'm3',
      meter_location: 'Hallway cupboard',
    },
  },
  {
    key: 'ventilation',
    title: 'Ventilation',
    fields: [
      { key: 'ventilation_present', label: 'Ventilation present', type: 'select', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
      { key: 'condition', label: 'Condition', type: 'select', options: CP12_VENTILATION as any },
      { key: 'notes', label: 'Notes' },
    ],
    demo: {
      ventilation_present: 'yes',
      condition: 'adequate ventilation',
      notes: 'No obstructions observed',
    },
  },
  {
    key: 'issue_photo',
    title: 'Issue / Defect',
    fields: [
      { key: 'defect_present', label: 'Defect present', type: 'select', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] },
      { key: 'classification', label: 'Classification' },
      { key: 'notes', label: 'Notes' },
    ],
    demo: {
      defect_present: 'no',
      classification: 'N/A',
      notes: 'No safety defects identified at time of inspection.',
    },
  },
];
export const CP12_DEMO_INFO = {
  customer_name: 'John Smith',
  property_address: '15 Acacia Avenue',
  postcode: 'SW1A 1AA',
  inspection_date: () => new Date().toISOString().slice(0, 10),
  engineer_name: 'Alex Turner',
  gas_safe_number: '123456',
  company_name: 'certnow Heating Services Ltd',
  landlord_name: 'John Smith',
  landlord_address: '12 Example Road, London, SW1A 1AA',
  reg_26_9_confirmed: true,
  defect_description: 'No safety defects identified at time of inspection.',
  remedial_action: '',
  warning_notice_issued: 'NO',
} as const;

export const CP12_DEMO_APPLIANCE = {
  appliance_type: 'combi boiler',
  location: 'kitchen cupboard',
  make_model: 'Worcester Bosch Greenstar 30i',
  operating_pressure: '20 mbar',
  heat_input: '24 kW',
  flue_type: 'room sealed',
  ventilation_provision: 'adequate ventilation',
  ventilation_satisfactory: 'pass',
  flue_condition: 'pass',
  stability_test: 'pass',
  gas_tightness_test: 'pass',
  co_reading_ppm: '8',
  safety_rating: 'safe',
  classification_code: '',
} as const;
