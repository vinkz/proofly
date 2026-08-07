import 'server-only';

import { renderCp12CertificateV2Pdf } from './renderCp12CertificateV2';

export type ApplianceInput = {
  description: string;
  location: string;
  type: string;
  category?: string;
  flueType?: string;
  flueLocation?: string;
  operatingPressure?: string;
  heatInput?: string;
  safetyDevice?: string;
  ventilationSatisfactory?: string;
  flueTerminationSatisfactory?: string;
  /** Free-standing cooker stability bracket/chain. Hob/cooker categories only. */
  cookerStability?: string;
  /** Data-plate Gas Council number, where the appliance has one. */
  gcNumber?: string;
  /** Natural gas or LPG, for this appliance. */
  gasType?: string;
  /** Flue flow test result. Open-flued appliances only. */
  fluePerformanceTest?: string;
  /** Flue integrity test result. Room-sealed / balanced-flue appliances only. */
  flueIntegrityTest?: string;
  /** Air-inlet CO2 % at high and low rate — optional evidence for the above. */
  flueIntegrityCo2High?: string;
  flueIntegrityCo2Low?: string;
  /** Spillage test result. Open-flued appliances only. */
  spillageTest?: string;
  /** Installation soundness (tightness) test result. */
  gasTightnessTest?: string;
  applianceSafeToUse?: string;
  remedialActionTaken?: string;
  combustionHigh?: string;
  combustionLow?: string;
  combustionHighCoPpm?: string;
  combustionHighCo2?: string;
  combustionHighRatio?: string;
  combustionLowCoPpm?: string;
  combustionLowCo2?: string;
  combustionLowRatio?: string;
  combustionNotes?: string;
  applianceServiced?: string;
  applianceInspected?: string;
  landlordAppliance?: string;
  reg26Confirmed?: boolean;
};

export type Cp12FieldMap = {
  certNumber?: string;
  issueDate?: string;
  nextInspectionDue?: string;
  landlordName?: string;
  landlordCompany?: string;
  landlordAddressLine1?: string;
  landlordAddressLine2?: string;
  landlordTown?: string;
  landlordPostcode?: string;
  landlordTel?: string;
  propertyAddressName?: string;
  propertyAddressLine1?: string;
  propertyAddressLine2?: string;
  propertyTown?: string;
  propertyPostcode?: string;
  propertyTel?: string;
  companyName?: string;
  companyAddressLine1?: string;
  companyAddressLine2?: string;
  companyTown?: string;
  companyPostcode?: string;
  companyPhone?: string;
  companyEmail?: string;
  gasSafeRegistrationNumber?: string;
  engineerName?: string;
  engineerIdNumber?: string;
  engineerSignatureText?: string;
  engineerSignatureUrl?: string;
  engineerVisitTime?: string;
  responsiblePersonName?: string;
  responsiblePersonSignatureText?: string;
  responsiblePersonSignatureUrl?: string;
  responsiblePersonAcknowledgementDate?: string;
  defectsIdentified?: string;
  remedialWorksRequired?: string;
  warningNoticeIssued?: string;
  additionalNotes?: string;
  coAlarmFitted?: string;
  coAlarmTested?: string;
  coAlarmSatisfactory?: string;
  emergencyControlAccessible?: string;
  gasTightnessSatisfactory?: string;
  pipeworkVisualSatisfactory?: string;
  equipotentialBondingSatisfactory?: string;
};

export type RenderCp12CertificateInput = {
  fields: Cp12FieldMap;
  appliances: ApplianceInput[];
  recordId: string;
  issuedAt: Date;
  companyLogoBytes?: Uint8Array;
};

/** The sole CP12 renderer for newly issued certificates. */
export async function renderCp12CertificatePdf(input: RenderCp12CertificateInput): Promise<Uint8Array> {
  return renderCp12CertificateV2Pdf(input);
}
