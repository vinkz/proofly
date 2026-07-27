/**
 * The wire contract for the free CP12 tool's form.
 *
 * The form posts these values; the server validates them with the same
 * statutory gate the paid flow uses (validateCp12TierOne) and feeds them to the
 * same mapping (buildCp12RenderInput) and the same renderer. This file is only
 * a shape + a translation into the canonical CP12 field keys — no field policy
 * of its own, or the two flows would drift.
 *
 * Framework-free: imported by both the client form and the API routes.
 */
import { z } from 'zod';

import type { Cp12Appliance } from '@/types/certificates';
import type { Cp12RenderSource } from './buildCp12Render';

const str = (max = 200) => z.string().max(max).optional().default('');

/**
 * The GIUSP answers a warning notice needs and a CP12 does not. Only asked when
 * an appliance is classified At Risk or Immediately Dangerous. Yes/No/'' rather
 * than booleans so "not answered" stays distinguishable from "no" — the issue
 * gate treats those differently for Immediately Dangerous.
 */
const yesNo = z.enum(['Yes', 'No', '']).optional().default('');

export const FreeUnsafeSituationSchema = z.object({
  customer_present: yesNo,
  customer_informed: yesNo,
  notice_left_on_premises: yesNo,
  gas_supply_isolated: yesNo,
  appliance_capped_off: yesNo,
  customer_refused_isolation: yesNo,
  danger_label_fitted: yesNo,
  emergency_services_contacted: yesNo,
  /** RIDDOR 2013 Reg 6(2): ID fittings are reportable to HSE within 14 days. */
  riddor_reported: yesNo,
  riddor_reference: z.string().max(80).optional().default(''),
});

export type FreeUnsafeSituation = z.output<typeof FreeUnsafeSituationSchema>;

export const FreeCp12ApplianceSchema = z.object({
  // Category, per CP12_APPLIANCE_CONFIG. Free text is tolerated and normalised
  // by resolveCp12Category so an unexpected value can never drop an appliance.
  appliance_type: str(40),
  appliance_subtype: str(40),
  location: str(120),
  /**
   * Make and model are captured separately so they can be driven by the shared
   * appliance catalogue, and composed on the way to the renderer. make_model
   * remains accepted as free text for anything the catalogue does not list.
   */
  make: str(80),
  model: str(120),
  make_model: str(160),

  flue_type: str(60),
  flue_condition: str(20),
  flue_performance_test: str(20),
  cooker_stability: str(20),

  operating_pressure: str(40),
  heat_input: str(40),
  safety_devices_correct: str(20),
  ventilation_satisfactory: str(20),
  gas_tightness_test: str(20),
  appliance_serviced: str(20),

  high_co_ppm: str(20),
  high_co2: str(20),
  high_ratio: str(20),
  low_co_ppm: str(20),
  low_co2: str(20),
  low_ratio: str(20),

  safety_classification: str(40),
  defect_notes: str(1000),
  actions_taken: str(1000),
  actions_required: str(1000),
  warning_notice_issued: z.boolean().optional().default(false),
  reg_26_9_confirmed: z.boolean().optional().default(false),
  /**
   * Whether the engineer opted into combustion readings for a category where
   * they are optional. Stored on the appliance rather than by list position:
   * keyed by index it survived a removal and reattached itself to whichever
   * appliance slid into that slot.
   */
  combustion_opt_in: z.boolean().optional().default(false),
  unsafe_situation: FreeUnsafeSituationSchema.optional().default(() => FreeUnsafeSituationSchema.parse({})),
});

export type FreeCp12ApplianceInput = z.input<typeof FreeCp12ApplianceSchema>;
export type FreeCp12Appliance = z.output<typeof FreeCp12ApplianceSchema>;

export const FreeCp12FieldsSchema = z.object({
  inspection_date: str(20),

  // Property
  job_address_line1: str(160),
  job_address_line2: str(160),
  job_address_city: str(80),
  job_postcode: str(16),

  // Landlord / agent
  landlord_name: str(160),
  landlord_company: str(160),
  landlord_address_line1: str(160),
  landlord_address_line2: str(160),
  landlord_city: str(80),
  landlord_postcode: str(16),
  landlord_tel: str(40),

  // Engineer + business (the free tool's equivalent of the saved profile)
  engineer_name: str(120),
  gas_safe_number: str(40),
  engineer_id_card_number: str(40),
  company_name: str(160),
  company_address: str(240),
  company_phone: str(40),
  company_email: str(160),
  /** Data URL from the signature pad. Never a storage path — see buildCp12Render. */
  engineer_signature: z.string().max(400_000).optional().default(''),

  // Record-level outcome
  defect_description: str(2000),
  remedial_action: str(2000),
  comments: str(2000),

  // Optional whole-property checks
  co_alarm_fitted: str(20),
  co_alarm_tested: str(20),
  co_alarm_satisfactory: str(20),
  emergency_control_accessible: str(20),
  gas_tightness_satisfactory: str(20),
  pipework_visual_satisfactory: str(20),
  equipotential_bonding_satisfactory: str(20),
});

