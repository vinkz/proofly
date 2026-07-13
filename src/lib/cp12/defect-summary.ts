/**
 * Aggregates per-appliance defects / remedial actions (and failed checks) into
 * the record-level defect_description / remedial_action fields that render on the
 * CP12. A failed safety check is itself a defect (Reg 36(3)(e)); its fix is the
 * remedial action (Reg 36(3)(f)). This keeps the record-level "end box" in sync
 * with what the engineer captures in context, while remaining editable.
 */

export type Cp12DefectAppliance = {
  location?: string | null;
  appliance_type?: string | null;
  make_model?: string | null;
  defect_notes?: string | null;
  actions_taken?: string | null;
  actions_required?: string | null;
  safety_devices_correct?: string | null;
  ventilation_satisfactory?: string | null;
  flue_condition?: string | null;
  flue_performance_test?: string | null;
  cooker_stability?: string | null;
  gas_tightness_test?: string | null;
};

// Per-appliance checks that can fail; label is what appears in the auto-summary.
const CHECK_LABELS: ReadonlyArray<readonly [keyof Cp12DefectAppliance, string]> = [
  ['safety_devices_correct', 'Safety device'],
  ['ventilation_satisfactory', 'Ventilation'],
  ['flue_condition', 'Visual flue/termination'],
  ['flue_performance_test', 'Flue performance'],
  ['cooker_stability', 'Cooker stability'],
  ['gas_tightness_test', 'Gas tightness'],
];

const t = (v: unknown) => String(v ?? '').trim();
const isFail = (v: unknown) => t(v).toLowerCase() === 'fail';

/** Human-readable labels of the checks that read "fail" on an appliance. */
export function cp12FailedChecks(app: Cp12DefectAppliance): string[] {
  return CHECK_LABELS.filter(([key]) => isFail(app[key])).map(([, label]) => label);
}

/** True when an appliance has any failed check (independent of its classification). */
export function cp12ApplianceHasFailedCheck(app: Cp12DefectAppliance): boolean {
  return CHECK_LABELS.some(([key]) => isFail(app[key]));
}

function applianceLabel(app: Cp12DefectAppliance, index: number): string {
  const where = t(app.location) || t(app.make_model) || t(app.appliance_type);
  return `Appliance ${index + 1}${where ? ` (${where})` : ''}`;
}

/**
 * Compose the record-level defect_description / remedial_action from the
 * appliances. Each appliance contributes a line when it has a defect note or a
 * failed check (defects) and/or a remedial note (remedial action).
 */
export function composeCp12DefectSummary(appliances: Cp12DefectAppliance[]): {
  defect_description: string;
  remedial_action: string;
} {
  const defects: string[] = [];
  const remedials: string[] = [];

  appliances.forEach((app, index) => {
    const label = applianceLabel(app, index);
    const failed = cp12FailedChecks(app);
    const defectText = t(app.defect_notes) || (failed.length ? `Failed: ${failed.join(', ')}` : '');
    if (defectText) defects.push(`${label}: ${defectText}`);

    const remedialText = t(app.actions_taken) || t(app.actions_required);
    if (remedialText) remedials.push(`${label}: ${remedialText}`);
  });

  return {
    defect_description: defects.join('\n'),
    remedial_action: remedials.join('\n'),
  };
}
