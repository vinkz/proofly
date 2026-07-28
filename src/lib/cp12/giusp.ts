/**
 * The GIUSP answers a Gas Warning Notice needs and a CP12 does not.
 *
 * One definition, shared by the free tool and the paid wizard, so the two flows
 * ask the same questions in the same words and map them onto the notice the
 * same way. That shared definition is the actual continuity guarantee between
 * free and paid — not layout.
 *
 * Basis: GIUSP (IGEM/G/11) for the procedure, GSIUR Reg 26(9) for notifying the
 * responsible person, and RIDDOR 2013 Reg 6(2) for the 14-day HSE report on an
 * Immediately Dangerous fitting. See audit/gas-warning-notice-field-analysis.md.
 *
 * Framework-free: imported by client forms and by the server issue path.
 */
import type { GasWarningNoticeFields } from '@/types/gas-warning-notice';

export const GIUSP_ANSWER_KEYS = [
  'customer_present',
  'customer_informed',
  'notice_left_on_premises',
  'gas_supply_isolated',
  'appliance_capped_off',
  'customer_refused_isolation',
  'danger_label_fitted',
  'emergency_services_contacted',
  'riddor_reported',
  'riddor_reference',
] as const;

export type GiuspAnswerKey = (typeof GIUSP_ANSWER_KEYS)[number];

/**
 * Yes / No / unanswered, deliberately not booleans. For an Immediately
 * Dangerous fitting the issue gate treats "no" and "not answered" differently,
 * and collapsing them would quietly pass situations that should block.
 * `riddor_reference` is free text.
 */
export type GiuspAnswers = Record<GiuspAnswerKey, string>;

export const emptyGiuspAnswers = (): GiuspAnswers =>
  Object.fromEntries(GIUSP_ANSWER_KEYS.map((key) => [key, ''])) as GiuspAnswers;

/**
 * Where one appliance's answers live on the parent CP12 job.
 *
 * job_fields is key-value, so the notice's answers can be collected during the
 * CP12 and carried across at issue without a schema change. Namespaced by
 * appliance because a record can have more than one unsafe appliance, each
 * getting its own notice.
 */
export const giuspFieldKey = (applianceKey: string, answer: GiuspAnswerKey) =>
  `giusp__${applianceKey}__${answer}`;

const text = (value: unknown) => (value === undefined || value === null ? '' : String(value).trim());

export function readGiuspAnswers(
  fieldMap: Record<string, unknown>,
  applianceKey: string,
): GiuspAnswers {
  return Object.fromEntries(
    GIUSP_ANSWER_KEYS.map((key) => [key, text(fieldMap[giuspFieldKey(applianceKey, key)])]),
  ) as GiuspAnswers;
}

/** Flatten for persistence. Empty answers are still written, so clearing one sticks. */
export function giuspFieldEntries(applianceKey: string, answers: GiuspAnswers) {
  return GIUSP_ANSWER_KEYS.map((key) => ({
    field_key: giuspFieldKey(applianceKey, key),
    value: answers[key] ?? '',
  }));
}

export const giuspAnswered = (answers: GiuspAnswers) =>
  GIUSP_ANSWER_KEYS.some((key) => text(answers[key]).length > 0);

/**
 * Map the answers onto the notice's own field names.
 *
 * The handover pair is derived rather than asked twice: when the responsible
 * person was there it is "informed", when they were not it is "notice left".
 * validateGwnForIssue checks whichever applies.
 */
export function giuspAnswersToGwnFields(answers: GiuspAnswers): Partial<GasWarningNoticeFields> {
  const present = answers.customer_present === 'Yes';

  return {
    gas_supply_isolated: answers.gas_supply_isolated === 'Yes',
    appliance_capped_off: answers.appliance_capped_off === 'Yes',
    customer_refused_isolation: answers.customer_refused_isolation === 'Yes',
    danger_do_not_use_label_fitted: answers.danger_label_fitted === 'Yes',
    emergency_services_contacted: answers.emergency_services_contacted === 'Yes',
    customer_present: present,
    customer_informed: present && answers.customer_informed === 'Yes',
    notice_left_on_premises: !present && answers.notice_left_on_premises === 'Yes',
    riddor_11_1_reported: answers.riddor_reported === 'Yes',
    emergency_reference: answers.riddor_reference,
  };
}
