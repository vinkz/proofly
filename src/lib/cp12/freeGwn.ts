/**
 * Gas Warning Notices arising from a free CP12.
 *
 * A CP12 that classifies an appliance At Risk or Immediately Dangerous records
 * a GIUSP unsafe situation, and that sits on binding duties: GSIUR Reg 26(9)
 * (notify the responsible person), the GIUSP procedure itself (isolate, cap,
 * label, notify), and for ID a RIDDOR 2013 Reg 6(2) report to HSE within 14
 * days. See audit/gas-warning-notice-field-analysis.md.
 *
 * Without this, the free tool would happily emit a certificate saying
 * "Immediately Dangerous" while leaving the procedure half-done. So the notice
 * is not an optional extra here — it completes the unsafe path.
 *
 * Uses the same renderer and the same issue gate (validateGwnForIssue) as the
 * authenticated flow.
 */
import { cp12ApplianceTypeLabel, resolveCp12Category, resolveCp12Subtype } from './applianceConfig';
import type { FreeCp12Appliance, FreeCp12Payload } from './freeCp12Payload';
import { validateGwnForIssue } from '@/lib/gwn/validation';
import type { GasWarningClassification, GasWarningNoticeFields } from '@/types/gas-warning-notice';

/** Map the CP12 appliance classification onto the notice's classification. */
export function gwnClassificationFor(appliance: FreeCp12Appliance): GasWarningClassification | null {
  const value = String(appliance.safety_classification ?? '').trim().toLowerCase();
  if (value === 'id' || value === 'immediately dangerous' || value === 'immediately_dangerous') {
    return 'IMMEDIATELY_DANGEROUS';
  }
  if (value === 'ar' || value === 'at risk' || value === 'at_risk') return 'AT_RISK';
  return null;
}

export type UnsafeAppliance = {
  index: number;
  appliance: FreeCp12Appliance;
  classification: GasWarningClassification;
};

/** Every appliance on the record that needs a warning notice. */
export function unsafeAppliances(payload: FreeCp12Payload): UnsafeAppliance[] {
  return payload.appliances.flatMap((appliance, index) => {
    const classification = gwnClassificationFor(appliance);
    return classification ? [{ index, appliance, classification }] : [];
  });
}

const joinAddress = (parts: Array<string | undefined>) =>
  parts.map((part) => (part ?? '').trim()).filter(Boolean).join(', ');

export function freeCp12PropertyAddress(payload: FreeCp12Payload) {
  return joinAddress([
    payload.fields.job_address_line1,
    payload.fields.job_address_line2,
    payload.fields.job_address_city,
    payload.fields.job_postcode,
  ]);
}

/**
 * Build the notice for one unsafe appliance.
 *
 * The identifying and engineer details come from the CP12 the engineer has
 * already filled in; only the GIUSP-specific answers are asked for again.
 */
export function buildFreeGwnFields(
  payload: FreeCp12Payload,
  unsafe: UnsafeAppliance,
  options: { recordId: string; issuedAt: Date },
): GasWarningNoticeFields {
  const { appliance, classification } = unsafe;
  const category = resolveCp12Category(appliance.appliance_type);
  const subtype = resolveCp12Subtype(category, appliance.appliance_subtype, appliance.appliance_type);
  const situation = appliance.unsafe_situation;

  const customerPresent = situation.customer_present === 'Yes';

  return {
    property_address: freeCp12PropertyAddress(payload),
    postcode: payload.fields.job_postcode,
    job_address_line1: payload.fields.job_address_line1,
    job_address_line2: payload.fields.job_address_line2,
    job_address_city: payload.fields.job_address_city,
    job_postcode: payload.fields.job_postcode,

    // The responsible person on a let property is the landlord or their agent.
    customer_name: payload.fields.landlord_name,
    customer_company: payload.fields.landlord_company,
    customer_contact: payload.fields.landlord_tel,
    customer_address_line1: payload.fields.landlord_address_line1,
    customer_address_line2: payload.fields.landlord_address_line2,
    customer_city: payload.fields.landlord_city,
    customer_postcode: payload.fields.landlord_postcode,

    appliance_location: appliance.location,
    appliance_type: cp12ApplianceTypeLabel(category, subtype),
    make_model: appliance.make_model,

    classification,
    classification_code: classification === 'IMMEDIATELY_DANGEROUS' ? 'ID' : 'AR',
    unsafe_situation_description: appliance.defect_notes,
    actions_taken: appliance.actions_taken || appliance.actions_required,

    gas_supply_isolated: situation.gas_supply_isolated === 'Yes',
    appliance_capped_off: situation.appliance_capped_off === 'Yes',
    customer_refused_isolation: situation.customer_refused_isolation === 'Yes',
    danger_do_not_use_label_fitted: situation.danger_label_fitted === 'Yes',
    emergency_services_contacted: situation.emergency_services_contacted === 'Yes',

    customer_present: customerPresent,
    customer_informed: customerPresent && situation.customer_informed === 'Yes',
    notice_left_on_premises: !customerPresent && situation.notice_left_on_premises === 'Yes',

    riddor_11_1_reported: situation.riddor_reported === 'Yes',
    emergency_reference: situation.riddor_reference,

    engineer_name: payload.fields.engineer_name,
    engineer_company: payload.fields.company_name,
    gas_safe_number: payload.fields.gas_safe_number,
    engineer_id_card_number: payload.fields.engineer_id_card_number,
    engineer_signature_url: payload.fields.engineer_signature,

    issued_at: options.issuedAt.toISOString(),
    record_id: options.recordId,
  };
}

/**
 * Issue-blocking problems across every notice this record would produce,
 * labelled by appliance so the engineer knows which one to fix.
 */
export function freeGwnIssues(
  payload: FreeCp12Payload,
  options: { recordId: string; issuedAt: Date },
): string[] {
  return unsafeAppliances(payload).flatMap((unsafe) =>
    validateGwnForIssue(buildFreeGwnFields(payload, unsafe, options)).map(
      (error) => `Appliance ${unsafe.index + 1} warning notice: ${error}`,
    ),
  );
}
