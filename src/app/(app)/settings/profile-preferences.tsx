'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { TRADE_TYPES } from '@/lib/profile-options';
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
};

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
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useToast();

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
      { key: 'Gas Safe Reg', value: gasSafeNumber },
      { key: 'ID Card No.', value: engineerId },
    ].filter((item) => !item.value || !item.value.trim());
    if (missing.length) {
      pushToast({
        title: 'Required fields missing',
        description: `Fill: ${missing.map((m) => m.key).join(', ')}`,
        variant: 'error',
      });
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
              : 'Company, installer, and invoice payment details saved.',
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
    bankAccountNumber !== initialBankAccountNumber;

  const saveLabel = isPending
    ? 'Saving…'
    : mode === 'onboarding'
      ? 'Complete setup'
      : dirty
        ? 'Save changes'
        : 'Saved';

  return (
    <section className="rounded-3xl border border-white/20 bg-white/80 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--accent)]">
            {mode === 'onboarding' ? 'Complete profile' : 'Account details'}
          </p>
          <h2 className="text-lg font-semibold text-muted">
            {mode === 'onboarding' ? 'Finish your account setup' : 'Company / installer'}
          </h2>
          <p className="text-sm text-muted-foreground/70">
            {mode === 'onboarding'
              ? 'Save your required profile, company, and engineer details before using the app.'
              : 'These values prefill PDF company / installer sections.'}
          </p>
        </div>
        {mode === 'onboarding' ? (
          <Button onClick={handleSave} disabled={isPending || !dirty}>
            {saveLabel}
          </Button>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-semibold text-muted">
          Full name
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm"
            disabled={isPending}
          />
        </label>
        <label className="block text-sm font-semibold text-muted">
          Date of birth
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm"
            disabled={isPending}
          />
        </label>
        <label className="block text-sm font-semibold text-muted">
          Profession
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
            className="mt-2"
            disabled={isPending}
          >
            <option value="">Select profession</option>
            {TRADE_TYPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            <option value="Other">Other</option>
          </Select>
        </label>
        {professionChoice === 'Other' ? (
          <label className="block text-sm font-semibold text-muted">
            Profession (manual)
            <input
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm"
              disabled={isPending}
            />
          </label>
        ) : (
          <div />
        )}
        <label className="block text-sm font-semibold text-muted">
          Engineer name
          <input
            value={engineerName}
            onChange={(e) => setEngineerName(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm"
            disabled={isPending}
          />
        </label>
        <label className="block text-sm font-semibold text-muted">
          Company
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm"
            disabled={isPending}
          />
        </label>
        <label className="block text-sm font-semibold text-muted md:col-span-2">
          Address line 1
          <input
            value={companyAddressLine1}
            onChange={(e) => setCompanyAddressLine1(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm"
            disabled={isPending}
          />
        </label>
        <label className="block text-sm font-semibold text-muted md:col-span-2">
          Address line 2
          <input
            value={companyAddressLine2}
            onChange={(e) => setCompanyAddressLine2(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm"
            disabled={isPending}
          />
        </label>
        <label className="block text-sm font-semibold text-muted md:col-span-2">
          Address line 3
          <input
            value={companyAddressLine3}
            onChange={(e) => setCompanyAddressLine3(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm"
            disabled={isPending}
          />
        </label>
        <label className="block text-sm font-semibold text-muted">
          Postcode
          <input
            value={companyPostcode}
            onChange={(e) => setCompanyPostcode(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm"
            disabled={isPending}
          />
        </label>
        <label className="block text-sm font-semibold text-muted">
          Tel No.
          <input
            value={companyPhone}
            onChange={(e) => setCompanyPhone(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm"
            disabled={isPending}
          />
        </label>
        <label className="block text-sm font-semibold text-muted">
          Gas Safe Reg
          <input
            value={gasSafeNumber}
            onChange={(e) => setGasSafeNumber(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm"
            disabled={isPending}
          />
        </label>
        <label className="block text-sm font-semibold text-muted">
          ID Card No.
          <input
            value={engineerId}
            onChange={(e) => setEngineerId(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm"
            disabled={isPending}
          />
        </label>
      </div>

      <div className="mt-8 border-t border-slate-200/70 pt-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Invoices</p>
          <h3 className="text-base font-semibold text-muted">Bank transfer details</h3>
          <p className="text-sm text-muted-foreground/70">
            These details appear in the payment section on invoice PDFs.
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-semibold text-muted">
            Bank name
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm"
              disabled={isPending}
            />
          </label>
          <label className="block text-sm font-semibold text-muted">
            Account name
            <input
              value={bankAccountName}
              onChange={(e) => setBankAccountName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm"
              disabled={isPending}
            />
          </label>
          <label className="block text-sm font-semibold text-muted">
            Sort code
            <input
              value={bankSortCode}
              onChange={(e) => setBankSortCode(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm"
              disabled={isPending}
              placeholder="12-34-56"
            />
          </label>
          <label className="block text-sm font-semibold text-muted">
            Account number
            <input
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm"
              disabled={isPending}
              placeholder="12345678"
            />
          </label>
        </div>
      </div>

      {mode === 'settings' ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <div className="pointer-events-auto mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl border border-white/30 bg-white/95 p-3 shadow-2xl backdrop-blur">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-muted">
                {dirty ? 'Unsaved settings' : 'Settings saved'}
              </p>
              <p className="text-xs text-muted-foreground/70">
                {dirty
                  ? 'Company, installer, and invoice details have changes.'
                  : 'Make a change to enable saving.'}
              </p>
            </div>
            <Button onClick={handleSave} disabled={isPending || !dirty} className="shrink-0 rounded-full">
              {saveLabel}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
