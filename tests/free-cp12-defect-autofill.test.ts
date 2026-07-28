import { describe, expect, it } from 'vitest';

import { buildCp12RenderInput } from '@/lib/cp12/buildCp12Render';
import { FreeCp12PayloadSchema, freeCp12ToRenderSource } from '@/lib/cp12/freeCp12Payload';
import {
  composeCp12DefectSummary,
  cp12ApplianceHasFailedCheck,
  cp12FailedChecks,
  type Cp12DefectAppliance,
} from '@/lib/cp12/defect-summary';

/**
 * A failed safety check is itself a defect under Reg 36(3)(e), and its fix is
 * the remedial action under (f). The form composes both from the appliances so
 * the engineer sees what will print; the server composes the same thing when
 * the boxes are blank. These assert the two agree.
 */
const parse = (appliances: Record<string, unknown>[], fields: Record<string, unknown> = {}) =>
  FreeCp12PayloadSchema.parse({ fields, appliances });

const rendered = (appliances: Record<string, unknown>[], fields: Record<string, unknown> = {}) =>
  buildCp12RenderInput(
    freeCp12ToRenderSource(parse(appliances, fields), {
      recordId: 'R',
      certNumber: 'R',
      issuedAt: new Date('2026-07-28T00:00:00Z'),
    }),
  ).fields;

describe('defect and remedial auto-fill', () => {
  it('a failed check is recognised even with no classification', () => {
    const appliance = parse([
      { appliance_type: 'boiler', location: 'Kitchen', flue_condition: 'fail' },
    ]).appliances[0] as unknown as Cp12DefectAppliance;

    expect(cp12ApplianceHasFailedCheck(appliance)).toBe(true);
    expect(cp12FailedChecks(appliance)).toContain('Visual flue/termination');
  });

  it('composes a defect line from failed checks alone', () => {
    const summary = composeCp12DefectSummary(
      parse([
        { appliance_type: 'boiler', location: 'Kitchen', flue_condition: 'fail', gas_tightness_test: 'fail' },
      ]).appliances as unknown as Cp12DefectAppliance[],
    );

    expect(summary.defect_description).toContain('Appliance 1 (Kitchen)');
    expect(summary.defect_description).toContain('Visual flue/termination');
    expect(summary.defect_description).toContain('Gas tightness');
  });

  it('a typed defect note wins over the generated "Failed:" line', () => {
    const summary = composeCp12DefectSummary(
      parse([
        {
          appliance_type: 'boiler',
          location: 'Kitchen',
          flue_condition: 'fail',
          defect_notes: 'Flue joint separated at the elbow',
        },
      ]).appliances as unknown as Cp12DefectAppliance[],
    );

    expect(summary.defect_description).toContain('Flue joint separated at the elbow');
    expect(summary.defect_description).not.toContain('Failed:');
  });

  it('per-appliance actions become the record-level remedial action', () => {
    const summary = composeCp12DefectSummary(
      parse([
        {
          appliance_type: 'boiler',
          location: 'Kitchen',
          flue_condition: 'fail',
          actions_taken: 'Gas supply isolated / capped',
        },
      ]).appliances as unknown as Cp12DefectAppliance[],
    );

    expect(summary.remedial_action).toContain('Gas supply isolated / capped');
  });

  it('falls back to action required when nothing was done today', () => {
    const summary = composeCp12DefectSummary(
      parse([
        {
          appliance_type: 'boiler',
          location: 'Kitchen',
          flue_condition: 'fail',
          actions_required: 'Repair / replace flue',
        },
      ]).appliances as unknown as Cp12DefectAppliance[],
    );

    expect(summary.remedial_action).toContain('Repair / replace flue');
  });

  it('the certificate still prints the summary when the record boxes are blank', () => {
    // The form fills these in, but a payload posted without them must not print
    // "None identified" over the top of a real defect.
    const fields = rendered([
      { appliance_type: 'boiler', location: 'Kitchen', flue_condition: 'fail', actions_taken: 'Capped' },
    ]);

    expect(fields.defectsIdentified).toContain('Visual flue/termination');
    expect(fields.remedialWorksRequired).toContain('Capped');
  });

  it('a clean certificate composes nothing, and the renderer states it explicitly', () => {
    // The mapping leaves these blank; renderCp12CertificateV2 prints
    // "None identified" / "None required" so the record never has an empty box
    // where Reg 36(3)(e)/(f) content belongs.
    const fields = rendered([
      { appliance_type: 'boiler', location: 'Kitchen', flue_condition: 'pass', safety_classification: 'safe' },
    ]);

    expect(fields.defectsIdentified).toBe('');
    expect(fields.remedialWorksRequired).toBe('');
  });

  it('what the engineer types in the record box overrides the summary', () => {
    const fields = rendered(
      [{ appliance_type: 'boiler', location: 'Kitchen', flue_condition: 'fail' }],
      { defect_description: 'My own wording', remedial_action: 'My own action' },
    );

    expect(fields.defectsIdentified).toBe('My own wording');
    expect(fields.remedialWorksRequired).toBe('My own action');
  });
});
