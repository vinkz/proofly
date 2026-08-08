import { GAS_WARNING_REQUIRED_FOR_ISSUE, type GasWarningNoticeFields } from '@/types/gas-warning-notice';

// Single source of truth for what blocks issuing a Gas Warning Notice — shared by
// the wizard checklist and the server issue path (mirrors the CP12 validator).
// Legal/procedural basis: GIUSP (IGEM/G/11), GSIUR Reg 26(9) (examine + notify),
// and RIDDOR 2013 Reg 6(2) (report Immediately Dangerous fittings to HSE).

const hasValue = (v: unknown) => v !== undefined && v !== null && String(v).trim().length > 0;
const isTruthy = (v: unknown) => v === true || ['yes', 'y', 'true', '1'].includes(String(v ?? '').trim().toLowerCase());

/** Default present = true unless a notice-left flag says otherwise. */
export function gwnCustomerPresent(fields: GasWarningNoticeFields): boolean {
  const explicit = fields.customer_present;
  if (explicit !== undefined && explicit !== null && String(explicit).trim() !== '') return isTruthy(explicit);
  if (isTruthy(fields.notice_left_on_premises)) return false;
  return true;
}

/** Handover confirmed = customer informed (present) or notice left (not present). */
export function gwnHandoverConfirmed(fields: GasWarningNoticeFields): boolean {
  return gwnCustomerPresent(fields)
    ? isTruthy(fields.customer_informed)
    : isTruthy(fields.notice_left_on_premises ?? fields.customer_informed);
}

/**
 * True when the engineer has signed the notice.
 *
 * Three keys because three paths write it: the wizard's signature upload stores
 * `engineer_signature` and `engineer_signature_path`, while the free CP12 flow
 * carries a data URL through as `engineer_signature_url`. Same rule as the CP12
 * validator, which accepts the same trio.
 */
export function gwnEngineerSigned(fields: GasWarningNoticeFields): boolean {
  const record = fields as Record<string, unknown>;
  return ['engineer_signature_path', 'engineer_signature', 'engineer_signature_url'].some((key) =>
    hasValue(record[key]),
  );
}

/** True when the ID RIDDOR report has been recorded (flag or reference). */
export function gwnRiddorRecorded(fields: GasWarningNoticeFields): boolean {
  return isTruthy(fields.riddor_11_1_reported) || isTruthy(fields.riddor_11_2_reported) || hasValue(fields.emergency_reference);
}

/** The authoritative issue gate. Returns human-readable blocking errors. */
export function validateGwnForIssue(fields: GasWarningNoticeFields): string[] {
  const errors: string[] = [];

  GAS_WARNING_REQUIRED_FOR_ISSUE.forEach((key) => {
    if (key === 'customer_informed') {
      if (!gwnHandoverConfirmed(fields)) {
        errors.push(
          gwnCustomerPresent(fields)
            ? 'Customer must be informed before issuing'
            : 'Notice left on premises must be confirmed when customer is not present',
        );
      }
      return;
    }
    if (!hasValue((fields as Record<string, unknown>)[key])) {
      errors.push(`${key.replace(/_/g, ' ')} is required`);
    }
  });

  // The notice identifies the engineer who made the determination, so it is not
  // complete unsigned. Kept out of GAS_WARNING_REQUIRED_FOR_ISSUE because that
  // list checks one key per entry and would read "engineer signature url is
  // required"; the signature can arrive under any of three keys.
  if (!gwnEngineerSigned(fields)) {
    errors.push('Engineer signature is required');
  }

  // Immediately Dangerous — GIUSP + RIDDOR duties.
  if (String(fields.classification ?? '').trim() === 'IMMEDIATELY_DANGEROUS') {
    if (!isTruthy(fields.danger_do_not_use_label_fitted)) {
      errors.push('Danger: Do Not Use label must be fitted for Immediately Dangerous');
    }
    if (!isTruthy(fields.gas_supply_isolated) && !isTruthy(fields.customer_refused_isolation)) {
      errors.push('Customer refusal is required when gas supply is not isolated for Immediately Dangerous');
    }
    // F-W2: ID fittings must be reported to HSE under RIDDOR (Reg 6(2)).
    if (!gwnRiddorRecorded(fields)) {
      errors.push('Immediately Dangerous fittings must be reported to HSE under RIDDOR — record the report or its reference');
    }
  }

  return errors;
}
