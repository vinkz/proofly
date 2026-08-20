import { isEmailConfigured, sendEmail } from '@/lib/resend';
import { baseEmail, ctaButton, emailSubtitle, emailTitle, infoCard, titleCase } from '@/lib/email-templates';
import { FREE_TIER_MONTHLY_LIMIT } from '@/lib/stripe';

export const WELCOME_EMAIL_SUBJECT = 'Welcome to CertNow — your account is ready';

const WELCOME_EMAIL_TEXT = `Welcome to CertNow, [engineer_name].

Your account is ready. You can issue up to [monthly_limit] certificates a month, free.

To get started:
1. Go to certnow.uk/dashboard
2. Tap + New job
3. Complete the wizard on site
4. Send the certificate to your landlord

No card required. Need more than [monthly_limit] a month? Subscribe any time from Settings.

certnow.uk`;

const getFirstName = (fullName: string | null | undefined) => {
  const firstName = fullName?.trim().split(/\s+/)[0] || 'there';
  return firstName === 'there' ? firstName : titleCase(firstName);
};

const renderWelcomeEmail = (engineerName: string) => ({
  html: baseEmail(
    [
      emailTitle(`You're all set, ${engineerName}.`),
      emailSubtitle('Your CertNow account is ready. You can start issuing CP12 certificates right away.'),
      // The allowance is read from the billing constant, not retyped: this copy
      // makes a promise the issuing code has to honour, so the two must not drift.
      infoCard('Your plan', [
        { label: 'Plan', value: 'Free' },
        { label: 'Included', value: `${FREE_TIER_MONTHLY_LIMIT} certificates a month` },
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
    .replace(/\[monthly_limit\]/g, String(FREE_TIER_MONTHLY_LIMIT)),
});

/**
 * Sends the welcome email. Best-effort: never throws — a failed send must
 * not break signup/onboarding. Callers are responsible for only invoking this
 * once (e.g. on the incomplete -> complete onboarding transition).
 */
export async function sendWelcomeEmail(input: {
  email: string | null | undefined;
  fullName: string | null | undefined;
}) {
  if (!isEmailConfigured()) return;
  if (!input.email) return;

  try {
    const engineerName = getFirstName(input.fullName);
    const email = renderWelcomeEmail(engineerName);
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
