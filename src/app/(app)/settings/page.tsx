import { getProfile } from '@/server/profile';
import { userHasPassword } from '@/server/auth';
import { ProfilePreferences } from './profile-preferences';
import { PasswordSection } from './password-section';

export default async function SettingsPage() {
  const { profile } = await getProfile();
  const certs = profile?.certifications ?? [];
  const name = profile?.full_name ?? '';
  const dob = profile?.date_of_birth ?? '';
  const profession = profile?.profession ?? '';
  const companyName = profile?.company_name ?? '';
  const engineerName = profile?.default_engineer_name ?? '';
  const engineerId = profile?.default_engineer_id ?? '';
  const gasSafeNumber = profile?.gas_safe_number ?? '';

  const { hasPassword } = await userHasPassword();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-muted">Settings</h1>
        <p className="text-sm text-muted-foreground/70">
          Update your profile, trade preferences, and credentials. This controls which certificates you see.
        </p>
      </div>
      <ProfilePreferences
        initialCerts={certs}
        initialName={name}
        initialDob={dob}
        initialProfession={profession}
        initialCompanyName={companyName}
        initialEngineerName={engineerName}
        initialEngineerId={engineerId}
        initialGasSafeNumber={gasSafeNumber}
      />
      <PasswordSection hasPassword={hasPassword} />
    </div>
  );
}
