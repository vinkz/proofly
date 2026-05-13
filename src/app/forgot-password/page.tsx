'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { requestPasswordReset } from '@/server/password';

const EmailSchema = z.object({
  email: z.string().email({ message: 'Enter a valid email' }),
});

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useToast();

  const handleSubmit = () => {
    startTransition(async () => {
      const parsed = EmailSchema.safeParse({ email });
      if (!parsed.success) {
        pushToast({
          title: 'Invalid email',
          description: parsed.error.issues[0]?.message ?? 'Check your email and try again.',
          variant: 'error',
        });
        return;
      }
      try {
        await requestPasswordReset(parsed.data.email);
        setSent(true);
        pushToast({ title: 'Check your email', description: 'Reset link sent.', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Could not send reset link',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <div className="min-h-screen bg-[var(--color-background-secondary)]">
      <div className="mx-auto max-w-md px-4 pt-12">
        <Link
          href="/login"
          className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-tertiary)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back to sign in
        </Link>

        <h1 className="text-[24px] font-medium text-[var(--color-text-primary)]">Reset your password</h1>
        <p className="mb-8 mt-2 text-[14px] text-[var(--color-text-secondary)]">
          We&apos;ll send a reset link to your email
        </p>

        <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
            Email
          </p>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            placeholder="you@example.com"
            className="mt-1.5"
            disabled={isPending || sent}
          />
        </div>

        {sent ? (
          <div className="mt-5 flex items-center gap-3 rounded-[12px] bg-[var(--color-action-bg)] px-4 py-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--color-action)]" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <p className="text-[13px] font-medium text-[var(--color-action)]">
              Check your email for a reset link
            </p>
          </div>
        ) : (
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            disabled={isPending || !email}
            className="mt-5 h-11 w-full"
          >
            {isPending ? 'Sending…' : 'Send reset link'}
          </Button>
        )}
      </div>
    </div>
  );
}
