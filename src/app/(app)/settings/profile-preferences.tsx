'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  ENGINEER_ID_CARD_NUMBER_MESSAGE,
  ENGINEER_ID_CARD_NUMBER_PATTERN,
  GAS_SAFE_NUMBER_MESSAGE,
  GAS_SAFE_NUMBER_PATTERN,
} from '@/lib/onboarding-profile';
import { TRADE_TYPES } from '@/lib/profile-options';
import {
  STANDARD_RATE_KEYS,
  STANDARD_RATE_LABELS,
  type StandardRateKey,
  type StandardRates,
} from '@/lib/standard-rates';
import { updateProfileBasics } from '@/server/profile';

type ProfilePreferencesProps = {
  mode?: 'settings' | 'onboarding';
  initialFullName?: string;
  initialDateOfBirth?: string;
  initialProfession?: string;
  initialEngineerName?: string;
  initialCompanyName?: string;
  initialCompanyAddressLine1?: string;
  initialCompanyAddressLine2?: string;
  initialCompanyAddressLine3?: string;
  initialCompanyPostcode?: string;
  initialCompanyPhone?: string;
  initialEngineerId?: string;
  initialGasSafeNumber?: string;
  initialBankName?: string;
  initialBankAccountName?: string;
  initialBankSortCode?: string;
  initialBankAccountNumber?: string;
  initialStandardRates?: StandardRates;
};

const buildRateInputState = (rates: StandardRates): Record<StandardRateKey, string> =>
  STANDARD_RATE_KEYS.reduce<Record<StandardRateKey, string>>((state, key) => {
    state[key] = rates[key] ? String(rates[key]) : '';
    return state;
  }, {} as Record<StandardRateKey, string>);

