import { describe, expect, it } from 'vitest';

import { composeCp12DefectSummary, cp12ApplianceHasFailedCheck, cp12FailedChecks } from '@/lib/cp12/defect-summary';

describe('cp12 defect summary', () => {
  /**
   * Flue integrity and spillage were added to the form without being added
   * here, so a failed one counted as no failure at all: the defect notes never
   * opened, and the record-level "Defects identified" stayed empty on a
   * certificate whose appliance had failed the check that matters most.
   */
  it('treats a failed spillage test as a defect', () => {
    const app = { location: 'Living room', spillage_test: 'fail' };
    expect(cp12ApplianceHasFailedCheck(app)).toBe(true);
    expect(cp12FailedChecks(app)).toEqual(['Spillage']);
    expect(composeCp12DefectSummary([app]).defect_description).toBe(
      'Appliance 1 (Living room): Failed: Spillage',
    );
  });

  it('treats a failed flue integrity test as a defect', () => {
    const app = { location: 'Kitchen', flue_integrity_test: 'fail' };
    expect(cp12ApplianceHasFailedCheck(app)).toBe(true);
    expect(cp12FailedChecks(app)).toEqual(['Flue integrity']);
    expect(composeCp12DefectSummary([app]).defect_description).toBe(
      'Appliance 1 (Kitchen): Failed: Flue integrity',
    );
  });

  it('leaves a passing appliance clean across every flue check', () => {
    const app = {
      location: 'Kitchen',
      flue_condition: 'pass',
      flue_performance_test: 'pass',
      spillage_test: 'pass',
      flue_integrity_test: 'pass',
    };
    expect(cp12ApplianceHasFailedCheck(app)).toBe(false);
    expect(cp12FailedChecks(app)).toEqual([]);
  });

  it('turns a failed check into a defect line even without a typed note', () => {
    const summary = composeCp12DefectSummary([
      { location: 'Kitchen', gas_tightness_test: 'fail' },
    ]);
    expect(summary.defect_description).toBe('Appliance 1 (Kitchen): Failed: Gas tightness');
    expect(summary.remedial_action).toBe('');
  });

  it('prefers the engineer note over the auto failed-checks text', () => {
    const summary = composeCp12DefectSummary([
      { location: 'Living room', flue_condition: 'fail', defect_notes: 'Flue partially blocked', actions_taken: 'Swept and re-tested' },
    ]);
    expect(summary.defect_description).toBe('Appliance 1 (Living room): Flue partially blocked');
    expect(summary.remedial_action).toBe('Appliance 1 (Living room): Swept and re-tested');
  });

  it('aggregates multiple appliances and skips passing ones', () => {
    const summary = composeCp12DefectSummary([
      { location: 'Kitchen', gas_tightness_test: 'pass' },
      { location: 'Bathroom', ventilation_satisfactory: 'fail' },
    ]);
    expect(summary.defect_description).toBe('Appliance 2 (Bathroom): Failed: Ventilation');
  });

  it('falls back to actions_required when actions_taken is empty', () => {
    const summary = composeCp12DefectSummary([
      { location: 'Hall', flue_performance_test: 'fail', actions_required: 'Return to make safe' },
    ]);
    expect(summary.remedial_action).toBe('Appliance 1 (Hall): Return to make safe');
  });

  it('reports failed check labels and the has-failed-check flag', () => {
    const app = { safety_devices_correct: 'fail', ventilation_satisfactory: 'pass', gas_tightness_test: 'fail' };
    expect(cp12FailedChecks(app)).toEqual(['Safety device', 'Gas tightness']);
    expect(cp12ApplianceHasFailedCheck(app)).toBe(true);
    expect(cp12ApplianceHasFailedCheck({ ventilation_satisfactory: 'pass' })).toBe(false);
  });

  it('produces empty strings when everything passes', () => {
    const summary = composeCp12DefectSummary([{ location: 'Kitchen', ventilation_satisfactory: 'pass' }]);
    expect(summary).toEqual({ defect_description: '', remedial_action: '' });
  });
});
