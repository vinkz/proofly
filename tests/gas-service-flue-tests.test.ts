import { describe, expect, it } from 'vitest';

import {
  FreeBoilerServiceSchema,
  freeBoilerServiceToRenderInput,
} from '@/lib/boiler-service/freeBoilerServicePayload';
import { resolveCp12FlueKind } from '@/lib/cp12/applianceConfig';

/**
 * The service record's flue checks.
 *
 * Two rules this file exists to hold. First, nothing on this record may be
 * derived from an answer to a different question: the record used to carry a
 * `spillageTest` fed from the gas tightness test on the free path and from the
 * combustion test on the paid one — a result the engineer was never asked for,
 * from two different wrong sources.
 *
 * Second, which flue test applies is a property of the appliance, not of the
 * document. A room-sealed appliance gets the integrity test and an open-flued
 * one gets flow and spillage, on a CP12 and on a service record alike, so both
 * read the same rule rather than each keeping their own copy.
 */
const render = (over: Record<string, string> = {}) =>
  freeBoilerServiceToRenderInput(
    FreeBoilerServiceSchema.parse({
      engineer_name: 'A Engineer',
      gas_safe_number: '123456',
      boiler_make: 'Vaillant',
      boiler_model: 'EcoTec',
      boiler_location: 'Kitchen',
      serial_number: 'SN-1',
      gc_number: '47-311-92',
      service_date: '2026-07-31',
      appliance_safe: 'pass',
      appliance_flueing_safe: 'pass',
      tightness_test: 'pass',
      ...over,
    }),
    { recordId: 'R-1', certNumber: 'R-1', issuedAt: new Date('2026-07-31T00:00:00Z') },
  );

describe('gas service record: flue checks', () => {
  it('reports only what was asked — never a spillage result derived from tightness', () => {
    const out = render({ flue_type: 'Open flue', tightness_test: 'pass' });
    // Tightness passed; no spillage test was carried out. The record must not
    // claim one, which is exactly what the old mapping did.
    expect(out.fields.spillageTest ?? '').toBe('');
    expect(out.fields.tightnessTest).toBe('pass');
  });

  it('carries an open-flued appliance’s flow and spillage results', () => {
    const out = render({ flue_type: 'Open flue', flue_flow_test: 'pass', spillage_test: 'fail' });
    expect(out.fields.flueFlowTest).toBe('pass');
    expect(out.fields.spillageTest).toBe('fail');
  });

  it('carries a room-sealed appliance’s integrity result and readings', () => {
    const out = render({
      flue_type: 'Room sealed',
      flue_integrity_test: 'pass',
      flue_integrity_co2_high: '0.02',
      flue_integrity_co2_low: '0.01',
    });
    expect(out.fields.flueIntegrityTest).toBe('pass');
    expect(out.fields.flueIntegrityCo2High).toBe('0.02');
    expect(out.fields.flueIntegrityCo2Low).toBe('0.01');
  });

  it('shares the CP12 flue-kind rule rather than keeping its own', () => {
    // The service record's flue type list is the CP12 one, so every label it
    // can store must resolve to a kind the shared rule recognises.
    expect(resolveCp12FlueKind('Room sealed')).toBe('room_sealed');
    expect(resolveCp12FlueKind('Balanced flue')).toBe('room_sealed');
    expect(resolveCp12FlueKind('Open flue')).toBe('open_flue');
    expect(resolveCp12FlueKind('Flueless')).toBe('flueless');
    expect(resolveCp12FlueKind('Other')).toBe('unknown');
  });

  it('puts the GC number on the appliance it identifies', () => {
    expect(render().appliances?.[0]?.gcNumber).toBe('47-311-92');
  });

  it('leaves every flue result blank when none was recorded', () => {
    const out = render();
    expect(out.fields.flueIntegrityTest ?? '').toBe('');
    expect(out.fields.flueFlowTest ?? '').toBe('');
    expect(out.fields.spillageTest ?? '').toBe('');
  });
});

describe('gas type reaches the document', () => {
  /**
   * Both records asked for the gas type and neither printed it. On the service
   * record the field had been in the payload since launch and was never even
   * rendered in the form. A gas safety document that does not say which fuel it
   * covers is incomplete — and for an LPG engineer it is the one field that
   * makes the record theirs.
   */
  it('carries the service record’s gas type through to the renderer', () => {
    expect(render({ gas_type: 'LPG' }).fields.gasType).toBe('LPG');
  });

  it('leaves it blank rather than assuming natural gas', () => {
    expect(render().fields.gasType ?? '').toBe('');
  });
});
