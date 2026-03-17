import { getProfile } from '@/server/profile';
import { userHasPassword } from '@/server/auth';
import { ProfilePreferences } from './profile-preferences';
import { PasswordSection } from './password-section';
import { Button } from '@/components/ui/button';

export default async function SettingsPage() {
  const { profile, user } = await getProfile();
  const name = profile?.default_engineer_name ?? profile?.full_name ?? '';
  const companyName = profile?.company_name ?? '';
  const companyAddressLine1 = (profile as { company_address?: string | null } | null)?.company_address ?? '';
  const companyAddressLine2 = (profile as { company_address_line2?: string | null } | null)?.company_address_line2 ?? '';
  const companyAddressLine3 = (profile as { company_town?: string | null } | null)?.company_town ?? '';
  const companyPostcode = (profile as { company_postcode?: string | null } | null)?.company_postcode ?? '';
  const companyPhone = (profile as { company_phone?: string | null } | null)?.company_phone ?? '';
  const engineerId = profile?.default_engineer_id ?? '';
  const gasSafeNumber = profile?.gas_safe_number ?? '';

  const { hasPassword } = await userHasPassword();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-muted">Settings</h1>
        <p className="text-sm text-muted-foreground/70">
          Update installer and company details used to prefill PDF company / installer sections.
        </p>
      </div>
      <ProfilePreferences
        initialName={name}
        initialCompanyName={companyName}
        initialEngineerId={engineerId}
        initialGasSafeNumber={gasSafeNumber}
        initialCompanyAddressLine1={companyAddressLine1}
        initialCompanyAddressLine2={companyAddressLine2}
        initialCompanyAddressLine3={companyAddressLine3}
        initialCompanyPostcode={companyPostcode}
        initialCompanyPhone={companyPhone}
      />
      <PasswordSection hasPassword={hasPassword} email={user.email ?? ''} />
      <form action="/logout" method="post" className="flex justify-end">
        <Button type="submit" variant="outline" className="rounded-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
