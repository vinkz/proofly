'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { z } from 'zod';

import { GoogleAuthButton } from '@/components/auth/google-auth-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { signUpWithPassword } from '@/server/auth';

const SignUpSchema = z
  .object({
    email: z.string().email({ message: 'Valid email required' }),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirm: z.string().min(6, 'Password must be at least 6 characters'),
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

        if (result.needsEmailConfirmation) {
          pushToast({
            title: 'Check your email',
            description: 'Confirm your email to continue into profile setup.',
            variant: 'success',
          });
          router.push('/login');
          return;
        }

        pushToast({
          title: 'Account created',
          description: 'Continue to complete your profile.',
          variant: 'success',
        });
        router.push('/onboarding');
      } catch (error) {
        pushToast({
          title: 'Could not create account',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-[var(--brand)]">Create your account</h1>
        <p className="text-sm text-muted-foreground/80">
          Create your login first. You&apos;ll complete company and engineer details after authentication.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-white/60 bg-white/90 p-6 shadow-xl">
        <GoogleAuthButton label="Continue with Google" nextPath="/onboarding" />

        <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          <span className="h-px flex-1 bg-slate-200" />
          <span>Or continue with email</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-semibold text-muted">
            Email
            <Input
              type="email"
              value={form.email}
              onChange={update('email')}
              placeholder="you@example.com"
              className="mt-2"
              disabled={isPending}
            />
          </label>
          <label className="block text-sm font-semibold text-muted">
            Password
            <Input
              type="password"
              value={form.password}
              onChange={update('password')}
              placeholder="••••••••"
              className="mt-2"
              disabled={isPending}
            />
          </label>
          <label className="block text-sm font-semibold text-muted">
            Confirm password
            <Input
              type="password"
              value={form.confirm}
              onChange={update('confirm')}
              placeholder="••••••••"
              className="mt-2"
              disabled={isPending}
            />
          </label>
        </div>

        <Button onClick={handleCreateAccount} disabled={isPending} className="w-full rounded-full">
          {isPending ? 'Creating…' : 'Create account'}
        </Button>

        <p className="text-xs text-muted-foreground/70">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-[var(--accent)] underline underline-offset-4">
            Log in
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
