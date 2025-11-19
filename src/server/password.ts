'use server';

import { z } from 'zod';

import { supabaseServerAction } from '@/lib/supabaseServer';
import { userHasPassword } from '@/server/auth';

const PasswordChangeSchema = z.object({
  current_password: z.string().optional(),
  new_password: z.string().min(6, 'New password must be at least 6 characters'),
});

const ResetRequestSchema = z.object({
  email: z.string().email(),
});

const ResetApplySchema = z.object({
  code: z.string().min(5),
  new_password: z.string().min(6, 'New password must be at least 6 characters'),
});

export async function changePassword(payload: unknown) {
  const body = PasswordChangeSchema.parse(payload);
  const sb = await supabaseServerAction();
  const { user, hasPassword } = await userHasPassword();
  if (!user?.email) throw new Error('Unauthorized');

  if (hasPassword) {
    if (!body.current_password) {
      throw new Error('Current password required');
    }
    const reauth = await sb.auth.signInWithPassword({
      email: user.email,
      password: body.current_password,
    });
    if (reauth.error) {
      throw new Error('Current password is incorrect');
    }
  }

  const { error } = await sb.auth.updateUser({ password: body.new_password });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function requestPasswordReset(email: string) {
  const parsed = ResetRequestSchema.parse({ email });
  const sb = await supabaseServerAction();
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/reset-password`;
  const { error } = await sb.auth.resetPasswordForEmail(parsed.email, {
    redirectTo,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function applyPasswordReset(payload: unknown) {
  const body = ResetApplySchema.parse(payload);
  const sb = await supabaseServerAction();
  const { error: sessionErr } = await sb.auth.exchangeCodeForSession(body.code);
  if (sessionErr) throw new Error(sessionErr.message);

  const { error } = await sb.auth.updateUser({ password: body.new_password });
  if (error) throw new Error(error.message);
  return { ok: true };
}
