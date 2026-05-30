'use server';

import { randomUUID } from 'crypto';
import { z } from 'zod';

import { supabaseServerAction, supabaseServerServiceRole } from '@/lib/supabaseServer';
import { TRADE_TYPES } from '@/lib/profile-options';
import { isEmailConfigured, sendEmail } from '@/lib/resend';
import {
  ENGINEER_ID_CARD_NUMBER_MESSAGE,
  ENGINEER_ID_CARD_NUMBER_PATTERN,
  GAS_SAFE_NUMBER_MESSAGE,
  GAS_SAFE_NUMBER_PATTERN,
} from '@/lib/onboarding-profile';
import type { TablesInsert } from '@/lib/database.types';

const defaultTrades = TRADE_TYPES as unknown as string[];
const LEGACY_LONG_REQUEST_SLUG_PATTERN = /^cn-[a-f0-9]{20,}$/i;
const WELCOME_EMAIL_SUBJECT = 'Welcome to CertNow — your 14-day trial has started';
const WELCOME_EMAIL_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Welcome to CertNow</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8e8e8">

    <div style="background:#111;padding:20px 24px">
      <span style="font-size:16px;font-weight:600;color:#fff;letter-spacing:-0.3px">certnow</span>
    </div>

    <div style="padding:28px 24px">
      <h1 style="font-size:20px;font-weight:600;color:#111;margin:0 0 8px">
        You're all set, [engineer_name].
      </h1>
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 24px">
        Your CertNow account is ready. You can start issuing CP12 certificates
        and boiler service records right away.
      </p>

      <div style="background:#f9f9f9;border-radius:8px;padding:16px;margin-bottom:24px">
        <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#888;margin-bottom:10px">Your trial</div>
        <div style="font-size:14px;color:#111;margin-bottom:4px">
          Free trial active — ends <strong>[trial_end_date]</strong>
        </div>
        <div style="font-size:13px;color:#777">
          No card required. Subscribe any time from Settings → Plan & billing.
        </div>
      </div>

      <div style="margin-bottom:24px">
        <div style="font-size:13px;font-weight:600;color:#111;margin-bottom:8px">Quick start</div>
        <div style="font-size:13px;color:#555;line-height:1.8">
          1. Tap <strong>+ New job</strong> on your dashboard<br>
          2. Choose a cert type and fill in the property details<br>
          3. Complete the wizard on site<br>
          4. Send the certificate to your landlord in one tap
        </div>
      </div>

      <a href="https://certnow.uk/dashboard"
         style="display:block;background:#111;color:#fff;text-align:center;padding:13px 20px;border-radius:24px;font-size:14px;font-weight:500;text-decoration:none">
        Go to dashboard →
      </a>
    </div>

    <div style="padding:16px 24px;border-top:1px solid #f0f0f0;text-align:center">
      <p style="font-size:12px;color:#aaa;margin:0">
        CertNow · <a href="https://certnow.uk" style="color:#aaa">certnow.uk</a>
      </p>
    </div>

  </div>
</body>
</html>`;
const WELCOME_EMAIL_TEXT = `Welcome to CertNow, [engineer_name].

Your account is ready. Your free trial runs until [trial_end_date].

To get started:
1. Go to certnow.uk/dashboard
2. Tap + New job
3. Complete the wizard on site
4. Send the certificate to your landlord

No card required. Subscribe any time from Settings.

