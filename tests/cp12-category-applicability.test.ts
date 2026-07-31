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
  flue_location: 'External wall',
  ventilation_provision: '',
  ventilation_satisfactory: 'pass',
  flue_condition: 'pass',
  stability_test: '',
  gas_tightness_test: 'pass',
  co_reading_ppm: '',
  safety_devices_correct: 'pass',
  flue_performance_test: 'pass', flue_integrity_test: 'pass',
  flue_integrity_co2_high: '0.02', flue_integrity_co2_low: '0.01', spillage_test: 'pass',
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

  /**
   * A room-sealed appliance gets a flue integrity test; an open-flued one gets a
   * flue flow test and a spillage test. They are different procedures and never
   * both apply, so the certificate must never carry both — and must never carry
   * the one belonging to the other kind of flue.
   */
  describe('the flue test follows the flue type, not the appliance category', () => {
    const forFlue = (flue_type: string) =>
      buildCp12RenderInput({
        fieldMap: { inspection_date: '2026-07-27' },
        appliances: [appliance({ appliance_type: 'boiler', flue_type })],
        recordId: 'R',
        certNumber: 'R',
        issuedAt: new Date('2026-07-27T00:00:00Z'),
      }).appliances[0];

    it.each(['Room sealed', 'Balanced flue'])('%s: integrity only', (flue) => {
      const out = forFlue(flue);
      expect(out.flueIntegrityTest).toBe('pass');
      expect(out.fluePerformanceTest).toBe('');
      expect(out.spillageTest).toBe('');
    });

    it('Open flue: flow and spillage only', () => {
      const out = forFlue('Open flue');
      expect(out.fluePerformanceTest).toBe('pass');
      expect(out.spillageTest).toBe('pass');
      expect(out.flueIntegrityTest).toBe('');
      expect(out.flueIntegrityCo2High).toBe('');
    });

    it('an unrecognised flue type hides nothing, so no completed check is lost', () => {
      const out = forFlue('Something unusual');
      expect(out.flueIntegrityTest).toBe('pass');
      expect(out.fluePerformanceTest).toBe('pass');
      expect(out.spillageTest).toBe('pass');
    });

    it('the visual flue condition applies to every flued appliance', () => {
      for (const flue of ['Room sealed', 'Open flue', 'Balanced flue']) {
        expect(forFlue(flue).flueTerminationSatisfactory).toBe('pass');
      }
    });

    it('air-inlet readings never print without the integrity result they evidence', () => {
      expect(forFlue('Open flue').flueIntegrityCo2Low).toBe('');
    });
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
