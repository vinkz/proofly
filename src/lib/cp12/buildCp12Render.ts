/**
 * Maps captured CP12 data onto the renderer's input shape.
 *
 * This is the single mapping between "what was captured" and "what is printed".
 * The authenticated flow feeds it job_fields rows + cp12_appliances rows; the
 * free public tool feeds it the same key names built straight from its form.
 * Both then call the same renderer, so a compliance fix to the template or to
 * this mapping lands in both without anyone remembering to do it twice.
 *
 * Deliberately framework-free: no `server-only`, no session, no database, no
 * network. Type-only imports from the renderer keep it client-importable.
 */
import { composeCp12DefectSummary, type Cp12DefectAppliance } from './defect-summary';
import {
  cp12ApplianceTypeLabel,
  cp12FieldVisible,
  resolveCp12Category,
  resolveCp12Subtype,
} from './applianceConfig';
import type { Cp12Appliance } from '@/types/certificates';
import type {
  ApplianceInput,
  Cp12FieldMap,
  RenderCp12CertificateInput,
} from '@/server/pdf/renderCp12Certificate';

/**
 * Values the authenticated flow resolves from the job's client/property records
 * before mapping. They are only ever fallbacks for a field the engineer did not
 * fill in. The free tool has no such records and simply omits them.
 */
export type Cp12RenderFallbacks = {
  customerName?: string;
  customerOrganization?: string;
  customerAddress?: string;
  propertySummary?: string;
  propertyPostcode?: string;
};

export type Cp12RenderSource = {
  /** Captured values, keyed by the canonical CP12 field keys (`landlord_name`, …). */
  fieldMap: Record<string, unknown>;
  /**
   * Appliances with `reg_26_9_confirmed` and `flue_location` already normalised
   * by the caller — the authenticated flow back-fills those from the record for
   * appliances that pre-date the per-appliance declaration.
   */
  appliances: Cp12Appliance[];
  /** Printed in the footer as `Ref:`, and used as the certificate number of last resort. */
  recordId: string;
  /** Preferred certificate number when the field map carries none. */
  certNumber?: string;
  issuedAt: Date;
  fallbacks?: Cp12RenderFallbacks;
  companyLogoBytes?: Uint8Array;
};

const toText = (val: unknown) => (val === undefined || val === null ? '' : String(val));

const splitAddressParts = (value: unknown) =>
  String(value ?? '')
    .split(/[\r\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

const extractPostcode = (value: unknown) => {
  const match = String(value ?? '')
    .toUpperCase()
    .match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/);
  return match ? match[0].replace(/\s+/g, ' ').trim() : '';
};

const pickText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return '';
};

const buildCombustionSummary = (coPpm: string, co2: string, ratio: string, legacy?: string) => {
  const parts = [coPpm && `${coPpm}ppm`, co2 && `${co2}%`, ratio && ratio].filter(Boolean);
  if (parts.length) return parts.join(' / ');
  return legacy ?? '';
};

export function formatCp12SafetyClassification(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'safe') return 'Safe';
  if (normalized === 'ncs' || normalized === 'not to current standards') return 'Not to Current Standards';
  if (normalized === 'ar' || normalized === 'at risk' || normalized === 'at_risk') return 'At Risk';
  if (normalized === 'id' || normalized === 'immediately dangerous' || normalized === 'immediately_dangerous') {
    return 'Immediately Dangerous';
  }
  return '';
}

export function formatCp12ApplianceSafeToUse(
  appliance: Pick<Cp12Appliance, 'safety_classification' | 'classification_code' | 'safety_rating'>,
) {
  const normalized = String(
    appliance.safety_classification || appliance.classification_code || appliance.safety_rating || '',
  )
    .trim()
    .toLowerCase();
  if (!normalized) return '';
  if (normalized === 'safe' || normalized === 'ncs' || normalized === 'not to current standards') return 'Yes';
  if (
    normalized === 'ar' ||
    normalized === 'at risk' ||
    normalized === 'at_risk' ||
    normalized === 'id' ||
    normalized === 'immediately dangerous' ||
    normalized === 'immediately_dangerous'
  ) {
    return 'No';
  }
  return '';
}

export function buildCp12ApplianceUnsafePdfSummary(appliance: Cp12Appliance) {
  const classification = formatCp12SafetyClassification(
    appliance.safety_classification || appliance.classification_code || appliance.safety_rating,
  );
  if (!classification || classification === 'Safe') return '';

  const parts = [
    `Class: ${classification}`,
    appliance.defect_notes?.trim() ? `Defect: ${appliance.defect_notes.trim()}` : '',
    `Warning notice: ${appliance.warning_notice_issued ? 'Yes' : 'No'}`,
    appliance.actions_taken?.trim() ? `Action: ${appliance.actions_taken.trim()}` : '',
  ].filter(Boolean);

  return parts.join('; ');
}

