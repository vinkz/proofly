import fs from 'node:fs';
import path from 'node:path';

import { describe, it, expect } from 'vitest';

import { renderGasWarningNoticePdf } from '@/server/pdf/renderGasWarningNoticePdf';
import type { GasWarningNoticeFields } from '@/types/gas-warning-notice';

const LONG_FAULT =
  'During the landlord gas safety inspection the open-flued living-room gas fire was found to be spilling ' +
  'products of combustion into the room. A smoke-match test at the draught diverter confirmed sustained ' +
  'spillage, and the flue/chimney was found to be partially blocked with soot and nesting debris. Room ' +
  'ventilation is inadequate for an appliance of this rating. A carbon monoxide reading of 350 ppm was ' +
  'recorded at high fire, well above safe limits. The appliance is therefore Immediately Dangerous.';

const LONG_ACTIONS_TAKEN =
  'Appliance turned off and isolated at the appliance isolation valve. A "Danger Do Not Use" label was ' +
  'fixed to the appliance. The tenant and landlord were verbally advised not to use the appliance under ' +
  'any circumstances until remedial works are completed and the appliance is re-tested by a Gas Safe ' +
  'registered engineer. A copy of this warning notice was left on the premises.';

const LONG_ACTIONS_REQUIRED =
  'Sweep and CCTV-inspect the chimney/flue; clear all blockages; provide compliant permanent ventilation ' +
  'to the room in accordance with BS 5440-2; replace the appliance if the heat exchanger is found to be ' +
  'damaged; carry out a full combustion analysis and spillage test before returning the appliance to ' +
  'service. Re-issue a CP12 once the appliance passes.';

const fields: GasWarningNoticeFields = {
  record_id: 'GWN-AUDIT-0001',
  classification: 'IMMEDIATELY_DANGEROUS',
  classification_code: 'ID',
  engineer_name: 'A. N. Engineer',
  engineer_company: 'CertNow Field Compliance Ltd',
  company_address: '1 Example Street, London',
  company_postcode: 'EC1A 1AA',
  company_phone: '020 0000 0000',
  gas_safe_number: '123456',
  engineer_id_card_number: 'ENG-001',
  job_address_name: 'Riverside Heights Development',
  job_address_line1: 'Unit 47, Riverside Heights Development',
  job_address_line2: 'Battersea Reach, Lombard Road',
  job_address_city: 'London',
  job_postcode: 'SW11 3RX',
  job_tel: '020 7946 0958',
  customer_name: 'Christopher Worthington-Fitzgerald',
  customer_company: 'Worthington-Fitzgerald Property Management & Lettings Ltd',
  customer_address: '127 Kingsway Boulevard Apartments, Flat 14B, Wellington Court, London',
  customer_postcode: 'SW1A 1AA',
  customer_contact: '020 7946 0958',
  appliance_location: 'Living room chimney breast (open-flued)',
  make_model: 'Valor Dimension Homeflame Slimline Inset Gas Fire',
  serial_number: 'VAL-DHF-2019-00482',
  appliance_type: 'Gas fire (open flue, Class I)',
  gas_escape_issue: false,
  pipework_issue: false,
  ventilation_issue: true,
  meter_issue: false,
  chimney_flue_issue: true,
  other_issue_details: 'Soot/debris in flue; inadequate room ventilation for open-flued appliance.',
  unsafe_situation_description: LONG_FAULT,
  actions_taken: LONG_ACTIONS_TAKEN,
  underlying_cause: LONG_ACTIONS_REQUIRED,
  riddor_11_1_reported: false,
  riddor_11_2_reported: false,
  customer_present: true,
  issued_at: '20/06/2026',
};

describe('Gas Warning Notice renderer audit', () => {
  it('renders an Immediately Dangerous notice with long fault/actions text', async () => {
    const bytes = await renderGasWarningNoticePdf({
      fields,
      issuedAt: '20/06/2026',
      recordId: 'GWN-AUDIT-0001',
    });

    expect(bytes.byteLength).toBeGreaterThan(1000);

    const outDir = path.join(process.cwd(), 'tmp');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'gwn-audit.pdf');
    fs.writeFileSync(outPath, bytes);
    // eslint-disable-next-line no-console
    console.log('WROTE_PDF', outPath, bytes.byteLength, 'bytes');
  });
});
