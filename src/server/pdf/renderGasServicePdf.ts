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
  flueType?: string;
  operatingPressure?: string;
  heatInput?: string;
  safetyDevice?: string;
  ventilationSatisfactory?: string;
  flueTerminationSatisfactory?: string;
  spillageTest?: string;
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
