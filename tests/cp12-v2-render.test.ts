import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabaseServer', () => ({ supabaseServerServiceRole: async () => null }));

import { renderCp12CertificateV2Pdf } from '@/server/pdf/renderCp12CertificateV2';
import type { ApplianceInput, Cp12FieldMap } from '@/server/pdf/renderCp12Certificate';

const baseFields: Cp12FieldMap = {
  certNumber: 'CN-V2-001',
  issueDate: '11/07/2026',
  landlordName: 'Alex Landlord',
  landlordAddressLine1: '21 Owner Street',
  landlordTown: 'London',
  landlordPostcode: 'SE1 1AA',
  propertyAddressLine1: '15 Acacia Avenue',
  propertyTown: 'London',
  propertyPostcode: 'SW1A 1AA',
  engineerName: 'A. Engineer',
  engineerSignatureText: 'A. Engineer',
  gasSafeRegistrationNumber: '123456',
};

const appliance: ApplianceInput = {
  description: 'Worcester Bosch Greenstar',
  location: 'Kitchen',
  type: 'Combi boiler',
  flueType: 'Room sealed',
  flueLocation: 'Kitchen',
  applianceSafeToUse: 'Yes',
  reg26Confirmed: true,
};

describe('CP12 v2 renderer', () => {
  it.each([
    ['minimal safe record', baseFields],
    ['record with optional conventional sections', { ...baseFields, companyName: 'CertNow Heating', coAlarmFitted: 'Yes', gasTightnessSatisfactory: 'Pass' }],
    ['record with defects and remedial action', { ...baseFields, defectsIdentified: 'Flue seal degraded', remedialWorksRequired: 'Seal replaced' }],
  ])('renders %s without relying on the fixed AcroForm layout', async (_name, fields) => {
    const bytes = await renderCp12CertificateV2Pdf({
      fields,
      appliances: [appliance],
      recordId: 'job-v2-test',
      issuedAt: new Date('2026-07-11T09:00:00Z'),
    });

    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(bytes.slice(0, 4)).toEqual(new Uint8Array([37, 80, 68, 70]));
  });
});
