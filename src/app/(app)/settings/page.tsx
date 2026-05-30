import Link from 'next/link';

import { getProfile } from '@/server/profile';
import { userHasPassword } from '@/server/auth';
import { normalizeStandardRates } from '@/lib/standard-rates';
import { ProfilePreferences } from './profile-preferences';
import { PasswordSection } from './password-section';
import { SavedSignatureSection } from './saved-signature-section';
import { ThemeSection } from './theme-section';

export default async function SettingsPage() {
  const { profile, user } = await getProfile();
  const fullName = profile?.full_name ?? '';
  const dateOfBirth = profile?.date_of_birth ?? '';
  const profession = profile?.profession ?? '';
  const engineerName = profile?.default_engineer_name ?? '';
  const companyName = profile?.company_name ?? '';
  const companyAddressLine1 = (profile as { company_address?: string | null } | null)?.company_address ?? '';
  const companyAddressLine2 = (profile as { company_address_line2?: string | null } | null)?.company_address_line2 ?? '';
  const companyAddressLine3 = (profile as { company_town?: string | null } | null)?.company_town ?? '';
  const companyPostcode = (profile as { company_postcode?: string | null } | null)?.company_postcode ?? '';
  const companyPhone = (profile as { company_phone?: string | null } | null)?.company_phone ?? '';
  const engineerId = profile?.default_engineer_id ?? '';
  const gasSafeNumber = profile?.gas_safe_number ?? '';
  const bankName = (profile as { bank_name?: string | null } | null)?.bank_name ?? '';
  const bankAccountName = (profile as { bank_account_name?: string | null } | null)?.bank_account_name ?? '';
  const bankSortCode = (profile as { bank_sort_code?: string | null } | null)?.bank_sort_code ?? '';
  const bankAccountNumber = (profile as { bank_account_number?: string | null } | null)?.bank_account_number ?? '';
  const standardRates = normalizeStandardRates(
    (profile as { standard_rates?: unknown } | null)?.standard_rates,
  );
  const savedSignatureUrl = (profile as { saved_signature_url?: string | null } | null)?.saved_signature_url ?? null;
  const trialEndsAt = (profile as { trial_ends_at?: string | null } | null)?.trial_ends_at ?? null;
  const subscriptionStatus = (profile as { subscription_status?: string | null } | null)?.subscription_status ?? null;
  const isSubscribed = subscriptionStatus === 'active';
  const trialEndFormatted = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const { hasPassword } = await userHasPassword();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-[12px] px-4 py-6 sm:py-10">
      <div className="pb-2">
        <h1 className="text-[22px] font-medium leading-tight tracking-[-0.02em] text-[var(--color-text-primary)]">
          Settings
        </h1>
        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
          Manage the details used on certificates, invoices, and your public profile.
        </p>
      </div>

      <ProfilePreferences
        initialFullName={fullName}
        initialDateOfBirth={dateOfBirth}
        initialProfession={profession}
        initialEngineerName={engineerName}
        initialCompanyName={companyName}
        initialEngineerId={engineerId}
        initialGasSafeNumber={gasSafeNumber}
        initialCompanyAddressLine1={companyAddressLine1}
        initialCompanyAddressLine2={companyAddressLine2}
        initialCompanyAddressLine3={companyAddressLine3}
        initialCompanyPostcode={companyPostcode}
        initialCompanyPhone={companyPhone}
        initialBankName={bankName}
        initialBankAccountName={bankAccountName}
        initialBankSortCode={bankSortCode}
        initialBankAccountNumber={bankAccountNumber}
        initialStandardRates={standardRates}
      />

      {/* Saved signature card */}
      <section className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
        <div className="border-b-[0.5px] border-[var(--color-border-tertiary)] px-4 py-[14px]">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Signature</p>
          <h2 className="text-[15px] font-medium text-[var(--color-text-primary)]">Saved signature</h2>
        </div>
        <div className="p-4">
          <p className="mb-3 text-[12px] text-[var(--color-text-secondary)]">
            Stored once and pre-filled on every CP12 and boiler service certificate. You can always re-draw per job.
          </p>
          <SavedSignatureSection existingUrl={savedSignatureUrl} />
        </div>
      </section>

      <PasswordSection hasPassword={hasPassword} email={user.email ?? ''} />

      {/* Theme card */}
      <section className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
        <div className="border-b-[0.5px] border-[var(--color-border-tertiary)] px-4 py-[14px]">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Appearance</p>
          <h2 className="text-[15px] font-medium text-[var(--color-text-primary)]">Theme</h2>
        </div>
        <div className="p-4">
          <ThemeSection />
        </div>
      </section>

      {/* Plan & billing card */}
      <section className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
        <div className="flex items-center justify-between border-b-[0.5px] border-[var(--color-border-tertiary)] px-4 py-[14px]">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Subscription</p>
            <h2 className="text-[15px] font-medium text-[var(--color-text-primary)]">Plan & billing</h2>
          </div>
          {isSubscribed ? (
            <span className="rounded-full bg-[var(--color-action-bg)] px-3 py-1 text-[11px] font-medium text-[var(--color-action)]">
              Active
            </span>
          ) : (
            <span className="rounded-full bg-[var(--color-amber-bg)] px-3 py-1 text-[11px] font-medium text-[var(--color-amber)]">
              Free trial
            </span>
          )}
        </div>
        <div className="flex flex-col gap-[12px] p-4">
          {isSubscribed ? (
            <>
              <p className="text-[13px] text-[var(--color-text-secondary)]">Your subscription is active.</p>
              <Link
                href="/billing"
                className="inline-flex items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] bg-transparent px-[14px] py-[5px] text-[12px] font-medium text-[var(--color-text-secondary)]"
              >
                Manage subscription
              </Link>
            </>
          ) : (
            <>
              <p className="text-[13px] text-[var(--color-text-secondary)]">
                {trialEndFormatted
                  ? `Your free trial ends on ${trialEndFormatted}. Subscribe to keep issuing certificates.`
                  : "Your free trial is active. Subscribe to keep issuing certificates."}
              </p>
              <Link
                href="/billing"
                className="flex w-full items-center justify-center rounded-full bg-[#111] px-[20px] py-[10px] text-[13px] font-medium text-white"
              >
                Subscribe — £12.99/month
              </Link>
              <p className="text-center text-[12px] text-[var(--color-text-tertiary)]">Cancel anytime. No commitment.</p>
            </>
          )}
        </div>
      </section>

      {/* Account / sign out */}
      <section className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
        <div className="border-b-[0.5px] border-[var(--color-border-tertiary)] px-4 py-[14px]">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Account</p>
          <h2 className="text-[15px] font-medium text-[var(--color-text-primary)]">Sign out</h2>
        </div>
        <div className="p-4">
          <p className="mb-3 text-[13px] text-[var(--color-text-secondary)]">You will be returned to the login screen.</p>
          <form action="/logout" method="post">
            <button
              type="submit"
              className="rounded-full border-[0.5px] border-[#f09595] bg-[#fcebeb] px-[12px] py-[5px] text-[12px] font-medium text-[#a32d2d]"
            >
              Sign out
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
