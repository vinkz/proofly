/**
 * The per-appliance safety checks a CP12 asks, in the order it asks them.
 *
 * One list, read by both forms. The free tool renders each as a chip row and
 * the wizard as a pass/fail toggle — those are genuinely different because the
 * layouts are different, and neither is worth unifying. What is worth unifying
 * is *which* checks exist, what they are called, and when they apply, because
 * that is what drifted: flue integrity and spillage were added to one form, then
 * the other, then the defect summary, each as a separate edit, and the gap
 * between the second and third meant a failed spillage test reached a
 * certificate without appearing in "Defects identified".
 *
 * Adding a check is now one entry here. Both forms pick it up, in the same
 * order, with the same label and the same applicability rule.
 *
 * Deliberately not in this list: the air-inlet CO2 readings, which are free-text
 * evidence conditional on the integrity result rather than a check with a
 * verdict, and the combustion block, which both forms render as a group.
 */
import {
  cp12FieldVisible,
  type Cp12ApplianceCategory,
  type Cp12CheckField,
} from './applianceConfig';
import type { Cp12Appliance } from '@/types/certificates';

/** Answer vocabulary. Pass/fail for a test; yes/no for something done or not. */
export type Cp12CheckAnswers = 'pass_fail' | 'yes_no';

export type Cp12ApplianceCheck = {
  /** Key on the appliance row this check reads and writes. */
  key: Extract<
    keyof Cp12Appliance,
    | 'safety_devices_correct'
    | 'ventilation_satisfactory'
    | 'flue_condition'
    | 'flue_integrity_test'
    | 'flue_performance_test'
    | 'spillage_test'
    | 'cooker_stability'
    | 'gas_tightness_test'
    | 'appliance_serviced'
  >;
  /** Applicability rule in applianceConfig. Usually the same name as `key`. */
  field: Cp12CheckField;
  label: string;
  /** One line for a check whose name alone is ambiguous. */
  hint?: string;
  answers: Cp12CheckAnswers;
};

export const CP12_APPLIANCE_CHECKS: readonly Cp12ApplianceCheck[] = [
  {
    key: 'safety_devices_correct',
    field: 'safety_devices_correct',
    label: 'Safety device(s) correct operation',
    answers: 'pass_fail',
  },
  {
    key: 'ventilation_satisfactory',
    field: 'ventilation_satisfactory',
    label: 'Ventilation provision satisfactory',
    answers: 'pass_fail',
  },
  {
    key: 'flue_condition',
    field: 'flue_condition',
    label: 'Visual condition of flue and termination satisfactory',
    answers: 'pass_fail',
  },
  // Room-sealed and open-flued appliances get different flue tests and never
  // both — see FLUE_KIND_FIELDS. Listing all three together is safe because the
  // applicability rule removes the pair that does not apply.
  {
    key: 'flue_integrity_test',
    field: 'flue_integrity_test',
    label: 'Flue integrity test',
    hint: 'Analyser at the air-inlet sampling point, at maximum and minimum rate.',
    answers: 'pass_fail',
  },
  {
    key: 'flue_performance_test',
    field: 'flue_performance_test',
    label: 'Flue flow test',
    answers: 'pass_fail',
  },
  {
    key: 'spillage_test',
    field: 'spillage_test',
    label: 'Spillage test',
    hint: 'Smoke match at the draught diverter with doors and windows shut.',
    answers: 'pass_fail',
  },
  {
    key: 'cooker_stability',
    field: 'cooker_stability',
    label: 'Cooker stability (bracket/chain)',
    answers: 'pass_fail',
  },
  {
    key: 'gas_tightness_test',
    field: 'gas_tightness_test',
    label: 'Gas tightness test',
    answers: 'pass_fail',
  },
  {
    key: 'appliance_serviced',
    field: 'appliance_serviced',
    label: 'Appliance serviced',
    answers: 'yes_no',
  },
];

/**
 * The checks that apply to one appliance, in order.
 *
 * `flueType` narrows the flue tests to the one pair the appliance actually
 * gets; omitting it falls back to the category-level answer, which offers all
 * of them rather than hiding one an engineer may have carried out.
 */
export function visibleCp12ApplianceChecks(
  category: Cp12ApplianceCategory,
  flueType?: string | null,
): Cp12ApplianceCheck[] {
  return CP12_APPLIANCE_CHECKS.filter((check) =>
    cp12FieldVisible(category, check.field, flueType),
  );
}