certnow.uk`;

const SignupWizardSchema = z.object({
  email: z.string().email({ message: 'Valid email required' }),
  password: z.string().optional().default(''),
  auth_provider: z.enum(['password', 'google']).optional().default('password'),
  full_name: z.string().min(2, 'Full name is required'),
  date_of_birth: z.string().min(4, 'Date of birth required'),
  profession: z.string().min(2, 'Profession required'),
  business_name: z.string().optional(),
  company_name: z.string().min(2, 'Company name required'),
  company_address: z.string().min(4, 'Company address required'),
  company_postcode: z.string().min(3, 'Company postcode required'),
  company_phone: z.string().min(6, 'Company phone required'),
  default_engineer_name: z.string().min(2, 'Engineer name required'),
  default_engineer_id: z.string().trim().regex(ENGINEER_ID_CARD_NUMBER_PATTERN, ENGINEER_ID_CARD_NUMBER_MESSAGE),
  gas_safe_number: z.string().trim().regex(GAS_SAFE_NUMBER_PATTERN, GAS_SAFE_NUMBER_MESSAGE),
  trade_types: z
    .array(z.string())
    .default(defaultTrades)
    .transform((value) => (value.length ? value : defaultTrades)),
  certifications: z.array(z.string()).optional().default([]),
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);

const buildSignupRequestSlug = (body: z.infer<typeof SignupWizardSchema>, suffix = '') => {
  const gasSafeNumber = body.gas_safe_number.replace(/\D/g, '');
  if (gasSafeNumber.length === 6) return `cn-${gasSafeNumber}${suffix}`;

  const seed = slugify(body.company_name || body.default_engineer_name || body.full_name) || 'engineer';
  return `cn-${seed}-${randomUUID().replace(/-/g, '').slice(0, 6)}`;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getFirstName = (fullName: string | null | undefined) => fullName?.trim().split(/\s+/)[0] || 'there';

const formatTrialEndDate = (trialEndsAt: string | null | undefined) => {
  if (!trialEndsAt) return 'in 14 days';
  const date = new Date(trialEndsAt);
  if (Number.isNaN(date.getTime())) return 'in 14 days';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const renderWelcomeEmail = (engineerName: string, trialEndDate: string) => ({
  html: WELCOME_EMAIL_HTML
    .replace(/\[engineer_name\]/g, escapeHtml(engineerName))
    .replace(/\[trial_end_date\]/g, escapeHtml(trialEndDate)),
  text: WELCOME_EMAIL_TEXT
    .replace(/\[engineer_name\]/g, engineerName)
    .replace(/\[trial_end_date\]/g, trialEndDate),
});

async function getTrialEndsAt(
  profileSb: Awaited<ReturnType<typeof supabaseServerServiceRole>>,
  userId: string,
) {
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

async function sendWelcomeEmailAfterSignup(input: {
  email: string;
  fullName: string | null | undefined;
  profileSb: Awaited<ReturnType<typeof supabaseServerServiceRole>>;
  userId: string;
}) {
  if (!isEmailConfigured()) return;

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
      console.error('[completeSignupWizard] welcome email failed:', result.error ?? result.status);
    }
  } catch (err) {
    console.error('[completeSignupWizard] welcome email failed:', err);
  }
}

async function getAvailableRequestSlug(
  profileSb: Awaited<ReturnType<typeof supabaseServerServiceRole>>,
  userId: string,
  body: z.infer<typeof SignupWizardSchema>,
  existingSlug: string,
) {
  if (existingSlug && !LEGACY_LONG_REQUEST_SLUG_PATTERN.test(existingSlug)) return existingSlug;

  const candidates = [
    buildSignupRequestSlug(body),
    buildSignupRequestSlug(body, `-${randomUUID().replace(/-/g, '').slice(0, 4)}`),
    `cn-${randomUUID().replace(/-/g, '').slice(0, 8)}`,
  ];

  for (const candidate of candidates) {
    const { data, error } = await profileSb
      .from('profiles')
      .select('id')
      .eq('request_link_slug', candidate)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.id || data.id === userId) return candidate;
  }

  return `cn-${randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

export async function completeSignupWizard(payload: unknown) {
  const body = SignupWizardSchema.parse(payload);
  const sb = await supabaseServerAction();
  const {
    data: { user: existingUser },
  } = await sb.auth.getUser();

  let userId = existingUser?.id ?? null;
  let userEmail = existingUser?.email ?? body.email;

  if (!userId) {
    if (!body.password || body.password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    const { data, error } = await sb.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: {
          full_name: body.full_name,
          profession: body.profession,
          business_name: body.company_name ?? body.business_name ?? null,
          trade_types: body.trade_types,
          certifications: body.certifications,
          company_address: body.company_address ?? null,
          company_postcode: body.company_postcode ?? null,
          company_phone: body.company_phone ?? null,
          gas_safe_number: body.gas_safe_number ?? null,
          default_engineer_id: body.default_engineer_id ?? null,
          default_engineer_name: body.default_engineer_name ?? null,
        },
      },
    });
    if (error) throw new Error(error.message);
    userId = data.user?.id ?? null;
    userEmail = data.user?.email ?? body.email;
  } else {
    const { error } = await sb.auth.updateUser({
      data: {
        full_name: body.full_name,
        profession: body.profession,
        business_name: body.company_name ?? body.business_name ?? null,
        trade_types: body.trade_types,
        certifications: body.certifications,
        company_address: body.company_address ?? null,
        company_postcode: body.company_postcode ?? null,
        company_phone: body.company_phone ?? null,
        gas_safe_number: body.gas_safe_number ?? null,
        default_engineer_id: body.default_engineer_id ?? null,
        default_engineer_name: body.default_engineer_name ?? null,
      },
    });
    if (error) throw new Error(error.message);
  }

  if (!userId) throw new Error('Unable to create user');

  const profileSb = await supabaseServerServiceRole();
  const { data: existingProfile, error: existingProfileErr } = await profileSb
    .from('profiles')
    .select('request_link_slug,onboarding_complete')
    .eq('id', userId)
    .maybeSingle();
  if (existingProfileErr) throw new Error(existingProfileErr.message);
  const shouldSendWelcomeEmail = existingProfile?.onboarding_complete !== true;
  const requestLinkSlug = await getAvailableRequestSlug(
    profileSb,
    userId,
    body,
    existingProfile?.request_link_slug?.trim() ?? '',
  );

  const profile: TablesInsert<'profiles'> = {
    id: userId,
    full_name: body.full_name,
    date_of_birth: body.date_of_birth,
    profession: body.profession,
    trade_types: body.trade_types,
    certifications: body.certifications ?? [],
    company_name: body.company_name ?? null,
    company_address: body.company_address ?? null,
    company_postcode: body.company_postcode ?? null,
    company_phone: body.company_phone ?? null,
    default_engineer_name: body.default_engineer_name ?? body.full_name,
    default_engineer_id: body.default_engineer_id ?? null,
    gas_safe_number: body.gas_safe_number ?? null,
    request_link_slug: requestLinkSlug,
    onboarding_complete: true,
  };

  const { error: profileErr } = await profileSb.from('profiles').upsert(profile, { onConflict: 'id' });
  if (profileErr) throw new Error(profileErr.message);

  if (shouldSendWelcomeEmail) {
    await sendWelcomeEmailAfterSignup({
      email: userEmail,
      fullName: profile.full_name,
      profileSb,
      userId,
    });
  }

  return { ok: true };
}
