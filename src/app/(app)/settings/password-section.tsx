'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { changePassword } from '@/server/password';

export function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useToast();

  const handleSave = () => {
    startTransition(async () => {
      try {
        await changePassword({ current_password: hasPassword ? current : undefined, new_password: next });
        setCurrent('');
        setNext('');
        setConfirm('');
        pushToast({ title: 'Password updated', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Could not update password',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const needsCurrent = hasPassword;
  const disabled =
    isPending ||
    next.length < 6 ||
    next !== confirm ||
    (needsCurrent && !current);

  return (
    <section className="rounded-3xl border border-white/20 bg-white/80 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Account security</p>
          <h2 className="text-lg font-semibold text-muted">Password</h2>
          <p className="text-sm text-muted-foreground/70">
            {hasPassword
              ? 'Change your password. We’ll re-authenticate before saving.'
              : 'You signed up with a magic link. Set a password below.'}
          </p>
        </div>
        <Button onClick={handleSave} disabled={disabled}>
          {isPending ? 'Saving…' : 'Update password'}
        </Button>
      </div>

      {!hasPassword ? (
        <div className="mt-3 rounded-2xl border border-dashed border-[var(--action)]/40 bg-[var(--action)]/10 px-4 py-3 text-sm text-[var(--brand)]">
          You created your account using a magic link. Set a password below.
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {hasPassword ? (
          <label className="block text-sm font-semibold text-muted">
            Current password
            <Input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="••••••••"
              className="mt-2"
              disabled={isPending}
            />
          </label>
        ) : null}
        <label className="block text-sm font-semibold text-muted">
          New password
          <Input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
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
      </div>
      <p className="mt-2 text-xs text-muted-foreground/70">Minimum 6 characters. Passwords must match.</p>
    </section>
  );
}