const parseRateInputState = (rates: Record<StandardRateKey, string>): StandardRates =>
  STANDARD_RATE_KEYS.reduce<StandardRates>((parsed, key) => {
    const amount = Number(rates[key]);
    if (Number.isFinite(amount) && amount > 0) {
      parsed[key] = amount;
    }
    return parsed;
  }, {});

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
        {children}
      </span>
      {hint ? <span className="ml-1.5 text-[11px] text-[var(--color-text-tertiary)]">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  'mt-1.5 h-[38px] w-full rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-action)] disabled:opacity-50';

export function ProfilePreferences({
  mode = 'settings',
  initialFullName = '',
  initialDateOfBirth = '',
  initialProfession = '',
  initialEngineerName = '',
  initialCompanyName = '',
  initialCompanyAddressLine1 = '',
  initialCompanyAddressLine2 = '',
  initialCompanyAddressLine3 = '',
  initialCompanyPostcode = '',
  initialCompanyPhone = '',
  initialEngineerId = '',
  initialGasSafeNumber = '',
  initialBankName = '',
  initialBankAccountName = '',
  initialBankSortCode = '',
  initialBankAccountNumber = '',
  initialStandardRates = {},
}: ProfilePreferencesProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName);
  const [dateOfBirth, setDateOfBirth] = useState(initialDateOfBirth);
  const [profession, setProfession] = useState(initialProfession);
  const [professionChoice, setProfessionChoice] = useState(
    initialProfession && TRADE_TYPES.includes(initialProfession as (typeof TRADE_TYPES)[number]) ? initialProfession : initialProfession ? 'Other' : '',
  );
  const [engineerName, setEngineerName] = useState(initialEngineerName);
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [companyAddressLine1, setCompanyAddressLine1] = useState(initialCompanyAddressLine1);
  const [companyAddressLine2, setCompanyAddressLine2] = useState(initialCompanyAddressLine2);
  const [companyAddressLine3, setCompanyAddressLine3] = useState(initialCompanyAddressLine3);
  const [companyPostcode, setCompanyPostcode] = useState(initialCompanyPostcode);
  const [companyPhone, setCompanyPhone] = useState(initialCompanyPhone);
  const [gasSafeNumber, setGasSafeNumber] = useState(initialGasSafeNumber);
  const [engineerId, setEngineerId] = useState(initialEngineerId);
  const [bankName, setBankName] = useState(initialBankName);
  const [bankAccountName, setBankAccountName] = useState(initialBankAccountName);
  const [bankSortCode, setBankSortCode] = useState(initialBankSortCode);
  const [bankAccountNumber, setBankAccountNumber] = useState(initialBankAccountNumber);
  const [standardRates, setStandardRates] = useState(() => buildRateInputState(initialStandardRates));
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useToast();
  const initialRateInputs = buildRateInputState(initialStandardRates);

  const handleSave = () => {
    const missing = [
      { key: 'Full name', value: fullName },
      { key: 'Date of birth', value: dateOfBirth },
      { key: 'Profession', value: profession },
      { key: 'Engineer name', value: engineerName },
      { key: 'Company', value: companyName },
      { key: 'Address line 1', value: companyAddressLine1 },
      { key: 'Postcode', value: companyPostcode },
      { key: 'Tel No.', value: companyPhone },
      { key: 'Gas Safe registration number', value: gasSafeNumber },
      { key: 'Engineer ID card number', value: engineerId },
    ].filter((item) => !item.value || !item.value.trim());
    if (missing.length) {
      pushToast({
        title: 'Required fields missing',
        description: `Fill: ${missing.map((m) => m.key).join(', ')}`,
        variant: 'error',
      });
      return;
    }

    if (!GAS_SAFE_NUMBER_PATTERN.test(gasSafeNumber.trim())) {
      pushToast({ title: 'Check Gas Safe number', description: GAS_SAFE_NUMBER_MESSAGE, variant: 'error' });
      return;
    }

    if (!ENGINEER_ID_CARD_NUMBER_PATTERN.test(engineerId.trim())) {
      pushToast({ title: 'Check ID card number', description: ENGINEER_ID_CARD_NUMBER_MESSAGE, variant: 'error' });
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateProfileBasics({
          full_name: fullName.trim() || undefined,
          date_of_birth: dateOfBirth.trim() || undefined,
          profession: profession.trim() || undefined,
          default_engineer_name: engineerName.trim() || undefined,
          company_name: companyName.trim() || undefined,
          company_address: companyAddressLine1.trim() || undefined,
          company_address_line2: companyAddressLine2.trim() || undefined,
          company_town: companyAddressLine3.trim() || undefined,
          company_postcode: companyPostcode.trim() || undefined,
          company_phone: companyPhone.trim() || undefined,
          gas_safe_number: gasSafeNumber.trim() || undefined,
          default_engineer_id: engineerId.trim() || undefined,
          bank_name: bankName.trim() || undefined,
          bank_account_name: bankAccountName.trim() || undefined,
          bank_sort_code: bankSortCode.trim() || undefined,
          bank_account_number: bankAccountNumber.trim() || undefined,
          standard_rates: parseRateInputState(standardRates),
        });

        if (!result.profileComplete) {
          pushToast({
            title: 'Profile still incomplete',
            description: `Missing after save: ${result.missingFields.join(', ')}`,
            variant: 'error',
          });
          router.refresh();
          return;
        }

        pushToast({
          title: mode === 'onboarding' ? 'Profile completed' : 'Settings updated',
          description:
            mode === 'onboarding'
              ? 'Your account is ready to use.'
              : 'Company, installer, and invoice details saved.',
          variant: 'success',
        });
        if (mode === 'onboarding' || mode === 'settings') {
          router.push('/dashboard');
          router.refresh();
        }
      } catch (error) {
        pushToast({
          title: mode === 'onboarding' ? 'Unable to complete setup' : 'Unable to save settings',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const dirty =
    fullName !== initialFullName ||
    dateOfBirth !== initialDateOfBirth ||
    profession !== initialProfession ||
    engineerName !== initialEngineerName ||
    companyName !== initialCompanyName ||
    companyAddressLine1 !== initialCompanyAddressLine1 ||
    companyAddressLine2 !== initialCompanyAddressLine2 ||
    companyAddressLine3 !== initialCompanyAddressLine3 ||
    companyPostcode !== initialCompanyPostcode ||
    companyPhone !== initialCompanyPhone ||
    gasSafeNumber !== initialGasSafeNumber ||
    engineerId !== initialEngineerId ||
    bankName !== initialBankName ||
    bankAccountName !== initialBankAccountName ||
    bankSortCode !== initialBankSortCode ||
    bankAccountNumber !== initialBankAccountNumber ||
    STANDARD_RATE_KEYS.some((key) => standardRates[key] !== initialRateInputs[key]);

  const saveLabel = isPending ? 'Saving…' : mode === 'onboarding' ? 'Complete setup' : dirty ? 'Save changes' : 'Saved';

  return (
    <>
      {/* Personal details */}
      <section className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Personal details</p>
        <h2 className="mt-1 text-[16px] font-semibold text-[var(--color-text-primary)]">
          {mode === 'onboarding' ? 'Complete your profile' : 'Personal & engineer details'}
        </h2>
        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
          {mode === 'onboarding'
            ? 'Required before creating any certificate.'
            : 'These values populate the installer section of certificate PDFs.'}
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>Full name</FieldLabel>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} disabled={isPending} />
          </div>
          <div>
            <FieldLabel>Date of birth</FieldLabel>
            <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputClass} disabled={isPending} />
          </div>
          <div>
            <FieldLabel>Profession</FieldLabel>
            <Select
              value={professionChoice}
              onChange={(event) => {
                const value = event.target.value;
                setProfessionChoice(value);
                if (value && value !== 'Other') {
                  setProfession(value);
                } else if (value !== 'Other') {
                  setProfession('');
                }
              }}
              className="mt-1.5 h-[38px] rounded-[10px] text-[13px]"
              disabled={isPending}
            >
              <option value="">Select profession</option>
              {TRADE_TYPES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
              <option value="Other">Other</option>
            </Select>
          </div>
          {professionChoice === 'Other' ? (
            <div>
              <FieldLabel>Profession (specify)</FieldLabel>
              <input value={profession} onChange={(e) => setProfession(e.target.value)} className={inputClass} disabled={isPending} />
            </div>
          ) : (
            <div />
          )}
          <div>
            <FieldLabel>Engineer name</FieldLabel>
            <input value={engineerName} onChange={(e) => setEngineerName(e.target.value)} className={inputClass} disabled={isPending} placeholder="As it appears on certificates" />
          </div>
          <div>
            <FieldLabel hint="6 digits">Gas Safe registration no.</FieldLabel>
            <input
              value={gasSafeNumber}
              onChange={(e) => setGasSafeNumber(e.target.value)}
              className={inputClass}
              disabled={isPending}
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]{6}"
              placeholder="123456"
            />
          </div>
          <div>
            <FieldLabel hint="7 digits">Engineer ID card no.</FieldLabel>
            <input
              value={engineerId}
              onChange={(e) => setEngineerId(e.target.value)}
              className={inputClass}
              disabled={isPending}
              inputMode="numeric"
              maxLength={7}
              pattern="[0-9]{7}"
              placeholder="1234567"
            />
          </div>
        </div>
      </section>

      {/* Company details */}
      <section className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Company</p>
        <h2 className="mt-1 text-[16px] font-semibold text-[var(--color-text-primary)]">Company details</h2>
        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">Appears in the company section on certificate and invoice PDFs.</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldLabel>Company name</FieldLabel>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} disabled={isPending} />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>Address line 1</FieldLabel>
            <input value={companyAddressLine1} onChange={(e) => setCompanyAddressLine1(e.target.value)} className={inputClass} disabled={isPending} />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>Address line 2</FieldLabel>
            <input value={companyAddressLine2} onChange={(e) => setCompanyAddressLine2(e.target.value)} className={inputClass} disabled={isPending} />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>Town / City</FieldLabel>
            <input value={companyAddressLine3} onChange={(e) => setCompanyAddressLine3(e.target.value)} className={inputClass} disabled={isPending} />
          </div>
          <div>
            <FieldLabel>Postcode</FieldLabel>
            <input value={companyPostcode} onChange={(e) => setCompanyPostcode(e.target.value)} className={inputClass} disabled={isPending} />
          </div>
          <div>
            <FieldLabel>Phone</FieldLabel>
            <input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} className={inputClass} disabled={isPending} type="tel" />
          </div>
        </div>
      </section>

      {/* Invoices */}
      <section className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Invoices</p>
        <h2 className="mt-1 text-[16px] font-semibold text-[var(--color-text-primary)]">Bank transfer &amp; rates</h2>
        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">Bank details appear on invoice PDFs. Rates pre-fill draft invoices after a certificate is issued.</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>Bank name</FieldLabel>
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputClass} disabled={isPending} />
          </div>
          <div>
            <FieldLabel>Account name</FieldLabel>
            <input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} className={inputClass} disabled={isPending} />
          </div>
          <div>
            <FieldLabel>Sort code</FieldLabel>
            <input value={bankSortCode} onChange={(e) => setBankSortCode(e.target.value)} className={inputClass} disabled={isPending} placeholder="12-34-56" />
          </div>
          <div>
            <FieldLabel>Account number</FieldLabel>
            <input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} className={inputClass} disabled={isPending} placeholder="12345678" />
          </div>
        </div>

        <div className="mt-5 rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] p-4">
          <p className="text-[12px] font-medium text-[var(--color-text-secondary)]">Standard rates</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
            Optional. Pre-fills invoice line items after a certificate is issued.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {STANDARD_RATE_KEYS.map((key) => (
              <div key={key}>
                <FieldLabel>{STANDARD_RATE_LABELS[key]}</FieldLabel>
                <div className="mt-1.5 flex h-[38px] overflow-hidden rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]">
                  <span className="grid place-items-center border-r-[0.5px] border-[var(--color-border-secondary)] px-2.5 text-[13px] text-[var(--color-text-tertiary)]">£</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={standardRates[key]}
                    onChange={(event) =>
                      setStandardRates((current) => ({ ...current, [key]: event.target.value }))
                    }
                    className="w-full bg-transparent px-3 text-[13px] text-[var(--color-text-primary)] outline-none disabled:opacity-50"
                    disabled={isPending}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sticky save footer (settings mode) */}
      {mode === 'settings' ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <div className="pointer-events-auto mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]/95 p-3 shadow-lg backdrop-blur-sm">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                {dirty ? 'Unsaved changes' : 'All saved'}
              </p>
              <p className="text-[11px] text-[var(--color-text-tertiary)]">
                {dirty ? 'Personal, company, and invoice details' : 'Make a change to enable saving.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !dirty}
              className="h-[38px] shrink-0 rounded-[10px] bg-[#111] px-5 text-[13px] font-medium text-white disabled:opacity-40"
            >
              {saveLabel}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !dirty}
            className="h-[40px] rounded-[10px] bg-[#111] px-6 text-[13px] font-medium text-white disabled:opacity-40"
          >
            {saveLabel}
          </button>
        </div>
      )}
    </>
  );
}
