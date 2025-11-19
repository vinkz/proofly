'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, useEffect } from 'react';
import { z } from 'zod';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { applyPasswordReset } from '@/server/password';

const ResetSchema = z.object({
  code: z.string().min(5),
  new_password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function ResetPasswordPage() {
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
    <div className="min-h-screen bg-gradient-to-b from-[var(--muted)] to-white">
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-10">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Password reset</p>
          <h1 className="text-3xl font-bold text-[var(--brand)]">Set a new password</h1>
          <p className="text-sm text-muted-foreground/80">Enter your new password below.</p>
        </div>
        <Card className="space-y-4 border border-white/50 bg-white/90 p-6 shadow">
          <label className="block text-sm font-semibold text-muted">
            New password
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-2"
              disabled={isPending}
            />
          </label>
          <label className="block text-sm font-semibold text-muted">
            Confirm new password
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="mt-2"
              disabled={isPending}
            />
          </label>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !code}
            className="w-full rounded-full bg-[var(--action)] text-white"
          >
            {isPending ? 'Updating…' : 'Update password'}
          </Button>
        </Card>
      </div>
    </div>
  );
}
