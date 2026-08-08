import { describe, expect, it } from 'vitest';

import {
  GIUSP_ANSWER_KEYS,
  emptyGiuspAnswers,
  giuspAnswered,
  giuspAnswersToGwnFields,
  giuspFieldEntries,
  giuspFieldKey,
  readGiuspAnswers,
  type GiuspAnswers,
} from '@/lib/cp12/giusp';
import { FreeCp12ApplianceSchema } from '@/lib/cp12/freeCp12Payload';
import { validateGwnForIssue } from '@/lib/gwn/validation';
import type { GasWarningNoticeFields } from '@/types/gas-warning-notice';

/**
 * One definition of the GIUSP questions, shared by the free tool and the paid
 * wizard. If these two ever ask different questions or map an answer
 * differently, an engineer moving from free to paid gets a different notice
 * from the same facts.
 */
const answers = (over: Partial<GiuspAnswers> = {}): GiuspAnswers => ({
  ...emptyGiuspAnswers(),
  ...over,
});

describe('shared GIUSP answers', () => {
  it('the free tool asks exactly the shared question set', () => {
    // Behavioural rather than poking at zod internals: what an appliance
    // actually parses to is what the form binds against. A compile-time
    // assertion in freeCp12Payload.ts guards the same thing at build.
    const parsed = FreeCp12ApplianceSchema.parse({ appliance_type: 'boiler' });
    expect(Object.keys(parsed.unsafe_situation).sort()).toEqual([...GIUSP_ANSWER_KEYS].sort());
  });

  it('namespaces answers per appliance so two unsafe appliances cannot collide', () => {
    expect(giuspFieldKey('appliance_1', 'riddor_reported')).toBe('giusp__appliance_1__riddor_reported');
    expect(giuspFieldKey('appliance_2', 'riddor_reported')).not.toBe(
      giuspFieldKey('appliance_1', 'riddor_reported'),
    );
  });

  it('round-trips through job_fields', () => {
    const original = answers({ customer_present: 'Yes', customer_informed: 'Yes', riddor_reference: 'HSE-1' });
    const entries = giuspFieldEntries('appliance_1', original);
    const fieldMap = Object.fromEntries(entries.map((e) => [e.field_key, e.value]));

    expect(readGiuspAnswers(fieldMap, 'appliance_1')).toEqual(original);
    // A different appliance reads back blank, not the first one's answers.
    expect(readGiuspAnswers(fieldMap, 'appliance_2')).toEqual(emptyGiuspAnswers());
  });

  it('writes every key so clearing an answer sticks', () => {
    expect(giuspFieldEntries('appliance_1', emptyGiuspAnswers())).toHaveLength(GIUSP_ANSWER_KEYS.length);
  });

  it('distinguishes unanswered from answered', () => {
    expect(giuspAnswered(emptyGiuspAnswers())).toBe(false);
    expect(giuspAnswered(answers({ gas_supply_isolated: 'No' }))).toBe(true);
  });

  it('derives handover from who was present', () => {
    const present = giuspAnswersToGwnFields(answers({ customer_present: 'Yes', customer_informed: 'Yes' }));
    expect(present.customer_present).toBe(true);
    expect(present.customer_informed).toBe(true);
    expect(present.notice_left_on_premises).toBe(false);

    const absent = giuspAnswersToGwnFields(
      answers({ customer_present: 'No', customer_informed: 'Yes', notice_left_on_premises: 'Yes' }),
    );
    expect(absent.customer_present).toBe(false);
    // "Informed" cannot be true for someone who was not there.
    expect(absent.customer_informed).toBe(false);
    expect(absent.notice_left_on_premises).toBe(true);
  });

  it('a fully answered ID situation satisfies the issue gate', () => {
    const fields: GasWarningNoticeFields = {
      property_address: '9 Property Road',
      customer_name: 'A Landlord',
      appliance_location: 'Kitchen',
      appliance_type: 'Boiler',
      classification: 'IMMEDIATELY_DANGEROUS',
      unsafe_situation_description: 'Cracked heat exchanger',
      actions_taken: 'Capped and labelled',
      engineer_name: 'Alex Engineer',
      gas_safe_number: '123456',
      issued_at: '2026-07-28T00:00:00Z',
      record_id: 'R',
      engineer_signature: 'https://example.test/signatures/engineer.png',
      ...giuspAnswersToGwnFields(
        answers({
          customer_present: 'Yes',
          customer_informed: 'Yes',
          gas_supply_isolated: 'Yes',
          danger_label_fitted: 'Yes',
          riddor_reported: 'Yes',
        }),
      ),
    };

    expect(validateGwnForIssue(fields)).toEqual([]);
  });

  it('an unanswered ID situation is blocked, not silently passed', () => {
    const fields: GasWarningNoticeFields = {
      property_address: '9 Property Road',
      customer_name: 'A Landlord',
      appliance_location: 'Kitchen',
      appliance_type: 'Boiler',
      classification: 'IMMEDIATELY_DANGEROUS',
      unsafe_situation_description: 'Cracked heat exchanger',
      actions_taken: 'Capped',
      engineer_name: 'Alex Engineer',
      gas_safe_number: '123456',
      issued_at: '2026-07-28T00:00:00Z',
      record_id: 'R',
      ...giuspAnswersToGwnFields(emptyGiuspAnswers()),
    };

    const errors = validateGwnForIssue(fields).join(' ');
    expect(errors).toMatch(/Do Not Use label/i);
    expect(errors).toMatch(/RIDDOR/i);
  });
});
