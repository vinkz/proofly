import { BOILER_SERVICE_REQUIRED_FOR_ISSUE } from '@/types/boiler-service';

// Single source of truth for what blocks issuing a Gas Appliance Service Record —
// shared by the wizard checklist and the server issue path (mirrors CP12/GWN).
//
// A service record has NO statutory content list. The only hard requirements are
// engineer identity (GSIUR Reg 3), appliance identity, and the Reg 26(9) safety
// examination outcomes. Benchmark service tasks, combustion readings, service
// summary/recommendations and the customer signature are conventional and must
// not block issue. See audit/gas-service-field-analysis.md.

type FieldMap = Record<string, unknown>;

const hasValue = (v: unknown) => v !== undefined && v !== null && String(v).trim().length > 0;
const anyHas = (fields: FieldMap, keys: string[]) => keys.some((k) => hasValue(fields[k]));

// Reg 26(9)(a)-(d) outcomes — each satisfied by its primary key or a service fallback.
const REG_26_9_OUTCOMES: Array<{ keys: string[]; label: string }> = [
  { keys: ['appliance_flueing_safe', 'service_flue_checked'], label: 'Flue safety result (Reg 26(9))' },
  { keys: ['appliance_ventilation_safe', 'service_ventilation_checked'], label: 'Ventilation result (Reg 26(9))' },
  { keys: ['operating_pressure_mbar', 'operating_pressure'], label: 'Operating pressure (Reg 26(9))' },
  { keys: ['heat_input'], label: 'Heat input (Reg 26(9))' },
  { keys: ['appliance_safe', 'appliance_operating_correctly', 'boiler_working_correctly'], label: 'Safe-functioning result (Reg 26(9))' },
];

export function validateGasServiceForIssue(fields: FieldMap): string[] {
  const errors: string[] = [];

  // Premises address — accept an explicit property_address or a job address + postcode.
  if (!hasValue(fields.property_address) && !(hasValue(fields.job_address_line1) && hasValue(fields.job_postcode))) {
    errors.push('Property address is required');
  }

  BOILER_SERVICE_REQUIRED_FOR_ISSUE.forEach((key) => {
    if (!hasValue(fields[key])) errors.push(`${String(key).replace(/_/g, ' ')} is required`);
  });

  // Reg 26(9) safety examination outcomes — the closest thing to legally required.
  REG_26_9_OUTCOMES.forEach(({ keys, label }) => {
    if (!anyHas(fields, keys)) errors.push(`${label} is required`);
  });

  // Engineer signature is required (GSIUR accountability); customer signature is optional.
  if (!anyHas(fields, ['engineer_signature', 'engineer_signature_path', 'engineer_signature_url'])) {
    errors.push('Engineer signature is required');
  }

  // Defect + remedial detail required when the appliance is recorded unsafe / defective.
  const unsafe = String(fields.defects_found ?? '').trim().toLowerCase() === 'yes'
    || ['no', 'fail', 'unsafe'].includes(String(fields.appliance_safe ?? '').trim().toLowerCase());
  if (unsafe && !hasValue(fields.defects_details)) {
    errors.push('Defect details are required when a defect is found or the appliance is unsafe');
  }

  return errors;
}
