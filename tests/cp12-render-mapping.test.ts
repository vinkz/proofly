import { describe, expect, it } from 'vitest';
import { buildCp12RenderInput } from '@/lib/cp12/buildCp12Render';
import type { Cp12Appliance } from '@/types/certificates';

/**
 * Golden snapshot of the CP12 mapping — the single translation from captured
 * fields to printed fields, shared by the authenticated flow and the free tool.
 * These snapshots were verified byte-identical against the pre-extraction inline
 * mapping in src/server/certificates.ts. A diff here means the two flows are
 * about to disagree about what a CP12 says: check it is intentional.
 */
type MappingCase = {
  mergedFieldMap: Record<string, unknown>;
  appliancesForIssue: Cp12Appliance[];
  customer: { name: string; address: string; organization: string };
  propertyAddress: { summary: string; postcode: string };
  publicId: string;
};

const appliance = (over: Partial<Cp12Appliance>): Cp12Appliance => ({
  appliance_type: 'boiler', appliance_subtype: 'combi', cooker_stability: '',
  landlords_appliance: 'Yes', appliance_inspected: 'Yes', location: 'Kitchen',
  make_model: 'Vaillant EcoTec', gc_number: '47-311-92', operating_pressure: '20 mbar', heat_input: '24 kW',
  gas_type: '',
  high_co_ppm: '12', high_co2: '9.1', high_ratio: '0.0013', low_co_ppm: '4',
  low_co2: '4.2', low_ratio: '0.0009', co_reading_high: '', co_reading_low: '',
  flue_type: 'Room sealed', flue_location: 'External wall', ventilation_provision: 'N/A',
  ventilation_satisfactory: 'pass', flue_condition: 'pass', stability_test: '',
  gas_tightness_test: 'pass', co_reading_ppm: '', safety_devices_correct: 'pass',
  flue_performance_test: 'pass', flue_integrity_test: 'pass',
  flue_integrity_co2_high: '0.02', flue_integrity_co2_low: '0.01', spillage_test: 'pass', appliance_serviced: 'Yes', combustion_notes: '',
  safety_rating: 'safe', classification_code: '', safety_classification: 'safe',
  defect_notes: '', actions_taken: '', actions_required: '',
  warning_notice_issued: false, appliance_disconnected: false,
  danger_do_not_use_attached: false, reg_26_9_confirmed: true, ...over,
});

// Cases chosen to exercise every fallback branch in the mapping: fully-populated,
// sparse (address/landlord fallbacks), unsafe appliance (composed defect summary),
// and the non-boiler categories.
const cases: Array<{ name: string; args: MappingCase }> = [
  {
    name: 'fully populated',
    args: {
      mergedFieldMap: {
        record_id: 'CN-0001', inspection_date: '2026-07-01', next_inspection_due: '2027-07-01',
        landlord_name: 'A Landlord', landlord_company: 'Lettings Ltd',
        landlord_address_line1: '1 Test St', landlord_address_line2: 'Flat 2',
        landlord_city: 'London', landlord_postcode: 'E1 6AN', landlord_tel: '020 7946 1234',
        job_address_line1: '9 Property Rd', job_address_line2: '', job_address_city: 'London',
        job_postcode: 'SE1 9SG', job_address_name: 'The Gables', job_tel: '07700 900000',
        company_name: 'Gas Co', company_address: '2 Works Ln', company_phone: '0800 000',
        company_email: 'hi@gas.co', gas_safe_number: '123456', engineer_name: 'Alex Eng',
        engineer_id: 'ID-9', engineer_signature_path: 'sig/abc.png',
        customer_signature_path: 'sig/cust.png', completion_date: '2026-07-01',
        defect_description: 'None', remedial_action: 'None', warning_notice_issued: 'No',
        comments: 'All good', co_alarm_fitted: 'Yes', co_alarm_tested: 'Yes',
        co_alarm_satisfactory: 'Yes', emergency_control_accessible: 'Yes',
        gas_tightness_satisfactory: 'pass', pipework_visual_satisfactory: 'pass',
        equipotential_bonding_satisfactory: 'pass',
      },
      appliancesForIssue: [appliance({})],
      customer: { name: 'A Landlord', address: '1 Test St, London, E1 6AN', organization: 'Lettings Ltd' },
      propertyAddress: { summary: '9 Property Rd, London, SE1 9SG', postcode: 'SE1 9SG' },
      publicId: 'CN-0001',
    },
  },
  {
    name: 'sparse — relies on address splitting + customer fallbacks',
    args: {
      mergedFieldMap: { inspection_date: '2026-07-02' },
      appliancesForIssue: [appliance({ make_model: '' })],
      customer: { name: 'Fallback Landlord', address: '5 Fallback Way, Leeds, LS1 4AP', organization: 'Fallback Co' },
      propertyAddress: { summary: '77 Other St, Leeds, LS2 8JS', postcode: 'LS2 8JS' },
      publicId: 'CN-0002',
    },
  },
  {
    name: 'unsafe appliance — composed defect/remedial summary',
    args: {
      mergedFieldMap: { inspection_date: '2026-07-03' },
      appliancesForIssue: [
        appliance({ safety_classification: 'id', defect_notes: 'Cracked heat exchanger', actions_taken: 'Capped and labelled', warning_notice_issued: true, flue_condition: 'fail' }),
        appliance({ appliance_type: 'hob_cooker', appliance_subtype: '', make_model: 'Bosch Hob', location: 'Kitchen', cooker_stability: 'fail', safety_classification: 'ar', actions_required: 'Fit stability bracket' }),
      ],
      customer: { name: 'C', address: '', organization: '' },
      propertyAddress: { summary: '', postcode: '' },
      publicId: 'CN-0003',
    },
  },
  {
    name: 'non-boiler categories',
    args: {
      mergedFieldMap: { inspection_date: '2026-07-04', address: '12 Legacy Rd, Hull, HU1 1AA' },
      appliancesForIssue: [
        appliance({ appliance_type: 'gas_fire', appliance_subtype: '', make_model: '' }),
        appliance({ appliance_type: 'water_heater', appliance_subtype: '', make_model: '' }),
        appliance({ appliance_type: 'other', appliance_subtype: '', make_model: '' }),
      ],
      customer: { name: '', address: '', organization: '' },
      propertyAddress: { summary: '', postcode: '' },
      publicId: 'CN-0004',
    },
  },
];

describe('buildCp12RenderInput', () => {
  it.each(cases)('$name', ({ args }) => {
    const next = buildCp12RenderInput({
      fieldMap: args.mergedFieldMap,
      appliances: args.appliancesForIssue,
      recordId: 'job-uuid',
      certNumber: args.publicId,
      issuedAt: new Date('2026-07-27T00:00:00Z'),
      fallbacks: {
        customerName: args.customer.name,
        customerOrganization: args.customer.organization,
        customerAddress: args.customer.address,
        propertySummary: args.propertyAddress.summary,
        propertyPostcode: args.propertyAddress.postcode,
      },
    });
    expect(next.fields).toMatchSnapshot('fields');
    expect(next.appliances).toMatchSnapshot('appliances');
  });
});
