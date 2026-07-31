/**
 * The wire contract for the free boiler service tool's form.
 *
 * Mirrors @/lib/cp12/freeCp12Payload: a shape plus a translation into the
 * renderer's input. No field policy of its own — the gate is the shared
 * validateGasServiceForIssue, and the renderer is the shared one.
 *
 * A service record has no statutory content list (see
 * audit/gas-service-field-analysis.md), so the required spine is deliberately
 * short: engineer identity, appliance identity, and the Reg 26(9) safety
 * examination outcomes. Benchmark service tasks and readings are captured but
 * never block.
 *
 * Framework-free: imported by both the client form and the API routes.
 */
import { z } from 'zod';

import type { GasServiceFieldMap, RenderGasServiceInput } from '@/server/pdf/renderGasServicePdf';

const str = (max = 200) => z.string().max(max).optional().default('');

export const FreeBoilerServiceSchema = z.object({
  service_date: str(20),

  // Premises
  job_address_line1: str(160),
  job_address_line2: str(160),
  job_address_city: str(80),
  job_postcode: str(16),

  // Customer
  customer_name: str(160),
  customer_company: str(160),
  customer_phone: str(40),
  customer_address_line1: str(160),
  customer_city: str(80),
  customer_postcode: str(16),

  // Engineer + business
  engineer_name: str(120),
  gas_safe_number: str(40),
  engineer_id_card_number: str(40),
  company_name: str(160),
  company_address: str(240),
  company_phone: str(40),
  /** Data URL from the signature pad. Never a storage path. */
  engineer_signature: z.string().max(400_000).optional().default(''),

  // Appliance identity
  boiler_make: str(80),
  boiler_model: str(120),
  boiler_type: str(40),
  boiler_location: str(120),
  serial_number: str(80),
  /** Data-plate Gas Council number. Free text — never inferred from make/model. */
  gc_number: str(20),
  gas_type: str(40),
  flue_type: str(60),

  /**
   * Flue checks, chosen by flue type.
   *
   * A service follows the manufacturer's instructions and covers flueing at
   * least as thoroughly as a CP12, so the same split applies: room-sealed and
   * balanced flues get the integrity test, open flues get the flow and
   * spillage tests. See FLUE_KIND_FIELDS in @/lib/cp12/applianceConfig for the
   * rule, which this record shares rather than restates.
   */
  flue_integrity_test: str(20),
  flue_integrity_co2_high: str(20),
  flue_integrity_co2_low: str(20),
  flue_flow_test: str(20),
  spillage_test: str(20),

  // Reg 26(9) safety examination outcomes — the required spine.
  appliance_flueing_safe: str(20),
  appliance_ventilation_safe: str(20),
  operating_pressure: str(40),
  heat_input: str(40),
  appliance_safe: str(20),

  // Benchmark service tasks — conventional, never blocking.
  service_visual_inspection: str(20),
  service_burner_cleaned: str(20),
  service_heat_exchanger_cleaned: str(20),
  service_condensate_checked: str(20),
  service_seals_checked: str(20),
  service_controls_tested: str(20),

  // Readings
  high_co_ppm: str(20),
  high_co2: str(20),
  high_ratio: str(20),
  low_co_ppm: str(20),
  low_co2: str(20),
  low_ratio: str(20),
  tightness_test: str(40),

  // Outcome
  defects_found: str(20),
  defect_description: str(2000),
  remedial_action: str(2000),
  engineer_comments: str(2000),
  next_service_date: str(20),
});

export type FreeBoilerServicePayload = z.output<typeof FreeBoilerServiceSchema>;
export type FreeBoilerServicePayloadInput = z.input<typeof FreeBoilerServiceSchema>;

const joinAddress = (parts: Array<string | undefined>) =>
  parts.map((p) => (p ?? '').trim()).filter(Boolean).join(', ');

