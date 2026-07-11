import { CP12_FIELD_CONFIG } from './field-config';

export type Cp12TierOneAppliance = {
  appliance_type?: string | null;
  location?: string | null;
  make_model?: string | null;
  safety_rating?: string | null;
  safety_classification?: string | null;
  classification_code?: string | null;
  defect_notes?: string | null;
  actions_taken?: string | null;
  actions_required?: string | null;
  warning_notice_issued?: boolean | null;
  reg_26_9_confirmed?: boolean | string | null;
};

export type Cp12TierOneInput = {
  fields: Record<string, unknown>;
  appliances: Cp12TierOneAppliance[];
  requireCustomerSignature?: boolean;
};

const hasText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const isAffirmative = (value: unknown) => value === true || ['true', 'yes', 'pass', 'confirmed'].includes(String(value ?? '').trim().toLowerCase());

function landlordAddress(fields: Record<string, unknown>) {
  return [
    fields.landlord_address,
    fields.landlord_address_line1,
    fields.landlord_address_line2,
    fields.landlord_city,
    fields.landlord_town,
    fields.landlord_postcode,
  ].some(hasText);
}

function signaturePresent(fields: Record<string, unknown>, role: 'engineer' | 'customer') {
  const keys = role === 'engineer'
    ? ['engineer_signature_path', 'engineer_signature', 'engineer_signature_url']
    : ['customer_signature_path', 'customer_signature', 'customer_signature_url'];
  return keys.some((key) => hasText(fields[key]));
}

function isUnsafe(appliance: Cp12TierOneAppliance) {
  const values = [appliance.safety_rating, appliance.safety_classification, appliance.classification_code]
    .map((value) => String(value ?? '').trim().toLowerCase());
  return values.some((value) => value && !['safe', 'ncs', 'not to current standards'].includes(value));
}

/** The authoritative statutory-minimum issue gate. Draft persistence remains permissive. */
export function validateCp12TierOne(input: Cp12TierOneInput): string[] {
  const { fields, appliances, requireCustomerSignature = true } = input;
  const errors: string[] = [];

  (['inspection_date', 'property_address', 'landlord_name', 'engineer_name', 'gas_safe_number'] as const).forEach((key) => {
    if (!hasText(fields[key])) errors.push(`${CP12_FIELD_CONFIG[key].label} is required`);
  });
  // Deliberately do not fall back to property_address: a landlord who lives at the
  // property may enter the same text, but it must have been captured as their address.
  if (!landlordAddress(fields)) errors.push(`${CP12_FIELD_CONFIG.landlord_address.label} is required`);
  if (!isAffirmative(fields.reg_26_9_confirmed)) {
    errors.push(`${CP12_FIELD_CONFIG.reg_26_9_confirmed.label} is required`);
  }

  const activeAppliances = (appliances ?? []).filter((appliance) => hasText(appliance.appliance_type) || hasText(appliance.location) || hasText(appliance.make_model));
  if (!activeAppliances.length) {
    errors.push('At least one appliance with description and location is required');
  }

  activeAppliances.forEach((appliance, index) => {
    if (!hasText(appliance.appliance_type) && !hasText(appliance.make_model)) {
      errors.push(`Appliance ${index + 1}: ${CP12_FIELD_CONFIG.appliance_description.label} is required`);
    }
    if (!hasText(appliance.location)) {
      errors.push(`Appliance ${index + 1}: ${CP12_FIELD_CONFIG.appliance_location.label} is required`);
    }
    if (!isAffirmative(appliance.reg_26_9_confirmed)) {
      errors.push(`Appliance ${index + 1}: ${CP12_FIELD_CONFIG.reg_26_9_confirmed.label} is required`);
    }
  });

  const unsafe = activeAppliances.filter(isUnsafe);
  const hasRecordDefect = hasText(fields.defect_description);
  const hasRecordRemedial = hasText(fields.remedial_action);
  if (unsafe.length || hasRecordDefect || hasRecordRemedial) {
    const hasApplianceDefect = unsafe.some((appliance) => hasText(appliance.defect_notes));
    const hasApplianceRemedial = unsafe.some((appliance) => hasText(appliance.actions_taken) || hasText(appliance.actions_required));
    if (!hasRecordDefect && !hasApplianceDefect) errors.push('Defect description is required when an appliance is unsafe');
    if (!hasRecordRemedial && !hasApplianceRemedial) errors.push('Remedial action is required when an appliance is unsafe');
  }

  if (!signaturePresent(fields, 'engineer')) errors.push(`${CP12_FIELD_CONFIG.engineer_signature.label} is required`);
  if (requireCustomerSignature && !signaturePresent(fields, 'customer')) {
    errors.push('Customer signature is required');
  }
  return errors;
}
