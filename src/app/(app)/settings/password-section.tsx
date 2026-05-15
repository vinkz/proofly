'use client';

import { useState, useTransition } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { changePassword } from '@/server/password';

const inputClass =
  'mt-1.5 h-[38px] w-full rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-action)] disabled:opacity-50';

export function PasswordSection({ hasPassword, email }: { hasPassword: boolean; email: string }) {
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

  const disabled = isPending || next.length < 6 || next !== confirm || (hasPassword && !current);

  return (
    <section className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Account security</p>
      <h2 className="mt-1 text-[16px] font-semibold text-[var(--color-text-primary)]">Password</h2>
      <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
        {hasPassword
          ? "Change your password. We'll re-authenticate before saving."
          : 'You signed up with a magic link. Set a password below.'}
      </p>

      {!hasPassword ? (
        <div className="mt-3 rounded-[10px] border-[0.5px] border-[var(--color-action)]/30 bg-[var(--color-action-bg)] px-3.5 py-2.5 text-[13px] text-[var(--color-action)]">
          Set a password so you can sign in with email and password.
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Email</label>
          <input type="email" value={email} readOnly disabled className={inputClass} />
        </div>
        {hasPassword ? (
          <div>
            <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Current password</label>
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
              disabled={isPending}
            />
          </div>
        ) : null}
        <div>
          <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">New password</label>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="••••••••"
            className={inputClass}
            disabled={isPending}
          />
        </div>
        <div>
          <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Confirm new password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className={inputClass}
            disabled={isPending}
          />
        </div>
      </div>
      <p className="mt-2 text-[11px] text-[var(--color-text-tertiary)]">Minimum 6 characters. Both fields must match.</p>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled}
          className="h-[38px] rounded-[10px] bg-[#111] px-5 text-[13px] font-medium text-white disabled:opacity-40"
        >
          {isPending ? 'Saving…' : 'Update password'}
        </button>
      </div>
    </section>
  );
}
