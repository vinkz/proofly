import { getProfile } from '@/server/profile';
import { userHasPassword } from '@/server/auth';
import { ProfilePreferences } from './profile-preferences';
import { PasswordSection } from './password-section';
import { SavedSignatureSection } from './saved-signature-section';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { normalizeStandardRates } from '@/lib/standard-rates';

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

  const { hasPassword } = await userHasPassword();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:py-10">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[var(--color-text-primary)]">
          Settings
        </h1>
        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
          Manage the details used to populate certificates, invoices, and your public profile.
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

      {/* Saved signature */}
      <section className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
        <div className="mb-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Signature</p>
          <h2 className="mt-1 text-[16px] font-semibold text-[var(--color-text-primary)]">Saved signature</h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Stored once and pre-filled on every CP12 and boiler service certificate. You can always re-draw per job.
          </p>
        </div>
        <SavedSignatureSection existingUrl={savedSignatureUrl} />
      </section>

      <PasswordSection hasPassword={hasPassword} email={user.email ?? ''} />

      {/* Appearance */}
      <section className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Appearance</p>
        <h2 className="mt-1 text-[16px] font-semibold text-[var(--color-text-primary)]">Theme</h2>
        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">Switch between light and dark mode.</p>
        <div className="mt-4">
          <ThemeToggle />
        </div>
      </section>

      {/* Subscription — placeholder until Milestone 5 */}
      <section className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Subscription</p>
        <h2 className="mt-1 text-[16px] font-semibold text-[var(--color-text-primary)]">Plan & billing</h2>
        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
          Subscription management will be available here once billing is enabled.
        </p>
        <div
          className="mt-3 inline-flex h-[36px] cursor-not-allowed items-center justify-center rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] px-4 text-[13px] text-[var(--color-text-tertiary)] opacity-50"
          aria-disabled="true"
        >
          Manage subscription
        </div>
      </section>

      <form action="/logout" method="post">
        <button
          type="submit"
          className="h-[38px] rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-transparent px-4 text-[13px] text-[var(--color-text-secondary)]"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
