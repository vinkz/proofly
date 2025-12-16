import { getProfile } from '@/server/profile';
import { userHasPassword } from '@/server/auth';
import { ProfilePreferences } from './profile-preferences';
import { PasswordSection } from './password-section';

export default async function SettingsPage() {
  const { profile } = await getProfile();
  const trades = profile?.trade_types ?? [];
  const certs = profile?.certifications ?? [];
  const name = profile?.full_name ?? '';
  const dob = profile?.date_of_birth ?? '';
  const profession = profile?.profession ?? '';

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
        initialTrades={trades}
        initialCerts={certs}
        initialName={name}
        initialDob={dob}
        initialProfession={profession}
      />
      <PasswordSection hasPassword={hasPassword} />
    </div>
  );
}
