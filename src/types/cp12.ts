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

export const CP12_DEMO_INFO = {
  customer_name: 'John Smith',
  property_address: '15 Acacia Avenue',
  postcode: 'SW1A 1AA',
  inspection_date: () => new Date().toISOString().slice(0, 10),
  engineer_name: 'Alex Turner',
  gas_safe_number: '123456',
  company_name: 'CertNow Heating Services Ltd',
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
