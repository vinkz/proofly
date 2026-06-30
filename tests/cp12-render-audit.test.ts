import fs from 'node:fs';
import path from 'node:path';

import { describe, it, expect, vi } from 'vitest';

// The renderer is server-only and pulls in the supabase client for signature image
// fetches. Stub both so we can render in a plain node test. We pass signature TEXT
// (not URLs) below, so the supabase path is never exercised anyway.
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabaseServer', () => ({
  supabaseServerServiceRole: async () => null,
}));

import { renderCp12CertificatePdf, type ApplianceInput, type Cp12FieldMap } from '@/server/pdf/renderCp12Certificate';

const LONG_DEFECT =
  'Spillage of products of combustion detected at the appliance draught diverter during the smoke ' +
  'match test. Chimney/flue found to be partially blocked with debris and the room ventilation is ' +
  'inadequate for an open-flued appliance of this rating. CO levels elevated beyond safe limits. ' +
  'Appliance classified At Risk and turned off with the customer’s permission pending remedial works.';

const LONG_REMEDIAL =
  'Sweep and inspect chimney/flue; provide compliant permanent ventilation to the room per BS 5440-2; ' +
  're-test combustion and spillage before returning the appliance to service. Advise landlord in writing ' +
  'and attach a Warning/Advice notice to the appliance.';

// 8 appliances across all four categories — exceeds the 6-row template page to
// exercise the continuation-page overflow fix, with long make/model + long text.
const appliances: ApplianceInput[] = [
  {
    description: 'Worcester Bosch Greenstar 8000 Life 50kW Combi Condensing Wall-Mounted Boiler',
    location: 'First floor airing cupboard adjacent to the master bedroom ensuite',
    type: 'Boiler (combi)',
    category: 'boiler',
    flueType: 'Room sealed (fanned)',
    operatingPressure: '20 mbar',
    heatInput: '50 kW',
    safetyDevice: 'Pass',
    ventilationSatisfactory: 'Pass',
    flueTerminationSatisfactory: 'Pass',
    spillageTest: 'N/A',
    applianceSafeToUse: 'Yes',
    combustionLowCoPpm: '0',
    combustionLowCo2: '8.4',
    combustionLowRatio: '0.0004',
    combustionHighCoPpm: '0',
    combustionHighCo2: '9.1',
    combustionHighRatio: '0.0031',
    combustionNotes: 'Within manufacturer tolerances at low and high fire.',
    applianceServiced: 'Yes',
    applianceInspected: 'Yes',
    landlordAppliance: 'Yes',
  },
  {
    description: 'Vaillant ecoTEC plus 832 System Boiler',
    location: 'Utility room ground floor',
    type: 'Boiler (system)',
    category: 'boiler',
    flueType: 'Room sealed (fanned)',
    operatingPressure: '20 mbar',
    heatInput: '32 kW',
    safetyDevice: 'Pass',
    ventilationSatisfactory: 'Pass',
    flueTerminationSatisfactory: 'Pass',
    applianceSafeToUse: 'Yes',
    applianceServiced: 'Yes',
    applianceInspected: 'Yes',
    landlordAppliance: 'Yes',
  },
  {
    description: 'Stoves Richmond 1100DFT Dual Fuel Range Cooker',
    location: 'Kitchen',
    type: 'Gas hob / cooker',
    category: 'hob_cooker',
    operatingPressure: '21 mbar',
    safetyDevice: 'Pass',
    applianceSafeToUse: 'Yes',
    applianceInspected: 'Yes',
    landlordAppliance: 'Yes',
  },
  {
    description: 'Valor Dimension Homeflame Slimline Inset Gas Fire',
    location: 'Living room chimney breast',
    type: 'Gas fire',
    category: 'gas_fire',
    flueType: 'Open flue (Class I)',
    operatingPressure: '20 mbar',
    heatInput: '5.5 kW',
    safetyDevice: 'Fail',
    ventilationSatisfactory: 'Fail',
    flueTerminationSatisfactory: 'Fail',
    spillageTest: 'Fail',
    applianceSafeToUse: 'No - At Risk',
    remedialActionTaken: 'Appliance turned off; Warning notice issued to landlord and tenant.',
    combustionLowCoPpm: '210',
    combustionLowCo2: '4.2',
    combustionLowRatio: '0.0095',
    combustionHighCoPpm: '350',
    combustionHighCo2: '5.1',
    combustionHighRatio: '0.0142',
    combustionNotes: 'Elevated CO at high fire; spillage detected during smoke match test.',
    applianceServiced: 'No',
    applianceInspected: 'Yes',
    landlordAppliance: 'Yes',
  },
  {
    description: 'Morco D61E Water Heater',
    location: 'Ground floor cloakroom',
    type: 'Water heater',
    category: 'water_heater',
    flueType: 'Open flue (Class I)',
    operatingPressure: '20 mbar',
    heatInput: '11 kW',
    safetyDevice: 'Pass',
    ventilationSatisfactory: 'Pass',
    flueTerminationSatisfactory: 'Pass',
    applianceSafeToUse: 'Yes',
    applianceInspected: 'Yes',
    landlordAppliance: 'Yes',
  },
  {
    description: 'Ideal Mexico HE36 Regular Boiler',
    location: 'Loft',
    type: 'Boiler (regular)',
    category: 'boiler',
    flueType: 'Open flue',
    operatingPressure: '20 mbar',
    heatInput: '36 kW',
    safetyDevice: 'Pass',
    ventilationSatisfactory: 'Pass',
    flueTerminationSatisfactory: 'Pass',
    applianceSafeToUse: 'Yes',
    applianceServiced: 'Yes',
    applianceInspected: 'Yes',
    landlordAppliance: 'Yes',
  },
  {
    description: 'Bosch PGP6B5B90 4-Burner Gas Hob',
    location: 'Annexe kitchenette',
    type: 'Gas hob / cooker',
    category: 'hob_cooker',
    operatingPressure: '21 mbar',
    safetyDevice: 'Pass',
    applianceSafeToUse: 'Yes',
    applianceInspected: 'Yes',
    landlordAppliance: 'Yes',
  },
  {
    description: 'Flavel Kenilworth Plus Inset Gas Fire',
    location: 'Second bedroom',
    type: 'Gas fire',
    category: 'gas_fire',
    flueType: 'Open flue (Class I)',
    operatingPressure: '20 mbar',
    heatInput: '4.0 kW',
    safetyDevice: 'Pass',
    ventilationSatisfactory: 'Pass',
    flueTerminationSatisfactory: 'Pass',
    applianceSafeToUse: 'Yes',
    applianceInspected: 'Yes',
    landlordAppliance: 'Yes',
  },
];