function buildCp12Fields(src: Cp12RenderSource): Cp12FieldMap {
  const { fieldMap, fallbacks = {} } = src;

  const fallbackJobAddressParts = splitAddressParts(
    fieldMap.property_address ?? fieldMap.address ?? fallbacks.propertySummary ?? '',
  );
  const jobAddressLine1 = toText(fieldMap.job_address_line1 ?? fallbackJobAddressParts[0] ?? '');
  const jobAddressLine2 = toText(fieldMap.job_address_line2 ?? fallbackJobAddressParts[1] ?? '');
  const jobAddressTown = toText(
    fieldMap.job_address_city ??
      (fallbackJobAddressParts.length > 2 ? fallbackJobAddressParts.slice(2).join('\n') : ''),
  );
  const jobAddressPostcode = pickText(
    toText(fieldMap.job_postcode ?? ''),
    toText(fieldMap.property_postcode ?? ''),
    fallbacks.propertyPostcode,
    toText(fieldMap.postcode ?? ''),
  );
  const jobAddressName = toText(fieldMap.job_address_name ?? fieldMap.property_name ?? '');
  const jobAddressTel = toText(fieldMap.job_tel ?? '');

  const fallbackLandlordParts = splitAddressParts(fieldMap.landlord_address ?? fallbacks.customerAddress ?? '');
  const landlordLine1 = toText(fieldMap.landlord_address_line1 ?? fallbackLandlordParts[0] ?? '');
  const landlordLine2 = toText(
    fieldMap.landlord_address_line2 ??
      (fallbackLandlordParts.length > 2 ? fallbackLandlordParts.slice(1, -1).join('\n') : ''),
  );
  const landlordCity = toText(
    fieldMap.landlord_city ??
      fieldMap.landlord_town ??
      (fallbackLandlordParts.length > 1 ? fallbackLandlordParts.at(-1) ?? '' : ''),
  );
  const landlordPostcode = toText(
    fieldMap.landlord_postcode ?? extractPostcode(fieldMap.landlord_address ?? ''),
  );
  const landlordTel = toText(fieldMap.landlord_tel ?? '');

  // Fallback: if the record-level defect/remedial box was not filled, compose it
  // from per-appliance failed checks + notes so the certificate never shows
  // "None identified" while a defect exists on an appliance.
  const composed = composeCp12DefectSummary(src.appliances as unknown as Cp12DefectAppliance[]);

  return {
    certNumber: toText(fieldMap.record_id ?? fieldMap.certificate_number ?? src.certNumber ?? src.recordId),
    issueDate: toText(fieldMap.inspection_date ?? fieldMap.scheduled_for ?? '') || undefined,
    nextInspectionDue: toText(fieldMap.next_inspection_due ?? fieldMap.completion_date ?? ''),
    landlordName: toText(fieldMap.landlord_name ?? fallbacks.customerName ?? ''),
    landlordCompany: toText(fieldMap.landlord_company ?? fallbacks.customerOrganization ?? ''),
    landlordAddressLine1: landlordLine1,
    landlordAddressLine2: landlordLine2,
    landlordTown: landlordCity,
    landlordPostcode: landlordPostcode,
    landlordTel: landlordTel,
    propertyAddressName: jobAddressName,
    propertyAddressLine1: jobAddressLine1,
    propertyAddressLine2: jobAddressLine2,
    propertyTown: jobAddressTown,
    propertyPostcode: jobAddressPostcode,
    propertyTel: jobAddressTel,
    companyName: toText(fieldMap.company_name ?? ''),
    companyAddressLine1: toText(fieldMap.company_address ?? ''),
    companyTown: '',
    companyPostcode: '',
    companyPhone: toText(fieldMap.company_phone ?? ''),
    companyEmail: toText(fieldMap.company_email ?? ''),
    gasSafeRegistrationNumber: toText(fieldMap.gas_safe_number ?? ''),
    engineerName: toText(fieldMap.engineer_name ?? ''),
    engineerIdNumber: toText(fieldMap.engineer_id ?? fieldMap.engineer_id_card_number ?? ''),
    engineerSignatureText: toText(fieldMap.engineer_name ?? ''),
    engineerSignatureUrl: toText(
      fieldMap.engineer_signature_path ?? fieldMap.engineer_signature ?? fieldMap.engineer_signature_url ?? '',
    ),
    engineerVisitTime: toText(fieldMap.completion_date ?? ''),
    responsiblePersonName: toText(fallbacks.customerName ?? ''),
    responsiblePersonSignatureText: toText(fallbacks.customerName ?? ''),
    responsiblePersonSignatureUrl: toText(
      fieldMap.customer_signature_path ?? fieldMap.customer_signature ?? fieldMap.customer_signature_url ?? '',
    ),
    responsiblePersonAcknowledgementDate: toText(fieldMap.completion_date ?? ''),
    defectsIdentified: toText(fieldMap.defect_description ?? '') || composed.defect_description,
    remedialWorksRequired: toText(fieldMap.remedial_action ?? '') || composed.remedial_action,
    warningNoticeIssued: toText(fieldMap.warning_notice_issued ?? ''),
    additionalNotes: toText(fieldMap.comments ?? fieldMap.additional_notes ?? ''),
    coAlarmFitted: toText(fieldMap.co_alarm_fitted ?? ''),
    coAlarmTested: toText(fieldMap.co_alarm_tested ?? ''),
    coAlarmSatisfactory: toText(fieldMap.co_alarm_satisfactory ?? ''),
    emergencyControlAccessible: toText(
      fieldMap.emergency_control_accessible ?? fieldMap.emergency_control ?? '',
    ),
    gasTightnessSatisfactory: toText(fieldMap.gas_tightness_satisfactory ?? ''),
    pipeworkVisualSatisfactory: toText(fieldMap.pipework_visual_satisfactory ?? ''),
    equipotentialBondingSatisfactory: toText(fieldMap.equipotential_bonding_satisfactory ?? ''),
  };
}

