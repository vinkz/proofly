import Link from 'next/link';

import { getProfile } from '@/server/profile';
import { userHasPassword } from '@/server/auth';
import { getMissingOnboardingFields } from '@/lib/onboarding-profile';
import { normalizeStandardRates } from '@/lib/standard-rates';
import { getBillingPageData } from '@/server/billing-page';
import { manageSubscriptionAction } from '@/server/billing';
import { ProfilePreferences } from './profile-preferences';
import { PasswordSection } from './password-section';
import { SavedSignatureSection } from './saved-signature-section';
import { ThemeSection } from './theme-section';

type SetupTarget = 'certificate' | 'frictionless' | null;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ setup?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const setupTarget: SetupTarget =
    resolvedSearchParams?.setup === 'certificate' || resolvedSearchParams?.setup === 'frictionless'
      ? resolvedSearchParams.setup
      : null;
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
  const profileMissingFields = getMissingOnboardingFields(profile);
  const invoiceMissingFields = getInvoiceSetupMissingFields(profile);
  const hasCp12StandardRate = !!(standardRates.cp12 && Number(standardRates.cp12) > 0);
  const frictionlessMissingItems = [
    ...invoiceMissingFields.map((field) => `Invoice: ${field}`),
    !hasCp12StandardRate ? 'Standard rates: CP12 rate' : null,
    !savedSignatureUrl ? 'Signature: saved engineer signature' : null,
  ].filter((item): item is string => item !== null);

  const { hasPassword } = await userHasPassword();
  const billing = await getBillingPageData();
  const billingStatus = billing.subscriptionStatus;
  const isBillingActive = billingStatus === 'active';
  const isBillingPastDue = billingStatus === 'past_due';
  const usedPct = Math.min(100, Math.round(((billing.usage.used ?? 0) / (billing.usage.limit ?? 10)) * 100));

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

      {setupTarget ? (
        <SetupFocusCard
          target={setupTarget}
          missingItems={setupTarget === 'certificate' ? profileMissingFields : frictionlessMissingItems}
        />
      ) : null}

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
        setupFocus={setupTarget}
        missingProfileFields={profileMissingFields}
        missingInvoiceFields={[...invoiceMissingFields, ...(!hasCp12StandardRate ? ['CP12 standard rate'] : [])]}
      />

      {/* Saved signature card */}
      <section
        id="signature"
        className={`scroll-mt-20 overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] ${
          setupTarget === 'frictionless' && !savedSignatureUrl ? 'ring-1 ring-[var(--color-amber)]' : ''
        }`}
      >
        <div className="border-b-[0.5px] border-[var(--color-border-tertiary)] px-4 py-[14px]">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">Signature</p>
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
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">Appearance</p>
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
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">Subscription</p>
            <h2 className="text-[15px] font-medium text-[var(--color-text-primary)]">Plan & billing</h2>
          </div>
          {isBillingActive && (
            <span className="rounded-full bg-[var(--color-action-bg)] px-3 py-1 text-[11px] font-medium text-[var(--color-action)]">
              Active
            </span>
          )}
          {isBillingPastDue && (
            <span className="rounded-full bg-[var(--color-red-bg)] px-3 py-1 text-[11px] font-medium text-[var(--color-red)]">
              Payment failed
            </span>
          )}
          {!isBillingActive && !isBillingPastDue && (
            <span className="rounded-full bg-[var(--color-amber-bg)] px-3 py-1 text-[11px] font-medium text-[var(--color-amber)]">
              Free plan
            </span>
          )}
        </div>

        <div className="flex flex-col gap-[12px] p-4">
          {isBillingActive && (
            <>
              <div className="space-y-[2px]">
                <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                  Unlimited certificates
                  {billing.subscriptionInterval === 'year' ? ' · Annual' : billing.subscriptionInterval === 'month' ? ' · Monthly' : ''}
                </p>
                {billing.periodEnd && (
                  <p className="text-[12px] text-[var(--color-text-secondary)]">Renews {billing.periodEnd}</p>
                )}
              </div>
              <form action={manageSubscriptionAction}>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] bg-transparent px-[14px] py-[5px] text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-background-tertiary)]"
                >
                  Manage subscription
                </button>
              </form>
            </>
          )}

          {isBillingPastDue && (
            <>
              <p className="text-[13px] text-[var(--color-text-secondary)]">
                Your payment failed. Update your payment method to continue issuing certificates.
              </p>
              <form action={manageSubscriptionAction}>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-[var(--color-red-bg)] px-[14px] py-[6px] text-[12px] font-medium text-[var(--color-red)] transition-colors hover:brightness-95"
                >
                  Update payment method
                </button>
              </form>
            </>
          )}

          {!isBillingActive && !isBillingPastDue && (
            <>
              <div className="space-y-[6px]">
                <p className="text-[13px] text-[var(--color-text-secondary)]">
                  {"You've used "}
                  <span className="font-medium text-[var(--color-text-primary)]">{billing.usage.used} of {billing.usage.limit}</span>
                  {" free certificates in "}{billing.usage.month}.
                </p>
                <div className="h-[4px] overflow-hidden rounded-full bg-[var(--color-background-tertiary)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-action)] transition-all"
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
              </div>
              <Link
                href="/billing"
                className="flex w-full items-center justify-center rounded-full bg-[var(--color-text-primary)] px-[20px] py-[9px] text-[13px] font-medium text-[var(--color-text-inverse)] transition-colors hover:opacity-90"
              >
                View plans — from £8.99/month
              </Link>
              <p className="text-center text-[12px] text-[var(--color-text-tertiary)]">Cancel anytime. No commitment.</p>
            </>
          )}
        </div>
      </section>

      {/* Account / sign out */}
      <section className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
        <div className="border-b-[0.5px] border-[var(--color-border-tertiary)] px-4 py-[14px]">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">Account</p>
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

function SetupFocusCard({ target, missingItems }: { target: Exclude<SetupTarget, null>; missingItems: string[] }) {
  const title = target === 'certificate' ? 'Finish certificate-ready profile' : 'Make every job frictionless';
  const description =
    target === 'certificate'
      ? 'These details are required before certificates can be issued.'
      : 'These defaults reduce repeated typing on site and speed up handover.';

  return (
    <section className="rounded-[16px] border-[0.5px] border-[var(--color-amber)] bg-[var(--color-amber-bg)] p-4">
      <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{title}</p>
      <p className="mt-1 text-[12px] leading-[1.5] text-[var(--color-text-secondary)]">{description}</p>
      {missingItems.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {missingItems.map((item) => (
            <span
              key={item}
              className="rounded-full bg-[var(--color-background-primary)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-amber)]"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[12px] font-medium text-[var(--color-action)]">This setup group is complete.</p>
      )}
    </section>
  );
}

function getInvoiceSetupMissingFields(profile: unknown) {
  const row =
    profile && typeof profile === 'object' && !Array.isArray(profile)
      ? (profile as Record<string, unknown>)
      : null;
  const missing: string[] = [];
  const hasText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
  if (!hasText(row?.bank_account_name)) missing.push('Account name');
  if (!hasText(row?.bank_sort_code)) missing.push('Sort code');
  if (!hasText(row?.bank_account_number)) missing.push('Account number');
  return missing;
}
