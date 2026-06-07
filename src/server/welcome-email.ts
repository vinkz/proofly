import { isEmailConfigured, sendEmail } from '@/lib/resend';
import { baseEmail, ctaButton, emailSubtitle, emailTitle, formatDate, infoCard, titleCase } from '@/lib/email-templates';
import type { supabaseServerServiceRole } from '@/lib/supabaseServer';

type ProfileServiceClient = Awaited<ReturnType<typeof supabaseServerServiceRole>>;

export const WELCOME_EMAIL_SUBJECT = 'Welcome to CertNow — your 14-day trial has started';

const WELCOME_EMAIL_TEXT = `Welcome to CertNow, [engineer_name].

Your account is ready. Your free trial runs until [trial_end_date].

To get started:
1. Go to certnow.uk/dashboard
2. Tap + New job
3. Complete the wizard on site
4. Send the certificate to your landlord

No card required. Subscribe any time from Settings.

certnow.uk`;

const getFirstName = (fullName: string | null | undefined) => {
  const firstName = fullName?.trim().split(/\s+/)[0] || 'there';
  return firstName === 'there' ? firstName : titleCase(firstName);
};

const formatTrialEndDate = (trialEndsAt: string | null | undefined) => {
  if (!trialEndsAt) return 'in 14 days';
  const date = new Date(trialEndsAt);
  if (Number.isNaN(date.getTime())) return 'in 14 days';
  return formatDate(trialEndsAt);
};

const renderWelcomeEmail = (engineerName: string, trialEndDate: string) => ({
  html: baseEmail(
    [
      emailTitle(`You're all set, ${engineerName}.`),
      emailSubtitle('Your CertNow account is ready. You can start issuing CP12 certificates right away.'),
      infoCard('Your trial', [
        { label: 'Status', value: 'Free trial active' },
        { label: 'Trial ends', value: trialEndDate },
        { label: 'Card required', value: 'No' },
      ]),
      `<div style="font-size:13px;color:#555;line-height:1.8;margin:16px 0">
        <div style="font-size:13px;font-weight:600;color:#111;margin-bottom:8px">Quick start</div>
        1. Tap <strong>+ New job</strong> on your dashboard<br>
        2. Choose a cert type and fill in the property details<br>
        3. Complete the wizard on site<br>
        4. Send the certificate to your landlord in one tap
      </div>`,
      ctaButton('Go to dashboard', 'https://certnow.uk/dashboard', 'dark'),
    ].join(''),
    { subject: WELCOME_EMAIL_SUBJECT },
  ),
  text: WELCOME_EMAIL_TEXT
    .replace(/\[engineer_name\]/g, engineerName)
    .replace(/\[trial_end_date\]/g, trialEndDate),
});

async function getTrialEndsAt(profileSb: ProfileServiceClient, userId: string) {
  try {
    const { data, error } = await profileSb
      .from('profiles')
      .select('trial_ends_at')
      .eq('id', userId)
      .maybeSingle();
    if (error) return null;
    return (data as { trial_ends_at?: string | null } | null)?.trial_ends_at ?? null;
  } catch {
    return null;
  }
}

/**
 * Sends the trial welcome email. Best-effort: never throws — a failed send must
 * not break signup/onboarding. Callers are responsible for only invoking this
 * once (e.g. on the incomplete -> complete onboarding transition).
 */
export async function sendWelcomeEmail(input: {
  email: string | null | undefined;
  fullName: string | null | undefined;
  profileSb: ProfileServiceClient;
  userId: string;
}) {
  if (!isEmailConfigured()) return;
  if (!input.email) return;

  try {
    const trialEndsAt = await getTrialEndsAt(input.profileSb, input.userId);
    const engineerName = getFirstName(input.fullName);
    const trialEndDate = formatTrialEndDate(trialEndsAt);
    const email = renderWelcomeEmail(engineerName, trialEndDate);
    const result = await sendEmail({
      to: input.email,
      subject: WELCOME_EMAIL_SUBJECT,
      html: email.html,
      text: email.text,
    });

    if (result.status !== 'sent') {
      console.error('[welcome-email] welcome email failed:', result.error ?? result.status);
    }
  } catch (err) {
    console.error('[welcome-email] welcome email failed:', err);
  }
}
