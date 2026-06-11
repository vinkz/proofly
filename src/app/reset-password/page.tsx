'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, useEffect } from 'react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { applyPasswordReset } from '@/server/password';

const ResetSchema = z.object({
  code: z.string().min(5),
  new_password: z.string().min(6, 'Password must be at least 6 characters'),
});

function ResetPasswordInner() {
  const params = useSearchParams();
  const code = params?.get('code') ?? '';
  const router = useRouter();
  const { pushToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!code) {
      pushToast({
        title: 'Reset link invalid',
        description: 'Missing reset code. Request a new link.',
        variant: 'error',
      });
    }
  }, [code, pushToast]);

  const handleSubmit = () => {
    startTransition(async () => {
      const parsed = ResetSchema.safeParse({ code, new_password: password });
      if (!parsed.success || password !== confirm) {
        pushToast({
          title: 'Check your password',
          description: password !== confirm ? 'Passwords do not match.' : parsed.error?.issues[0]?.message,
          variant: 'error',
        });
        return;
      }
      try {
        await applyPasswordReset({ code, new_password: password });
        pushToast({ title: 'Password updated', description: 'Sign in with your new password.', variant: 'success' });
        router.push('/login');
      } catch (error) {
        pushToast({
          title: 'Could not reset password',
          description: error instanceof Error ? error.message : 'Please request a new link.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <div className="min-h-screen bg-[var(--color-background-secondary)]">
      <div className="mx-auto max-w-md px-4 pt-12">
        <h1 className="text-[24px] font-medium text-[var(--color-text-primary)]">Set a new password</h1>
        <p className="mb-8 mt-2 text-[14px] text-[var(--color-text-secondary)]">
          Enter your new password below
        </p>

        <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
                New password
              </p>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5"
                disabled={isPending}
              />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
                Confirm new password
              </p>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5"
                disabled={isPending}
              />
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={handleSubmit}
          disabled={isPending || !code}
          className="mt-5 h-11 w-full"
        >
          {isPending ? 'Updating…' : 'Update password'}
        </Button>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
