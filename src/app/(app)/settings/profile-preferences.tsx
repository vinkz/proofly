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

const RATE_DISPLAY_LABELS: Record<StandardRateKey, string> = {
  cp12: 'CP12',
  boiler_service: 'Boiler',
  cp12_boiler_service: 'Both',
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

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

function displayPostcode(v: string): string {
  const c = v.replace(/\s/g, '').toUpperCase();
  return c.length >= 5 ? c.slice(0, -3) + ' ' + c.slice(-3) : c;
}

function displaySortCode(v: string): string {
  const c = v.replace(/\D/g, '');
  return c.length === 6 ? `${c.slice(0, 2)}-${c.slice(2, 4)}-${c.slice(4, 6)}` : v;
}

const inputClass =
  'mt-1 h-[38px] w-full rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-[11px] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-action)] disabled:opacity-50';

const labelClass = 'text-[11px] font-medium tracking-[0.5px] text-[var(--color-text-tertiary)]';

const eyebrowClass = 'text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]';

const cardTitleClass = 'text-[15px] font-medium text-[var(--color-text-primary)]';

const cardClass = 'overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]';

const cardHeaderClass = 'flex items-center justify-between border-b-[0.5px] border-[var(--color-border-tertiary)] px-4 py-[14px]';

const cardBodyClass = 'flex flex-col gap-[12px] p-4';

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

  const saveButtonLabel = isPending ? 'Saving…' : dirty ? 'Save' : 'Saved';
  const saveButtonClass = `text-[12px] font-medium px-[14px] py-[5px] rounded-full border-[0.5px] border-[var(--color-border-secondary)] text-[var(--color-text-secondary)] bg-transparent disabled:opacity-40 transition-colors hover:border-[var(--color-text-tertiary)]`;

  if (mode === 'onboarding') {
    return (
      <div className="flex flex-col gap-[12px]">
        <div className={cardClass}>
          <div className={cardBodyClass}>
            <div className="grid grid-cols-2 gap-[10px]">
              <div>
                <label className={labelClass}>Full name</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} disabled={isPending} />
              </div>
              <div>
                <label className={labelClass}>Date of birth</label>
                <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputClass} disabled={isPending} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Profession</label>
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
                className="mt-1 h-[38px] rounded-[8px] text-[13px]"
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
                <label className={labelClass}>Profession (specify)</label>
                <input value={profession} onChange={(e) => setProfession(e.target.value)} className={inputClass} disabled={isPending} />
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-[10px]">
              <div>
                <label className={labelClass}>
                  Gas Safe reg no. <span className="ml-1 text-[var(--color-text-tertiary)] opacity-60">· 6 digits</span>
                </label>
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
                <label className={labelClass}>
                  ID card no. <span className="ml-1 text-[var(--color-text-tertiary)] opacity-60">· 7 digits</span>
                </label>
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
            <div className="grid grid-cols-2 gap-[10px]">
              <div>
                <label className={labelClass}>Engineer name</label>
                <input value={toTitleCase(engineerName)} onChange={(e) => setEngineerName(e.target.value)} className={inputClass} disabled={isPending} placeholder="As it appears on certificates" />
              </div>
              <div>
                <label className={labelClass}>Company name</label>
                <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} disabled={isPending} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Address line 1</label>
              <input value={companyAddressLine1} onChange={(e) => setCompanyAddressLine1(e.target.value)} className={inputClass} disabled={isPending} />
            </div>
            <div className="grid grid-cols-2 gap-[10px]">
              <div>
                <label className={labelClass}>Town / city</label>
                <input value={companyAddressLine3} onChange={(e) => setCompanyAddressLine3(e.target.value)} className={inputClass} disabled={isPending} />
              </div>
              <div>
                <label className={labelClass}>Postcode</label>
                <input value={displayPostcode(companyPostcode)} onChange={(e) => setCompanyPostcode(e.target.value)} className={inputClass} disabled={isPending} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} className={inputClass} disabled={isPending} type="tel" />
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !dirty}
            className="rounded-full bg-[#111] px-[20px] py-[10px] text-[13px] font-medium text-white disabled:opacity-40"
          >
            {isPending ? 'Saving…' : 'Complete setup'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Card 1: Personal & engineer details */}
      <section className={cardClass}>
        <div className={cardHeaderClass}>
          <div>
            <p className={eyebrowClass}>Profile</p>
            <h2 className={cardTitleClass}>Personal & engineer details</h2>
          </div>
          <button type="button" onClick={handleSave} disabled={isPending || !dirty} className={saveButtonClass}>
            {saveButtonLabel}
          </button>
        </div>
        <div className={cardBodyClass}>
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className={labelClass}>Full name</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} disabled={isPending} />
            </div>
            <div>
              <label className={labelClass}>Date of birth</label>
              <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputClass} disabled={isPending} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className={labelClass}>Profession</label>
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
                className="mt-1 h-[38px] rounded-[8px] text-[13px]"
                disabled={isPending}
              >
                <option value="">Select profession</option>
                {TRADE_TYPES.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
                <option value="Other">Other</option>
              </Select>
            </div>
            <div>
              <label className={labelClass}>Engineer name</label>
              <input value={toTitleCase(engineerName)} onChange={(e) => setEngineerName(e.target.value)} className={inputClass} disabled={isPending} placeholder="As on certificates" />
            </div>
          </div>
          {professionChoice === 'Other' ? (
            <div>
              <label className={labelClass}>Profession (specify)</label>
              <input value={profession} onChange={(e) => setProfession(e.target.value)} className={inputClass} disabled={isPending} />
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className={labelClass}>
                Gas Safe reg no. <span className="ml-1 opacity-60">· 6 digits</span>
              </label>
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
              <label className={labelClass}>
                ID card no. <span className="ml-1 opacity-60">· 7 digits</span>
              </label>
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
        </div>
      </section>

      {/* Card 2: Company details */}
      <section className={cardClass}>
        <div className={cardHeaderClass}>
          <div>
            <p className={eyebrowClass}>Company</p>
            <h2 className={cardTitleClass}>Company details</h2>
          </div>
          <button type="button" onClick={handleSave} disabled={isPending || !dirty} className={saveButtonClass}>
            {saveButtonLabel}
          </button>
        </div>
        <div className={cardBodyClass}>
          <div>
            <label className={labelClass}>Company name</label>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} disabled={isPending} />
          </div>
          <div>
            <label className={labelClass}>Address line 1</label>
            <input value={companyAddressLine1} onChange={(e) => setCompanyAddressLine1(e.target.value)} className={inputClass} disabled={isPending} />
          </div>
          <div>
            <label className={labelClass}>Address line 2</label>
            <input value={companyAddressLine2} onChange={(e) => setCompanyAddressLine2(e.target.value)} className={inputClass} disabled={isPending} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className={labelClass}>Town / city</label>
              <input value={companyAddressLine3} onChange={(e) => setCompanyAddressLine3(e.target.value)} className={inputClass} disabled={isPending} />
            </div>
            <div>
              <label className={labelClass}>Postcode</label>
              <input value={displayPostcode(companyPostcode)} onChange={(e) => setCompanyPostcode(e.target.value)} className={inputClass} disabled={isPending} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} className={inputClass} disabled={isPending} type="tel" />
          </div>
        </div>
      </section>

      {/* Card 3: Bank transfer & rates */}
      <section className={cardClass}>
        <div className={cardHeaderClass}>
          <div>
            <p className={eyebrowClass}>Invoices</p>
            <h2 className={cardTitleClass}>Bank transfer & rates</h2>
          </div>
          <button type="button" onClick={handleSave} disabled={isPending || !dirty} className={saveButtonClass}>
            {saveButtonLabel}
          </button>
        </div>
        <div className={cardBodyClass}>
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className={labelClass}>Bank name</label>
              <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputClass} disabled={isPending} />
            </div>
            <div>
              <label className={labelClass}>Account name</label>
              <input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} className={inputClass} disabled={isPending} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className={labelClass}>Sort code</label>
              <input value={displaySortCode(bankSortCode)} onChange={(e) => setBankSortCode(e.target.value)} className={inputClass} disabled={isPending} placeholder="20-02-02" />
            </div>
            <div>
              <label className={labelClass}>Account number</label>
              <input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} className={inputClass} disabled={isPending} placeholder="12345678" />
            </div>
          </div>

          <div className="h-[0.5px] bg-[var(--color-border-tertiary)]" />

          <div>
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Standard rates</p>
            <p className="mt-0.5 text-[12px] text-[var(--color-text-secondary)]">
              Pre-fill invoice line items after a certificate is issued.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-[8px]">
            {STANDARD_RATE_KEYS.map((key) => (
              <div key={key}>
                <label className={labelClass}>{RATE_DISPLAY_LABELS[key]}</label>
                <div className="mt-1 flex items-center overflow-hidden rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]">
                  <span className="border-r-[0.5px] border-[var(--color-border-secondary)] px-[8px] text-[13px] text-[var(--color-text-tertiary)]">£</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={standardRates[key]}
                    onChange={(event) =>
                      setStandardRates((current) => ({ ...current, [key]: event.target.value }))
                    }
                    className="min-w-0 flex-1 bg-transparent p-[9px_8px] text-[13px] text-[var(--color-text-primary)] outline-none disabled:opacity-50"
                    disabled={isPending}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