const fields: Cp12FieldMap = {
  certNumber: 'CN-AUDIT-0001',
  issueDate: '20/06/2026',
  nextInspectionDue: '20/06/2027',
  landlordName: 'Christopher Worthington-Fitzgerald',
  landlordCompany: 'Worthington-Fitzgerald Property Management & Lettings Ltd',
  landlordAddressLine1: '127 Kingsway Boulevard Apartments',
  landlordAddressLine2: 'Flat 14B, Wellington Court',
  landlordTown: 'London',
  landlordPostcode: 'SW1A 1AA',
  landlordTel: '020 7946 0958',
  propertyAddressName: 'Riverside Heights Development',
  propertyAddressLine1: 'Unit 47, Riverside Heights Development',
  propertyAddressLine2: 'Battersea Reach, Lombard Road',
  propertyTown: 'London',
  propertyPostcode: 'SW11 3RX',
  propertyTel: '020 7946 0958',
  companyName: 'CertNow Field Compliance Ltd',
  companyAddressLine1: '1 Example Street',
  companyTown: 'London',
  companyPostcode: 'EC1A 1AA',
  companyPhone: '020 0000 0000',
  companyEmail: 'engineer@certnow.uk',
  gasSafeRegistrationNumber: '123456',
  engineerName: 'A. N. Engineer',
  engineerIdNumber: 'ENG-001',
  engineerSignatureText: 'A. N. Engineer',
  responsiblePersonName: 'Jonathan Pemberton-Smythe',
  responsiblePersonSignatureText: 'J. Pemberton-Smythe',
  responsiblePersonAcknowledgementDate: '20/06/2026',
  defectsIdentified: `Appliance 4 (Living room gas fire): ${LONG_DEFECT}`,
  remedialWorksRequired: `Appliance 4: ${LONG_REMEDIAL}`,
  warningNoticeIssued: 'Yes',
  additionalNotes:
    'HMO property with 8 gas appliances inspected at this visit. One appliance (gas fire) classified At Risk and made safe.',
  coAlarmFitted: 'Pass',
  coAlarmTested: 'Pass',
  coAlarmSatisfactory: 'Pass',
  emergencyControlAccessible: 'Pass',
  gasTightnessSatisfactory: 'Pass',
  pipeworkVisualSatisfactory: 'Pass',
  equipotentialBondingSatisfactory: 'Pass',
};

describe('CP12 renderer audit', () => {
  it('renders 8 long-text appliances across all categories to a PDF', async () => {
    const bytes = await renderCp12CertificatePdf({
      fields,
      appliances,
      recordId: 'audit-record-0001',
      issuedAt: new Date('2026-06-20T09:00:00Z'),
    });

    expect(bytes.byteLength).toBeGreaterThan(1000);

    const outDir = path.join(process.cwd(), 'tmp');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'cp12-audit.pdf');
    fs.writeFileSync(outPath, bytes);
    // eslint-disable-next-line no-console
    console.log('WROTE_PDF', outPath, bytes.byteLength, 'bytes');
  });
});
