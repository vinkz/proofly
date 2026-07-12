import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabaseServer', () => ({ supabaseServerServiceRole: async () => null }));

import { renderGasServiceV2Pdf } from '@/server/pdf/renderGasServiceV2';
import type { GasServiceFieldMap, ApplianceInput } from '@/server/pdf/renderGasServicePdf';

const base: GasServiceFieldMap = {
  certNumber: 'GS-1',
  engineerName: 'A. Engineer',
  gasSafeNumber: '123456',
  jobAddressLine1: '15 Acacia Avenue',
  jobPostcode: 'SW1A 1AA',
  applianceType: 'Combi boiler',
  applianceFlueingSafe: 'Pass',
  applianceVentilationSafe: 'Pass',
  operatingPressure: '20 mbar',
  heatInput: '24 kW',
  applianceSafe: 'Yes',
  issuedDate: '12/07/2026',
};
const appliance: ApplianceInput = { description: 'Worcester Greenstar', type: 'Combi boiler', location: 'Kitchen' };
const isPdf = (b: Uint8Array) => b.byteLength > 1000 && b[0] === 0x25 && b[1] === 0x50;

describe('Gas service v2 renderer', () => {
  it('renders a satisfactory service', async () => {
    const bytes = await renderGasServiceV2Pdf({ fields: base, appliances: [appliance], recordId: 'j1', issuedAt: new Date('2026-07-12') });
    expect(isPdf(bytes)).toBe(true);
  });
  it('renders a service with a defect', async () => {
    const bytes = await renderGasServiceV2Pdf({
      fields: { ...base, applianceSafe: 'No', applianceFlueingSafe: 'Fail', applianceReplacementRecommended: 'Yes' },
      appliances: [{ ...appliance, applianceSafeToUse: 'No', remedialActionTaken: 'Advised replacement.' }],
      recordId: 'j2',
      issuedAt: new Date('2026-07-12'),
    });
    expect(isPdf(bytes)).toBe(true);
  });
  it('renders a minimal record without throwing', async () => {
    const bytes = await renderGasServiceV2Pdf({ fields: { engineerName: 'A', gasSafeNumber: '1' }, appliances: [], recordId: 'j3', issuedAt: new Date('2026-07-12') });
    expect(isPdf(bytes)).toBe(true);
  });
});
