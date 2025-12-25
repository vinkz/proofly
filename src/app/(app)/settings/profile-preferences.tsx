'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { CERTIFICATIONS } from '@/lib/profile-options';
import { updateCertifications, markOnboardingComplete, updateProfileBasics } from '@/server/profile';

export function ProfilePreferences({
  initialCerts,
  initialName = '',
  initialDob = '',
  initialProfession = '',
  initialCompanyName = '',
  initialEngineerName = '',
  initialEngineerId = '',
  initialGasSafeNumber = '',
}: {
  initialCerts: string[];
  initialName?: string;
  initialDob?: string;
  initialProfession?: string;
  initialCompanyName?: string;
  initialEngineerName?: string;
  initialEngineerId?: string;
  initialGasSafeNumber?: string;
}) {
  const [certs, setCerts] = useState<string[]>(initialCerts);
  const [fullName, setFullName] = useState(initialName);
  const [dob, setDob] = useState(initialDob);
  const [profession, setProfession] = useState(initialProfession);
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [engineerName, setEngineerName] = useState(initialEngineerName);
  const [engineerId, setEngineerId] = useState(initialEngineerId);
  const [gasSafeNumber, setGasSafeNumber] = useState(initialGasSafeNumber);
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useToast();

  const toggle = (value: string, setter: (val: string[]) => void, current: string[]) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateProfileBasics({
          full_name: fullName.trim() || undefined,
          date_of_birth: dob.trim() || undefined,
          profession: profession.trim() || undefined,
          company_name: companyName.trim() || undefined,
          default_engineer_name: engineerName.trim() || undefined,
          default_engineer_id: engineerId.trim() || undefined,
          gas_safe_number: gasSafeNumber.trim() || undefined,
        });
        const certsChanged = certs.sort().join(',') !== initialCerts.sort().join(',');
        if (certsChanged) {
          await updateCertifications(certs);
        }
        await markOnboardingComplete();
        pushToast({ title: 'Profile updated', description: 'Preferences saved.', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Unable to save preferences',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const dirty =
    certs.sort().join(',') !== initialCerts.sort().join(',') ||
    fullName !== initialName ||
    dob !== initialDob ||
    profession !== initialProfession ||
    companyName !== initialCompanyName ||
    engineerName !== initialEngineerName ||
    engineerId !== initialEngineerId ||
    gasSafeNumber !== initialGasSafeNumber;

  return (
    <section className="rounded-3xl border border-white/20 bg-white/80 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Profile preferences</p>
          <h2 className="text-lg font-semibold text-muted">Onboarding details</h2>
          <p className="text-sm text-muted-foreground/70">
            Update your profile and certifications. This controls certificate filtering and onboarding status.
          </p>
        </div>
        <Button onClick={handleSave} disabled={isPending || !dirty}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-muted">Profile</p>
            <p className="text-xs text-muted-foreground/70">Update your name, birth date, and profession.</p>
          </div>
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
              value={dob ?? ''}
              onChange={(e) => setDob(e.target.value)}
              type="date"
              className="mt-2 w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm"
              disabled={isPending}
            />
          </label>
          <label className="block text-sm font-semibold text-muted">
            Profession
            <input
              value={profession ?? ''}
              onChange={(e) => setProfession(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm"
              placeholder="Plumber, Gas Engineer..."
              disabled={isPending}
            />
          </label>
          <div className="pt-2">
            <p className="text-sm font-semibold text-muted">Engineer & company</p>
            <p className="text-xs text-muted-foreground/70">
              These details prefill engineer and company fields on certificates.
            </p>
          </div>
          <label className="block text-sm font-semibold text-muted">
            Engineer name
            <input
              value={engineerName ?? ''}
              onChange={(e) => setEngineerName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm"
              placeholder="Engineer name"
              disabled={isPending}
            />
          </label>
          <label className="block text-sm font-semibold text-muted">
            Company name
            <input
              value={companyName ?? ''}
              onChange={(e) => setCompanyName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm"
              placeholder="Company name"
              disabled={isPending}
            />
          </label>
          <label className="block text-sm font-semibold text-muted">
            Engineer ID card number
            <input
              value={engineerId ?? ''}
              onChange={(e) => setEngineerId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm"
              placeholder="Optional"
              disabled={isPending}
            />
          </label>
          <label className="block text-sm font-semibold text-muted">
            Gas Safe number
            <input
              value={gasSafeNumber ?? ''}
              onChange={(e) => setGasSafeNumber(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm"
              placeholder="Optional"
              disabled={isPending}
            />
          </label>
        </div>
        <PreferenceGroup
          title="Certifications"
          subtitle="Select your current credentials."
          options={CERTIFICATIONS as unknown as string[]}
          selected={certs}
          onToggle={(value) => toggle(value, setCerts, certs)}
        />
      </div>
      <p className="mt-4 text-xs text-muted-foreground/70">
        Saving marks onboarding as complete. You can update these anytime.
      </p>
    </section>
  );
}

function PreferenceGroup({
  title,
  subtitle,
  options,
  selected,
  onToggle,
}: {
  title: string;
  subtitle: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-muted">{title}</p>
        <p className="text-xs text-muted-foreground/70">{subtitle}</p>
      </div>
      <div className="grid gap-2">
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                isSelected
                  ? 'border-[var(--action)] bg-[var(--action)]/10 text-[var(--brand)]'
                  : 'border-white/50 bg-white/80 text-muted hover:border-[var(--accent)]/50'
              }`}
            >
              <span className="font-semibold">{option}</span>
              {isSelected ? (
                <span className="rounded-full bg-[var(--action)] px-3 py-1 text-[11px] font-bold uppercase text-white">
                  Selected
                </span>
              ) : (
                <span className="text-[11px] font-semibold uppercase text-muted-foreground/60">Tap to select</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
