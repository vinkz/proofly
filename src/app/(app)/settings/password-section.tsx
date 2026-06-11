'use client';

import { useState, useTransition } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { changePassword } from '@/server/password';

const inputClass =
  'mt-1 h-[38px] w-full rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-[11px] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-action)] disabled:opacity-50';

const labelClass = 'text-[11px] font-medium tracking-[0.5px] text-[var(--color-text-tertiary)]';

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
    <section className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
      <div className="border-b-[0.5px] border-[var(--color-border-tertiary)] px-4 py-[14px]">
        <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">Account security</p>
        <h2 className="text-[15px] font-medium text-[var(--color-text-primary)]">Password</h2>
      </div>

      <div className="flex flex-col gap-[12px] p-4">
        {!hasPassword ? (
          <div className="rounded-[8px] border-[0.5px] border-[var(--color-action)]/30 bg-[var(--color-action-bg)] px-3.5 py-2.5 text-[13px] text-[var(--color-action)]">
            Set a password so you can sign in with email and password.
          </div>
        ) : null}

        <div>
          <label className={labelClass}>Email</label>
          <input type="email" value={email} readOnly disabled className={inputClass} />
        </div>

        {hasPassword ? (
          <div>
            <label className={labelClass}>Current password</label>
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

        <div className="grid grid-cols-2 gap-[10px]">
          <div>
            <label className={labelClass}>New password</label>
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
            <label className={labelClass}>Confirm new password</label>
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

        <p className="text-[11px] text-[var(--color-text-tertiary)]">Minimum 6 characters. Both fields must match.</p>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={disabled}
            className="rounded-full bg-[#111] px-[20px] py-[10px] text-[13px] font-medium text-white disabled:opacity-40"
          >
            {isPending ? 'Saving…' : 'Update password'}
          </button>
        </div>
      </div>
    </section>
  );
}
