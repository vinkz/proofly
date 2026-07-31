import 'server-only';

import { renderGasServiceV2Pdf } from './renderGasServiceV2';

// Per-appliance data for the service record.
export type ApplianceInput = {
  description: string;
  location: string;
  type: string;
  make?: string;
  model?: string;
  serial?: string;
  /** Data-plate Gas Council number, where the appliance has one. */
  gcNumber?: string;
  flueType?: string;
  operatingPressure?: string;
  heatInput?: string;
  safetyDevice?: string;
  ventilationSatisfactory?: string;
  // No flue-check fields here. The renderer prints flueing from the field map
  // ("Flue effectiveness", from appliance_flueing_safe); the service record has
  // no spillage or flue integrity test to report. Two such fields existed and
  // were fed the tightness / combustion answers — never printed, but ready to
  // print something untrue the moment anyone wired them up.
  applianceSafeToUse?: string;
  remedialActionTaken?: string;
};

export type GasServiceFieldMap = {
  certNumber?: string;
  engineerName?: string;
  companyName?: string;
  companyAddressLine1?: string;
  companyAddressLine2?: string;
  companyTown?: string;
  companyPostcode?: string;
  companyPhone?: string;
  gasSafeNumber?: string;
  /**
   * Flue checks, reported like every other check on this record — from the
   * field map, not the appliance row.
   *
   * Which pair applies depends on how the appliance is flued: a room-sealed or
   * balanced flue gets the integrity test (analyser at the air-inlet sampling
   * point), an open flue gets the flow and spillage tests. Never both.
   */
  flueIntegrityTest?: string;
  flueIntegrityCo2High?: string;
  flueIntegrityCo2Low?: string;
  flueFlowTest?: string;
  spillageTest?: string;
  engineerId?: string;
  jobName?: string;
  jobAddressLine1?: string;
  jobAddressLine2?: string;
  jobTown?: string;
  jobPostcode?: string;
  jobPhone?: string;
  clientName?: string;
  clientCompany?: string;
  clientAddressLine1?: string;
  clientAddressLine2?: string;
  clientTown?: string;
  clientPostcode?: string;
  clientPhone?: string;
  applianceType?: string;
  applianceMake?: string;
  applianceModel?: string;
  applianceLocation?: string;
  applianceSerial?: string;
  highCombustionRatio?: string;
  highCombustionCoPpm?: string;
  highCombustionCo2?: string;
  lowCombustionRatio?: string;
  lowCombustionCoPpm?: string;
  lowCombustionCo2?: string;
  applianceOperatingCorrectly?: string;
  applianceConformsStandards?: string;
  applianceControlsChecked?: string;
  operatingPressure?: string;
  heatInput?: string;
  boilerWorkingCorrectly?: string;
  cylinderConditionChecked?: string;
  programmerControlsWorking?: string;
  coAlarmFitted?: string;
  applianceSafe?: string;
  allFunctionalPartsAvailable?: string;
  applianceFlueingSafe?: string;
  applianceVentilationSafe?: string;
  emissionCombustionTest?: string;
  burnerPressureCorrect?: string;
  tightnessTest?: string;
  warmAirGrillsWorking?: string;
  pipeworkFreeFromLeaks?: string;
  magneticFilterFitted?: string;
  waterQualityAcceptable?: string;
  warningNoticeExplained?: string;
  applianceReplacementRecommended?: string;
  systemImprovementsRecommended?: string;
  nextServiceDate?: string;
  engineerComments?: string;
  issuedByPrintName?: string;
  receivedByPrintName?: string;
  issuedDate?: string;
  engineerSignatureUrl?: string;
  customerSignatureUrl?: string;
};

export type RenderGasServiceInput = {
  fields: GasServiceFieldMap;
  appliances: ApplianceInput[];
  recordId: string;
  issuedAt: Date;
  companyLogoBytes?: Uint8Array;
};

// The Gas Appliance Service Record now uses the programmatic v2 renderer (CP12
// house style, Reg 26(9) safety examination as the required spine, adaptive
// render-if-captured). This wrapper preserves the existing call signature.
export async function renderGasServicePdf(input: RenderGasServiceInput): Promise<Uint8Array> {
  return renderGasServiceV2Pdf(input);
}
