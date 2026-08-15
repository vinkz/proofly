'use server';

import { z } from 'zod';

import { safeInternalPath } from '@/lib/safe-redirect';

// Anon key, not the service-role key: these are GoTrue sign-in/sign-up calls,
// which never needed elevated rights, and a service-role client would be one
// `.from()` away from bypassing every RLS policy in the database.
//
// This used to be a second, locally-declared client identical to
// supabaseServerAction except that its cookie writes were unguarded — which is
// what filled Sentry with "Cookies can only be modified in a Server Action or
// Route Handler" from /login. One adapter now, so the two cannot drift again.
import { supabaseServerAction, supabaseServerReadOnly } from '@/lib/supabaseServer';

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
const SignupCredentialsSchema = CredentialsSchema.extend({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});


/**
 * Expected outcomes are returned, not thrown.
 *
 * Next.js strips the message off an error thrown in a Server Action in
 * production and replaces it with an opaque digest, so a thrown "this email is
 * already registered" reaches the browser as a 500 with nothing useful in it.
 * Anything a user can cause by typing must therefore come back as a value.
 * Throwing stays for genuinely unexpected failures, where a digest and a Sentry
 * report are the right outcome.
 */
export type AuthActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

/**
 * Turn a provider error into something worth showing someone.
 *
 * Supabase's wording is aimed at developers ("Invalid login credentials",
 * "AuthApiError: ..."), and some of it leaks internals. Anything unrecognised
 * becomes a generic line rather than being passed through.
 */
function authMessage(raw: string | undefined, fallback: string): string {
  const message = (raw ?? '').trim();
  if (!message) return fallback;

  if (/invalid login credentials|invalid credentials/i.test(message)) {
    return 'That email and password do not match an account.';
  }
  if (/email not confirmed/i.test(message)) {
    return 'Confirm your email address first — check your inbox for the link.';
  }
  if (/already registered|already exists|user exists/i.test(message)) {
    return 'That email is already registered. Log in instead, or reset your password.';
  }
  if (/rate limit|too many requests|for security purposes/i.test(message)) {
    return 'Too many attempts just now. Wait a minute and try again.';
  }
  if (/password.*(at least|should be|weak)/i.test(message)) {
    return 'Choose a longer password — at least 8 characters.';
  }
  if (/invalid email|unable to validate email/i.test(message)) {
    return 'That email address does not look right.';
  }
  return fallback;
}

export async function signInWithPassword(payload: unknown): Promise<AuthActionResult> {
  const body = CredentialsSchema.parse(payload);
  const sb = await supabaseServerAction();
  const { error } = await sb.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });
  if (error) {
    return { ok: false, message: authMessage(error.message, 'Could not sign you in. Try again.') };
  }
  return { ok: true };
}

const safeNextPath = (nextPath: unknown) => safeInternalPath(nextPath, null);

export async function signInWithMagicLink(
  email: string,
  nextPath?: string,
): Promise<AuthActionResult> {
  const parsed = z.string().email().parse(email);
  const sb = await supabaseServerAction();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const safeNext = safeNextPath(nextPath);
  const emailRedirectTo = siteUrl
    ? `${siteUrl}/auth/callback${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ''}`
    : undefined;
  const { error } = await sb.auth.signInWithOtp({
    email: parsed,
    options: { emailRedirectTo },
  });
  if (error) {
    return { ok: false, message: authMessage(error.message, 'Could not send the link. Try again.') };
  }
  return { ok: true };
}

export async function signUpWithPassword(
  payload: unknown,
): Promise<AuthActionResult<{ needsEmailConfirmation: boolean; existingAccount: boolean }>> {
  const body = SignupCredentialsSchema.parse(payload);
  const sb = await supabaseServerAction();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const emailRedirectTo = siteUrl ? `${siteUrl}/auth/callback?next=${encodeURIComponent('/signup/step2')}` : undefined;

  const { data, error } = await sb.auth.signUp({
    email: body.email,
    password: body.password,
    options: {
      emailRedirectTo,
    },
  });
  if (error) {
    if (/already registered|already exists|user exists/i.test(error.message)) {
      // The password they just typed may be the right one for the existing
      // account, in which case signing them in is the friendliest outcome.
      const { error: signInError } = await sb.auth.signInWithPassword({
        email: body.email,
        password: body.password,
      });
      if (signInError) {
        return {
          ok: false,
          message: 'That email is already registered. Log in with your password, or reset it if you have forgotten it.',
        };
      }
      return { ok: true, needsEmailConfirmation: false, existingAccount: true };
    }
    return { ok: false, message: authMessage(error.message, 'Could not create your account. Try again.') };
  }

  return {
    ok: true,
    needsEmailConfirmation: !data.session,
    existingAccount: false,
  };
}

// Re-send the signup confirmation email (used by the "Verify your email" screen).
// Mirrors the emailRedirectTo used at signup so the link lands back in onboarding.
export async function resendSignupConfirmation(email: unknown): Promise<AuthActionResult> {
  const parsed = z.string().email().parse(email);
  const sb = await supabaseServerAction();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const emailRedirectTo = siteUrl ? `${siteUrl}/auth/callback?next=${encodeURIComponent('/signup/step2')}` : undefined;

  const { error } = await sb.auth.resend({
    type: 'signup',
    email: parsed,
    options: { emailRedirectTo },
  });
  if (error) {
    return { ok: false, message: authMessage(error.message, 'Could not resend the email. Try again shortly.') };
  }
  return { ok: true };
}

export async function userHasPassword() {
  const sb = await supabaseServerReadOnly();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');

  const identities = (
    user as { identities?: Array<{ provider?: string; identity_data?: Record<string, unknown> }> }
  ).identities;
  const hasPassword = Array.isArray(identities)
    ? identities.some((identity) => identity.provider === 'email' && !!identity.identity_data?.email)
    : false;

  return { user, hasPassword };
}