export const FreeCp12PayloadSchema = z.object({
  fields: FreeCp12FieldsSchema,
  appliances: z.array(FreeCp12ApplianceSchema).min(1).max(12),
});

export type FreeCp12Payload = z.output<typeof FreeCp12PayloadSchema>;
export type FreeCp12PayloadInput = z.input<typeof FreeCp12PayloadSchema>;

/**
 * Drop empty values. The mapping uses `??` chains, and an empty string is not
 * nullish — leaving `landlord_address_line1: ''` in place would suppress the
 * fallback that derives it from the free-text address. In the paid flow these
 * keys are simply absent (no job_fields row), so absence is the correct shape.
 */
function compact(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => !(typeof value === 'string' && value.trim() === '')),
  );
}

/** Fill the full appliance row shape the shared mapping expects. */
export function toCp12Appliance(input: FreeCp12Appliance): Cp12Appliance {
  return {
    appliance_type: input.appliance_type,
    appliance_subtype: input.appliance_subtype,
    cooker_stability: input.cooker_stability,
    landlords_appliance: 'Yes',
    appliance_inspected: 'Yes',
    location: input.location,
    make_model:
      [input.make, input.model].map((part) => part.trim()).filter(Boolean).join(' ') || input.make_model,
    operating_pressure: input.operating_pressure,
    heat_input: input.heat_input,
    high_co_ppm: input.high_co_ppm,
    high_co2: input.high_co2,
    high_ratio: input.high_ratio,
    low_co_ppm: input.low_co_ppm,
    low_co2: input.low_co2,
    low_ratio: input.low_ratio,
    co_reading_high: '',
    co_reading_low: '',
    flue_type: input.flue_type,
    // The paid flow defaults flue location to the appliance location for rows
    // that pre-date the dedicated field; match that rather than printing blank.
    flue_location: input.location,
    ventilation_provision: '',
    ventilation_satisfactory: input.ventilation_satisfactory,
    flue_condition: input.flue_condition,
    stability_test: '',
    gas_tightness_test: input.gas_tightness_test,
    co_reading_ppm: '',
    safety_devices_correct: input.safety_devices_correct,
    flue_performance_test: input.flue_performance_test,
    appliance_serviced: input.appliance_serviced,
    combustion_notes: '',
    safety_rating: '',
    classification_code: '',
    safety_classification: input.safety_classification as Cp12Appliance['safety_classification'],
    defect_notes: input.defect_notes,
    actions_taken: input.actions_taken,
    actions_required: input.actions_required,
    warning_notice_issued: input.warning_notice_issued,
    appliance_disconnected: false,
    danger_do_not_use_attached: false,
    reg_26_9_confirmed: input.reg_26_9_confirmed,
  };
}

/**
 * Translate a validated payload into the shared renderer input source.
 *
 * `recordId` / `certNumber` are ephemeral references generated per request.
 * Nothing here is persisted, so they are not stable across downloads — which is
 * precisely the friction an account removes.
 */
export function freeCp12ToRenderSource(
  payload: FreeCp12Payload,
  options: { recordId: string; certNumber: string; issuedAt: Date },
): Cp12RenderSource {
  return {
    fieldMap: compact({ ...payload.fields }),
    appliances: payload.appliances.map(toCp12Appliance),
    recordId: options.recordId,
    certNumber: options.certNumber,
    issuedAt: options.issuedAt,
    // No client or property records exist for an anonymous visitor; every value
    // came straight from the form.
  };
}

/** The shape validateCp12TierOne expects, built from the same payload. */
export function freeCp12ValidationInput(payload: FreeCp12Payload) {
  return {
    fields: {
      ...payload.fields,
      // The gate checks `property_address`; the form collects it as structured
      // lines, so present the composed value it is looking for.
      property_address: [
        payload.fields.job_address_line1,
        payload.fields.job_address_line2,
        payload.fields.job_address_city,
        payload.fields.job_postcode,
      ]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(', '),
    } as Record<string, unknown>,
    appliances: payload.appliances.map((appliance) => ({
      appliance_type: appliance.appliance_type,
      location: appliance.location,
      make_model:
        [appliance.make, appliance.model].map((p) => p.trim()).filter(Boolean).join(' ') ||
        appliance.make_model,
      safety_classification: appliance.safety_classification,
      defect_notes: appliance.defect_notes,
      actions_taken: appliance.actions_taken,
      actions_required: appliance.actions_required,
      warning_notice_issued: appliance.warning_notice_issued,
      reg_26_9_confirmed: appliance.reg_26_9_confirmed,
    })),
  };
}

/** Empty form state — the starting point, and what "reset" returns to. */
export function emptyFreeCp12Appliance(): FreeCp12Appliance {
  return FreeCp12ApplianceSchema.parse({ appliance_type: 'boiler', appliance_subtype: 'combi' });
}

export function emptyFreeCp12Payload(): FreeCp12Payload {
  return {
    fields: FreeCp12FieldsSchema.parse({}),
    appliances: [emptyFreeCp12Appliance()],
  };
}
