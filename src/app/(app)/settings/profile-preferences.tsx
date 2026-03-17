'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { updateProfileBasics } from '@/server/profile';

type ProfilePreferencesProps = {
  initialName?: string;
  initialCompanyName?: string;
  initialCompanyAddressLine1?: string;
  initialCompanyAddressLine2?: string;
  initialCompanyAddressLine3?: string;
  initialCompanyPostcode?: string;
  initialCompanyPhone?: string;
  initialEngineerId?: string;
  initialGasSafeNumber?: string;
};

export function ProfilePreferences({
  initialName = '',
  initialCompanyName = '',
  initialCompanyAddressLine1 = '',
  initialCompanyAddressLine2 = '',
  initialCompanyAddressLine3 = '',
  initialCompanyPostcode = '',
  initialCompanyPhone = '',
  initialEngineerId = '',
  initialGasSafeNumber = '',
}: ProfilePreferencesProps) {
  const [name, setName] = useState(initialName);
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [companyAddressLine1, setCompanyAddressLine1] = useState(initialCompanyAddressLine1);
  const [companyAddressLine2, setCompanyAddressLine2] = useState(initialCompanyAddressLine2);
  const [companyAddressLine3, setCompanyAddressLine3] = useState(initialCompanyAddressLine3);
  const [companyPostcode, setCompanyPostcode] = useState(initialCompanyPostcode);
  const [companyPhone, setCompanyPhone] = useState(initialCompanyPhone);
  const [gasSafeNumber, setGasSafeNumber] = useState(initialGasSafeNumber);
  const [engineerId, setEngineerId] = useState(initialEngineerId);
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useToast();

  const handleSave = () => {
    const missing = [
      { key: 'Name', value: name },
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
        await updateProfileBasics({
          default_engineer_name: name.trim() || undefined,
          company_name: companyName.trim() || undefined,
          company_address: companyAddressLine1.trim() || undefined,
          company_address_line2: companyAddressLine2.trim() || undefined,
          company_town: companyAddressLine3.trim() || undefined,
          company_postcode: companyPostcode.trim() || undefined,
          company_phone: companyPhone.trim() || undefined,
          gas_safe_number: gasSafeNumber.trim() || undefined,
          default_engineer_id: engineerId.trim() || undefined,
        });
        pushToast({ title: 'Settings updated', description: 'Company / installer details saved.', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Unable to save settings',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const dirty =
    name !== initialName ||
    companyName !== initialCompanyName ||
    companyAddressLine1 !== initialCompanyAddressLine1 ||
    companyAddressLine2 !== initialCompanyAddressLine2 ||
    companyAddressLine3 !== initialCompanyAddressLine3 ||
    companyPostcode !== initialCompanyPostcode ||
    companyPhone !== initialCompanyPhone ||
    gasSafeNumber !== initialGasSafeNumber ||
    engineerId !== initialEngineerId;

  return (
    <section className="rounded-3xl border border-white/20 bg-white/80 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Account details</p>
          <h2 className="text-lg font-semibold text-muted">Company / installer</h2>
          <p className="text-sm text-muted-foreground/70">
            These values prefill PDF company / installer sections.
          </p>
        </div>
        <Button onClick={handleSave} disabled={isPending || !dirty}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-semibold text-muted">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
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
    </section>
  );
}