export function freeBoilerServicePropertyAddress(payload: FreeBoilerServicePayload) {
  return joinAddress([
    payload.job_address_line1,
    payload.job_address_line2,
    payload.job_address_city,
    payload.job_postcode,
  ]);
}

/** The shape validateGasServiceForIssue expects, built from the same payload. */
export function freeBoilerServiceValidationInput(payload: FreeBoilerServicePayload) {
  return {
    ...payload,
    property_address: freeBoilerServicePropertyAddress(payload),
  } as Record<string, unknown>;
}

/** Translate a validated payload into the shared renderer input. */
export function freeBoilerServiceToRenderInput(
  payload: FreeBoilerServicePayload,
  options: { recordId: string; certNumber: string; issuedAt: Date },
): RenderGasServiceInput {
  const applianceDescription = [payload.boiler_make, payload.boiler_model]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ');

  const fields: GasServiceFieldMap = {
    certNumber: options.certNumber,

    engineerName: payload.engineer_name,
    companyName: payload.company_name,
    companyAddressLine1: payload.company_address,
    companyPhone: payload.company_phone,
    gasSafeNumber: payload.gas_safe_number,
    engineerId: payload.engineer_id_card_number,

    jobAddressLine1: payload.job_address_line1,
    jobAddressLine2: payload.job_address_line2,
    jobTown: payload.job_address_city,
    jobPostcode: payload.job_postcode,

    clientName: payload.customer_name,
    clientCompany: payload.customer_company,
    clientAddressLine1: payload.customer_address_line1,
    clientTown: payload.customer_city,
    clientPostcode: payload.customer_postcode,
    clientPhone: payload.customer_phone,

    applianceType: payload.boiler_type,
    applianceMake: payload.boiler_make,
    applianceModel: payload.boiler_model,
    applianceLocation: payload.boiler_location,
    applianceSerial: payload.serial_number,

    highCombustionCoPpm: payload.high_co_ppm,
    highCombustionCo2: payload.high_co2,
    highCombustionRatio: payload.high_ratio,
    lowCombustionCoPpm: payload.low_co_ppm,
    lowCombustionCo2: payload.low_co2,
    lowCombustionRatio: payload.low_ratio,

    operatingPressure: payload.operating_pressure,
    heatInput: payload.heat_input,
    applianceSafe: payload.appliance_safe,
    applianceFlueingSafe: payload.appliance_flueing_safe,
    flueIntegrityTest: payload.flue_integrity_test,
    flueIntegrityCo2High: payload.flue_integrity_co2_high,
    flueIntegrityCo2Low: payload.flue_integrity_co2_low,
    flueFlowTest: payload.flue_flow_test,
    spillageTest: payload.spillage_test,
    applianceVentilationSafe: payload.appliance_ventilation_safe,
    tightnessTest: payload.tightness_test,

    nextServiceDate: payload.next_service_date,
    engineerComments: [payload.defect_description, payload.remedial_action, payload.engineer_comments]
      .map((p) => p.trim())
      .filter(Boolean)
      .join('\n'),

    issuedByPrintName: payload.engineer_name,
    issuedDate: payload.service_date,
    engineerSignatureUrl: payload.engineer_signature,
  };

  return {
    fields,
    appliances: [
      {
        description: applianceDescription || payload.boiler_type || 'Gas appliance',
        location: payload.boiler_location,
        type: payload.boiler_type,
        make: payload.boiler_make,
        model: payload.boiler_model,
        serial: payload.serial_number,
        gcNumber: payload.gc_number,
        flueType: payload.flue_type,
        operatingPressure: payload.operating_pressure,
        heatInput: payload.heat_input,
        ventilationSatisfactory: payload.appliance_ventilation_safe,
        applianceSafeToUse: payload.appliance_safe,
        remedialActionTaken: payload.remedial_action,
      },
    ],
    recordId: options.recordId,
    issuedAt: options.issuedAt,
  };
}

export function emptyFreeBoilerServicePayload(): FreeBoilerServicePayload {
  return FreeBoilerServiceSchema.parse({});
}
