import { describe, expect, it } from 'vitest';

import { buildCp12RenderInput } from '@/lib/cp12/buildCp12Render';
import { freeCp12ToRenderSource, FreeCp12PayloadSchema } from '@/lib/cp12/freeCp12Payload';
import type { Cp12Appliance } from '@/types/certificates';
import { renderCp12CertificatePdf } from '@/server/pdf/renderCp12Certificate';

/**
 * "One generator, not two."
 *
 * The same certificate, expressed the way the authenticated flow expresses it
 * (job_fields rows + cp12_appliances rows) and the way the free tool expresses
 * it (a posted form), must render to the same bytes. If this ever fails, the
 * two flows have started disagreeing about what a CP12 says.
 */
const ISSUED_AT = new Date('2026-07-27T09:00:00Z');
const REFERENCE = 'FREE-ABCD1234';

// --- how the authenticated flow arrives at the renderer ---------------------
const paidFieldMap: Record<string, unknown> = {
  inspection_date: '2026-07-27',
  job_address_line1: '9 Property Road',
  job_address_city: 'London',
  job_postcode: 'SE1 9SG',
  landlord_name: 'A Landlord',
  landlord_company: 'Lettings Ltd',
  landlord_address_line1: '1 Landlord Street',
  landlord_city: 'London',
  landlord_postcode: 'E1 6AN',
  landlord_tel: '020 7946 1234',
  engineer_name: 'Alex Engineer',
  gas_safe_number: '123456',
  engineer_id_card_number: 'ID-9',
  company_name: 'Gas Co',
  company_address: '2 Works Lane',
  company_phone: '0800 000 000',
  company_email: 'hi@gas.co',
  engineer_signature: 'data:image/png;base64,iVBORw0KGgo=',
  defect_description: 'None identified',
  remedial_action: 'None required',
  comments: 'Boiler serviced at the same visit.',
  co_alarm_fitted: 'Yes',
  co_alarm_tested: 'Yes',
  emergency_control_accessible: 'Yes',
  gas_tightness_satisfactory: 'pass',
};

const paidAppliance: Cp12Appliance = {
  appliance_type: 'boiler',
  appliance_subtype: 'combi',
  cooker_stability: '',
  landlords_appliance: 'Yes',
  appliance_inspected: 'Yes',
  location: 'Kitchen',
  make_model: 'Vaillant EcoTec',
  gc_number: '47-311-92',
  operating_pressure: '20 mbar',
  heat_input: '24 kW',
  high_co_ppm: '12',
  high_co2: '9.1',
  high_ratio: '0.0013',
  low_co_ppm: '4',
  low_co2: '4.2',
  low_ratio: '0.0009',
  co_reading_high: '',
  co_reading_low: '',
  flue_type: 'Room sealed',
  flue_location: 'Kitchen',
  ventilation_provision: '',
  ventilation_satisfactory: 'pass',
  flue_condition: 'pass',
  stability_test: '',
  gas_tightness_test: 'pass',
  co_reading_ppm: '',
  safety_devices_correct: 'pass',
  flue_performance_test: 'pass',
  flue_integrity_test: 'pass',
  flue_integrity_co2_high: '0.02',
  flue_integrity_co2_low: '0.01',
  spillage_test: 'pass',
  appliance_serviced: 'Yes',
  combustion_notes: '',
  safety_rating: '',
  classification_code: '',
  safety_classification: 'safe',
  defect_notes: '',
  actions_taken: '',
  actions_required: '',
  warning_notice_issued: false,
  appliance_disconnected: false,
  danger_do_not_use_attached: false,
  reg_26_9_confirmed: true,
};

// --- the same certificate as the free tool's posted form --------------------
const freePayload = FreeCp12PayloadSchema.parse({
  fields: {
    inspection_date: '2026-07-27',
    job_address_line1: '9 Property Road',
    job_address_city: 'London',
    job_postcode: 'SE1 9SG',
    landlord_name: 'A Landlord',
    landlord_company: 'Lettings Ltd',
    landlord_address_line1: '1 Landlord Street',
    landlord_city: 'London',
    landlord_postcode: 'E1 6AN',
    landlord_tel: '020 7946 1234',
    engineer_name: 'Alex Engineer',
    gas_safe_number: '123456',
    engineer_id_card_number: 'ID-9',
    company_name: 'Gas Co',
    company_address: '2 Works Lane',
    company_phone: '0800 000 000',
    company_email: 'hi@gas.co',
    engineer_signature: 'data:image/png;base64,iVBORw0KGgo=',
    defect_description: 'None identified',
    remedial_action: 'None required',
    comments: 'Boiler serviced at the same visit.',
    co_alarm_fitted: 'Yes',
    co_alarm_tested: 'Yes',
    emergency_control_accessible: 'Yes',
    gas_tightness_satisfactory: 'pass',
  },
  appliances: [
    {
      appliance_type: 'boiler',
      appliance_subtype: 'combi',
      location: 'Kitchen',
      make_model: 'Vaillant EcoTec',
      gc_number: '47-311-92',
      operating_pressure: '20 mbar',
      heat_input: '24 kW',
      high_co_ppm: '12',
      high_co2: '9.1',
      high_ratio: '0.0013',
      low_co_ppm: '4',
      low_co2: '4.2',
      low_ratio: '0.0009',
      flue_type: 'Room sealed',
      ventilation_satisfactory: 'pass',
      flue_condition: 'pass',
      gas_tightness_test: 'pass',
      safety_devices_correct: 'pass',
      flue_performance_test: 'pass',
      flue_integrity_test: 'pass',
      flue_integrity_co2_high: '0.02',
      flue_integrity_co2_low: '0.01',
      appliance_serviced: 'Yes',
      safety_classification: 'safe',
      reg_26_9_confirmed: true,
    },
  ],
});

describe('free CP12 vs authenticated CP12', () => {
  const paidInput = buildCp12RenderInput({
    fieldMap: paidFieldMap,
    appliances: [paidAppliance],
    recordId: REFERENCE,
    certNumber: REFERENCE,
    issuedAt: ISSUED_AT,
  });

  const freeInput = buildCp12RenderInput(
    freeCp12ToRenderSource(freePayload, {
      recordId: REFERENCE,
      certNumber: REFERENCE,
      issuedAt: ISSUED_AT,
    }),
  );

  it('maps to identical printed fields', () => {
    expect(freeInput.fields).toEqual(paidInput.fields);
  });

  it('maps to identical appliance rows', () => {
    expect(freeInput.appliances).toEqual(paidInput.appliances);
  });

  it('renders byte-identical PDFs', async () => {
    const [free, paid] = await Promise.all([
      renderCp12CertificatePdf(freeInput),
      renderCp12CertificatePdf(paidInput),
    ]);

    expect(free.length).toBeGreaterThan(1000);
    expect(Buffer.from(free).equals(Buffer.from(paid))).toBe(true);
  });

  it('carries no watermark or trial marker in the output', async () => {
    const bytes = await renderCp12CertificatePdf(freeInput);
    const text = Buffer.from(bytes).toString('latin1').toLowerCase();
    for (const marker of ['watermark', 'sample', 'specimen', 'trial', 'not valid', 'preview only']) {
      expect(text).not.toContain(marker);
    }
  });
});
