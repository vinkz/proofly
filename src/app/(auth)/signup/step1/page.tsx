'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { z } from 'zod';

import posthog from 'posthog-js';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics/events';
import { FREE_TIER_MONTHLY_LIMIT } from '@/lib/plan';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { GoogleAuthButton } from '@/components/auth/google-auth-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { signUpWithPassword } from '@/server/auth';

const SignUpSchema = z
  .object({
    email: z.string().email({ message: 'Valid email required' }),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string().min(8, 'Password must be at least 8 characters'),
  })
  .refine((data) => data.password === data.confirm, { message: 'Passwords do not match', path: ['confirm'] });

export default function SignupStep1Page() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirm: '',
  });

  // Funnel step 2: visitor reached the signup screen.
  useEffect(() => {
    track(ANALYTICS_EVENTS.signupStarted);
  }, []);

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleCreateAccount = () => {
    startTransition(async () => {
      const parsed = SignUpSchema.safeParse(form);
      if (!parsed.success) {
        pushToast({
          title: 'Check your details',
          description: parsed.error.issues[0]?.message ?? 'Please correct the fields.',
          variant: 'error',
        });
        return;
      }

      try {
        const result = await signUpWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });

        if (!result.ok) {
          pushToast({ title: 'Could not create account', description: result.message, variant: 'error' });
          return;
        }

        if (result.needsEmailConfirmation) {
          // Send them to the dedicated verify screen (with resend), not a fleeting
          // toast — email confirmation is a hard gate before profile setup. Don't
          // fire signupCompleted here: the account isn't usable until confirmed.
          router.push(`/signup/verify?email=${encodeURIComponent(parsed.data.email)}`);
          return;
        }

        // Funnel step 3: account created with a live session (email path).
        const { data: { user } } = await supabaseBrowser().auth.getUser();
        if (user) {
          posthog.identify(user.id, { email: user.email });
        }
        track(ANALYTICS_EVENTS.signupCompleted, { method: 'email' });
        pushToast({
          title: result.existingAccount ? 'Signed in' : 'Account created',
          description: result.existingAccount
            ? 'Continue to profile setup with this account.'
            : 'Continue to complete your profile.',
          variant: 'success',
        });
        router.push('/signup/step2');
      } catch {
        pushToast({
          title: 'Could not create account',
          description: 'Something went wrong on our side. Please try again.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <div className="pt-10">
      <h1 className="text-[24px] font-medium text-[var(--color-text-primary)]">Create your account</h1>
      <p className="mt-2 text-[13px] text-[var(--color-text-tertiary)]">
        {FREE_TIER_MONTHLY_LIMIT} certificates free each month · No card required
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '16px 0 24px' }}>
        {[
          'Issue CP12 certificates while you are on site',
          'Landlords get a permanent compliance link automatically',
          'Engineer renewal prompts keep upcoming work visible',
        ].map((text) => (
          <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              width: '20px', height: '20px', borderRadius: '50%',
              background: '#edf7f2', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
              fontSize: '11px', color: '#1a7a52', fontWeight: 500,
            }}>✓</span>
            <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>{text}</span>
          </div>
        ))}
      </div>

      <GoogleAuthButton label="Continue with Google" nextPath="/signup/step2" />

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--color-border-tertiary)]" />
        <span className="text-[12px] text-[var(--color-text-tertiary)]">or continue with email</span>
        <span className="h-px flex-1 bg-[var(--color-border-tertiary)]" />
      </div>

      <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-medium tracking-[0.5px] text-[var(--color-text-tertiary)]">
              Email
            </p>
            <Input
              type="email"
              value={form.email}
              onChange={update('email')}
              placeholder="you@example.com"
              className="mt-1.5"
              disabled={isPending}
            />
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-[0.5px] text-[var(--color-text-tertiary)]">
              Password
            </p>
            <Input
              type="password"
              value={form.password}
              onChange={update('password')}
              placeholder="••••••••"
              className="mt-1.5"
              disabled={isPending}
            />
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-[0.5px] text-[var(--color-text-tertiary)]">
              Confirm password
            </p>
            <Input
              type="password"
              value={form.confirm}
              onChange={update('confirm')}
              placeholder="••••••••"
              className="mt-1.5"
              disabled={isPending}
            />
          </div>
        </div>
      </div>

      <Button
        variant="primary"
        onClick={handleCreateAccount}
        disabled={isPending}
        className="mt-5 h-11 w-full"
      >
        {isPending ? 'Creating…' : 'Create account'}
      </Button>

      <p className="mt-5 text-center text-[13px] text-[var(--color-text-secondary)]">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-[var(--color-action)]">
          Sign in
        </Link>
      </p>
    </div>
  );
}