function buildApplianceInputs(appliances: Cp12Appliance[]): ApplianceInput[] {
  return appliances.map((app) => {
    const appExtras = app as Cp12Appliance & { appliance_make_model?: string };
    const highCoPpm = toText(app.high_co_ppm ?? app.co_reading_high ?? '');
    const highCo2 = toText(app.high_co2 ?? '');
    const highRatio = toText(app.high_ratio ?? '');
    const lowCoPpm = toText(app.low_co_ppm ?? app.co_reading_low ?? '');
    const lowCo2 = toText(app.low_co2 ?? '');
    const lowRatio = toText(app.low_ratio ?? '');
    const applianceSafe = formatCp12ApplianceSafeToUse(app);
    const category = resolveCp12Category(app.appliance_type);
    const subtype = resolveCp12Subtype(category, app.appliance_subtype, app.appliance_type);
    const typeLabel = cp12ApplianceTypeLabel(category, subtype);

    // Only print checks that apply to this appliance category.
    //
    // The flue fields matter most: `flue_location` falls back to the appliance
    // location, so without this a flueless hob printed "Flue location: Kitchen"
    // — asserting a flue that does not exist on a document whose Reg 36(3)(d)
    // content is a description and location of each appliance AND flue.
    // applianceConfig is the single source of truth for what applies, and the
    // form already hides these fields; this makes the certificate agree.
    const applies = (field: Parameters<typeof cp12FieldVisible>[1]) => cp12FieldVisible(category, field);
    const whenApplicable = (field: Parameters<typeof cp12FieldVisible>[1], value: string) =>
      (applies(field) ? value : '');

    return {
      description: toText(app.make_model ?? appExtras.appliance_make_model ?? '') || typeLabel,
      landlordAppliance: toText(app.landlords_appliance ?? ''),
      applianceInspected: toText(app.appliance_inspected ?? ''),
      location: toText(app.location ?? ''),
      type: typeLabel,
      category,
      flueType: whenApplicable('flue_type', toText(app.flue_type ?? app.ventilation_provision ?? '')),
      flueLocation: whenApplicable('flue_type', toText(app.flue_location ?? app.location ?? '')),
      operatingPressure: toText(app.operating_pressure ?? ''),
      heatInput: toText(app.heat_input ?? ''),
      safetyDevice: toText(app.safety_devices_correct ?? app.stability_test ?? ''),
      ventilationSatisfactory: toText(app.ventilation_satisfactory ?? app.ventilation_provision ?? ''),
      flueTerminationSatisfactory: whenApplicable('flue_condition', toText(app.flue_condition ?? '')),
      // The category-specific check for free-standing cookers. It was captured
      // and counted toward the defect summary but never reached the
      // certificate, so a hob's one distinguishing check went unprinted.
      cookerStability: whenApplicable('cooker_stability', toText(app.cooker_stability ?? '')),
      spillageTest: toText(app.gas_tightness_test ?? ''),
      applianceSafeToUse: applianceSafe,
      remedialActionTaken: buildCp12ApplianceUnsafePdfSummary(app),
      combustionHighCoPpm: whenApplicable('combustion', highCoPpm),
      combustionHighCo2: whenApplicable('combustion', highCo2),
      combustionHighRatio: whenApplicable('combustion', highRatio),
      combustionLowCoPpm: whenApplicable('combustion', lowCoPpm),
      combustionLowCo2: whenApplicable('combustion', lowCo2),
      combustionLowRatio: whenApplicable('combustion', lowRatio),
      combustionHigh: whenApplicable('combustion', buildCombustionSummary(highCoPpm, highCo2, highRatio, toText(app.co_reading_ppm ?? ''))),
      combustionLow: whenApplicable('combustion', buildCombustionSummary(lowCoPpm, lowCo2, lowRatio, toText(app.co_reading_low ?? ''))),
      combustionNotes: toText(app.combustion_notes ?? ''),
      applianceServiced: toText(app.appliance_serviced ?? ''),
      reg26Confirmed: Boolean(app.reg_26_9_confirmed),
    };
  });
}

/** Build the renderer input. Pure — same source in, same bytes out. */
export function buildCp12RenderInput(src: Cp12RenderSource): RenderCp12CertificateInput {
  return {
    fields: buildCp12Fields(src),
    appliances: buildApplianceInputs(src.appliances),
    recordId: src.recordId,
    issuedAt: src.issuedAt,
    companyLogoBytes: src.companyLogoBytes,
  };
}
