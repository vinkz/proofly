'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { resendSignupConfirmation } from '@/server/auth';

const RESEND_COOLDOWN_SECONDS = 30;

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (cooldown <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    if (!timerRef.current) {
      timerRef.current = setInterval(() => {
        setCooldown((value) => Math.max(0, value - 1));
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [cooldown]);

  const handleResend = () => {
    if (!email) {
      pushToast({
        title: 'Missing email',
        description: 'Go back to sign up and enter your email again.',
        variant: 'error',
      });
      return;
    }
    startTransition(async () => {
      try {
        await resendSignupConfirmation(email);
        setCooldown(RESEND_COOLDOWN_SECONDS);
        pushToast({
          title: 'Confirmation email sent',
          description: `We’ve sent another link to ${email}.`,
          variant: 'success',
        });
      } catch (error) {
        pushToast({
          title: 'Could not resend',
          description: error instanceof Error ? error.message : 'Please try again in a moment.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <div className="pt-10">
      <div
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-action-bg)] text-[22px]"
      >
        ✉️
      </div>
      <h1 className="mt-4 text-[24px] font-medium text-[var(--color-text-primary)]">Verify your email</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
        {email ? (
          <>
            We’ve sent a confirmation link to <span className="font-medium text-[var(--color-text-primary)]">{email}</span>.
            Click it to activate your account and continue setting up your profile.
          </>
        ) : (
          <>We’ve sent you a confirmation link. Click it to activate your account and continue setting up your profile.</>
        )}
      </p>

      <div className="mt-6 rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
          Didn’t get the email?
        </p>
        <ul className="mt-2 space-y-1.5 text-[13px] text-[var(--color-text-secondary)]">
          <li>· Check your spam or junk folder.</li>
          <li>· Make sure {email ? <span className="font-medium text-[var(--color-text-primary)]">{email}</span> : 'the address'} is spelled correctly.</li>
          <li>· Give it a minute — email can be slightly delayed.</li>
        </ul>
        <Button
          variant="secondary"
          onClick={handleResend}
          disabled={isPending || cooldown > 0}
          className="mt-4 h-11 w-full"
        >
          {isPending
            ? 'Sending…'
            : cooldown > 0
              ? `Resend in ${cooldown}s`
              : 'Resend confirmation email'}
        </Button>
      </div>

      <p className="mt-5 text-center text-[13px] text-[var(--color-text-secondary)]">
        Already confirmed?{' '}
        <Link href="/login" className="font-medium text-[var(--color-action)]">
          Sign in
        </Link>
      </p>
      <p className="mt-2 text-center text-[13px] text-[var(--color-text-tertiary)]">
        Wrong address?{' '}
        <Link href="/signup/step1" className="font-medium text-[var(--color-action)]">
          Back to sign up
        </Link>
      </p>
    </div>
  );
}

export default function SignupVerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}
