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
          title: result.existingAccount ? 'Signed in' : 'Account created',
          description: result.existingAccount
            ? 'Continue to profile setup with this account.'
            : 'Continue to complete your profile.',
          variant: 'success',
        });
        router.push('/signup/step2');
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
    <div className="pt-10">
      <h1 className="text-[24px] font-medium text-[var(--color-text-primary)]">Create your account</h1>
      <p className="mb-8 mt-2 text-[14px] text-[var(--color-text-secondary)]">
        Start your free trial — no card required
      </p>

      <GoogleAuthButton label="Continue with Google" nextPath="/signup/step2" />

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--color-border-tertiary)]" />
        <span className="text-[12px] text-[var(--color-text-tertiary)]">or continue with email</span>
        <span className="h-px flex-1 bg-[var(--color-border-tertiary)]" />
      </div>

      <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
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
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
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
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
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
