import { describe, expect, it } from 'vitest';

import { buildCp12RenderInput } from '@/lib/cp12/buildCp12Render';
import { CP12_APPLIANCE_CONFIG, type Cp12ApplianceCategory } from '@/lib/cp12/applianceConfig';
import type { Cp12Appliance } from '@/types/certificates';

/**
 * The certificate must agree with the appliance config about what applies.
 *
 * applianceConfig already declares hobs/cookers flueless and hides their flue
 * fields in the form. Before this, the mapping still emitted a flue location
 * for them (it falls back to the appliance location), so a flueless hob printed
 * "Flue location: Kitchen" — asserting a flue that does not exist, on a record
 * whose Reg 36(3)(d) content is the description and location of each appliance
 * and flue.
 *
 * These run against the shared mapping, so they cover the authenticated flow
 * and the free tool at once.
 */
const appliance = (over: Partial<Cp12Appliance>): Cp12Appliance => ({
  appliance_type: 'boiler',
  appliance_subtype: '',
  cooker_stability: 'pass',
  landlords_appliance: 'Yes',
  appliance_inspected: 'Yes',
  location: 'Kitchen',
  make_model: 'Test Appliance',
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
  flue_location: 'External wall',
  ventilation_provision: '',
  ventilation_satisfactory: 'pass',
  flue_condition: 'pass',
  stability_test: '',
  gas_tightness_test: 'pass',
  co_reading_ppm: '',
  safety_devices_correct: 'pass',
  flue_performance_test: 'pass',
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
  ...over,
});

const render = (category: Cp12ApplianceCategory) =>
  buildCp12RenderInput({
    fieldMap: { inspection_date: '2026-07-27' },
    appliances: [appliance({ appliance_type: category })],
    recordId: 'R',
    certNumber: 'R',
    issuedAt: new Date('2026-07-27T00:00:00Z'),
  }).appliances[0];

const CATEGORIES = Object.keys(CP12_APPLIANCE_CONFIG) as Cp12ApplianceCategory[];

describe('appliance-category applicability reaches the certificate', () => {
  it.each(CATEGORIES)('%s: flue fields follow the config', (category) => {
    const out = render(category);
    const flued = CP12_APPLIANCE_CONFIG[category].fields.flue_type !== 'hidden';

    if (flued) {
      expect(out.flueType).toBeTruthy();
      expect(out.flueLocation).toBeTruthy();
    } else {
      expect(out.flueType).toBe('');
      expect(out.flueLocation).toBe('');
      expect(out.flueTerminationSatisfactory).toBe('');
    }
  });

  it.each(CATEGORIES)('%s: cooker stability follows the config', (category) => {
    const out = render(category);
    const applies = CP12_APPLIANCE_CONFIG[category].fields.cooker_stability !== 'hidden';
    expect(Boolean(out.cookerStability)).toBe(applies);
  });

  it.each(CATEGORIES)('%s: combustion readings follow the config', (category) => {
    const out = render(category);
    const applies = CP12_APPLIANCE_CONFIG[category].fields.combustion !== 'hidden';
    expect(Boolean(out.combustionHigh)).toBe(applies);
    expect(Boolean(out.combustionHighCoPpm)).toBe(applies);
  });

  it('a flueless hob never claims a flue location, even from its own location', () => {
    const out = render('hob_cooker');
    expect(out.location).toBe('Kitchen');
    expect(out.flueLocation).toBe('');
  });

  it('a hob still records the checks that do apply to it', () => {
    const out = render('hob_cooker');
    expect(out.cookerStability).toBe('pass');
    expect(out.ventilationSatisfactory).toBe('pass');
    expect(out.safetyDevice).toBe('pass');
    expect(out.gasTightnessTest).toBe('pass');
    // A hob has no flue, so it must not carry a flue performance result. This
    // used to print as a "Spillage test" row fed from the tightness answer.
    expect(out.fluePerformanceTest).toBe('');
    expect(out.applianceSafeToUse).toBe('Yes');
    expect(out.reg26Confirmed).toBe(true);
  });
});
