'use client';

/**
 * The GIUSP questions a Gas Warning Notice needs and a CP12 does not.
 *
 * Shared by the free tool and the paid wizard so the two ask the same things in
 * the same words. The answers are typed as GiuspAnswers, which is also what the
 * server maps onto the notice — question set, wording and meaning all come from
 * one place.
 *
 * Shown only when an appliance is At Risk or Immediately Dangerous. The ID
 * branch carries real duties — GIUSP requires the Danger Do Not Use label and
 * either isolation or a recorded refusal, and RIDDOR Reg 6(2) requires an HSE
 * report within 14 days — so those questions are asked rather than assumed.
 */
import { EnumChips } from '@/components/wizard/inputs/enum-chips';
import { Input } from '@/components/ui/input';
import type { GiuspAnswerKey, GiuspAnswers } from '@/lib/cp12/giusp';

const YES_NO = [
  { label: 'Yes', value: 'Yes' },
  { label: 'No', value: 'No' },
];

export function UnsafeSituationFields({
  classification,
  answers,
  onChange,
}: {
  classification: 'IMMEDIATELY_DANGEROUS' | 'AT_RISK';
  answers: GiuspAnswers;
  onChange: (key: GiuspAnswerKey, value: string) => void;
}) {
  const isId = classification === 'IMMEDIATELY_DANGEROUS';
  const present = answers.customer_present === 'Yes';
  const notPresent = answers.customer_present === 'No';

  const chips = (key: GiuspAnswerKey, label: string) => (
    <EnumChips
      label={label}
      value={answers[key] ?? ''}
      options={YES_NO}
      onChange={(value) => onChange(key, value)}
    />
  );

  return (
    <div className="rounded-[12px] border-[0.5px] border-[var(--color-red)] bg-[var(--color-background-secondary)] p-4">
      <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">
        {isId ? 'Immediately Dangerous' : 'At Risk'} — a warning notice will be issued with the
        certificate
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-tertiary)]">
        {isId
          ? 'GIUSP requires a Danger — Do Not Use label and either isolation or a recorded refusal. The fitting must also be reported to HSE under RIDDOR within 14 days.'
          : 'Turn off with permission and issue a warning notice. A Danger — Do Not Use label is not applied to a pure At Risk situation.'}
      </p>

      <div className="mt-4 grid gap-4">
        {chips('customer_present', 'Was the responsible person present?')}
        {present ? chips('customer_informed', 'Responsible person informed of the danger') : null}
        {notPresent ? chips('notice_left_on_premises', 'Notice left on the premises') : null}

        {chips('gas_supply_isolated', 'Gas supply isolated')}
        {answers.gas_supply_isolated === 'No'
          ? chips('customer_refused_isolation', 'Responsible person refused isolation')
          : null}
        {chips('appliance_capped_off', 'Appliance capped off')}
        {isId ? chips('danger_label_fitted', 'Danger — Do Not Use label fitted') : null}
        {chips('emergency_services_contacted', 'Emergency service provider contacted')}

        {isId ? (
          <>
            {chips('riddor_reported', 'Reported to HSE under RIDDOR')}
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-[var(--color-text-secondary)]">
                RIDDOR or emergency reference (optional)
              </span>
              <Input
                value={answers.riddor_reference ?? ''}
                onChange={(e) => onChange('riddor_reference', e.target.value)}
              />
              <span className="mt-1 block text-[12px] text-[var(--color-text-tertiary)]">
                Either the report flag above or a reference here satisfies the record.
              </span>
            </label>
          </>
        ) : null}
      </div>
    </div>
  );
}
