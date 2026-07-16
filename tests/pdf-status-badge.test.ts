import zlib from 'node:zlib';

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabaseServer', () => ({ supabaseServerServiceRole: async () => null }));

import { renderGasServiceV2Pdf } from '@/server/pdf/renderGasServiceV2';
import { renderCp12CertificateV2Pdf } from '@/server/pdf/renderCp12CertificateV2';
import type { GasServiceFieldMap, ApplianceInput as GasApplianceInput } from '@/server/pdf/renderGasServicePdf';
import type { Cp12FieldMap, ApplianceInput as Cp12ApplianceInput } from '@/server/pdf/renderCp12Certificate';

// Extract the visible text from a pdf-lib document. pdf-lib writes glyphs as
// hex strings (<..> Tj), so we inflate the content streams and decode the hex.
const pdfText = (bytes: Uint8Array): string => {
  const buf = Buffer.from(bytes);
  let raw = '';
  let idx = 0;
  for (;;) {
    const s = buf.indexOf('stream', idx, 'latin1');
    if (s < 0) break;
    let start = s + 6;
    if (buf[start] === 0x0d) start += 1;
    if (buf[start] === 0x0a) start += 1;
    const end = buf.indexOf('endstream', start, 'latin1');
    if (end < 0) break;
    const chunk = buf.subarray(start, end);
    try {
      raw += zlib.inflateSync(chunk).toString('latin1');
    } catch {
      raw += chunk.toString('latin1');
    }
    idx = end + 9;
  }
  return raw.replace(/<([0-9a-fA-F\s]+)>/g, (_, hex: string) => {
    const clean = hex.replace(/\s+/g, '');
    let out = '';
    for (let i = 0; i + 1 < clean.length; i += 2) {
      out += String.fromCharCode(parseInt(clean.substr(i, 2), 16));
    }
    return out;
  });
};

// A safe/no-defect record must NOT be stamped as a defect, and a yes/no answer
// ("no") must never leak into a free-text remedial line. This locks in the fix
// for the gas-service renderer and guards the CP12 renderer against the same
// class of bug (a yes/no flag being rendered as remedial/defect text).

const gasBase: GasServiceFieldMap = {
  certNumber: 'GS-BADGE-1',
  engineerName: 'A. Engineer',
  gasSafeNumber: '123456',
  jobAddressLine1: '15 Acacia Avenue',
  jobPostcode: 'SW1A 1AA',
  applianceType: 'Combi boiler',
  applianceSafe: 'Yes',
  issuedDate: '12/07/2026',
};

describe('gas service status badge', () => {
  it('a clean service reads APPLIANCE SAFE with no remedial line', async () => {
    // remedialActionTaken is intentionally absent (mirrors an empty defects_details).
    const t = pdfText(
      await renderGasServiceV2Pdf({
        fields: gasBase,
        appliances: [{ description: 'Worcester Greenstar', type: 'Combi boiler', location: 'Kitchen' }],
        recordId: 'j-clean',
        issuedAt: new Date('2026-07-12'),
      }),
    );
    expect(t).toContain('APPLIANCE SAFE');
    expect(t).not.toContain('DEFECT IDENTIFIED');
    expect(t).not.toContain('Defect / remedial');
  });

  it('a bare "no" in the remedial field does not fake a defect (renderer hardening)', async () => {
    const t = pdfText(
      await renderGasServiceV2Pdf({
        fields: gasBase,
        appliances: [
          { description: 'Worcester Greenstar', type: 'Combi boiler', location: 'Kitchen', remedialActionTaken: 'no' } as GasApplianceInput,
        ],
        recordId: 'j-noflag',
        issuedAt: new Date('2026-07-12'),
      }),
    );
    expect(t).toContain('APPLIANCE SAFE');
    expect(t).not.toContain('DEFECT IDENTIFIED');
    expect(t).not.toContain('Defect / remedial');
  });

  it('a genuine defect reads DEFECT IDENTIFIED with the remedial text', async () => {
    const t = pdfText(
      await renderGasServiceV2Pdf({
        fields: { ...gasBase, applianceSafe: 'No' },
        appliances: [
          {
            description: 'Worcester Greenstar',
            type: 'Combi boiler',
            location: 'Kitchen',
            remedialActionTaken: 'Heat exchanger corroded; appliance isolated',
          } as GasApplianceInput,
        ],
        recordId: 'j-defect',
        issuedAt: new Date('2026-07-12'),
      }),
    );
    expect(t).toContain('DEFECT IDENTIFIED');
    expect(t).toContain('Heat exchanger corroded');
    expect(t).not.toContain('APPLIANCE SAFE');
  });
});

const cp12Base: Cp12FieldMap = {
  certNumber: 'CN-BADGE-1',
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

const cp12SafeAppliance: Cp12ApplianceInput = {
  description: 'Worcester Bosch Greenstar',
  location: 'Kitchen',
  type: 'Combi boiler',
  applianceSafeToUse: 'Yes',
  reg26Confirmed: true,
};

describe('CP12 status badge', () => {
  it('a satisfactory certificate is not stamped DEFECTS IDENTIFIED', async () => {
    const t = pdfText(
      await renderCp12CertificateV2Pdf({
        fields: cp12Base,
        appliances: [cp12SafeAppliance],
        recordId: 'cp12-clean',
        issuedAt: new Date('2026-07-11'),
      }),
    );
    expect(t).toContain('SATISFACTORY');
    expect(t).not.toContain('DEFECTS IDENTIFIED');
  });

  it('an unsafe appliance is stamped DEFECTS IDENTIFIED', async () => {
    const t = pdfText(
      await renderCp12CertificateV2Pdf({
        fields: cp12Base,
        appliances: [{ ...cp12SafeAppliance, applianceSafeToUse: 'At Risk' }],
        recordId: 'cp12-unsafe',
        issuedAt: new Date('2026-07-11'),
      }),
    );
    expect(t).toContain('DEFECTS IDENTIFIED');
    expect(t).not.toContain('SATISFACTORY');
  });
});
