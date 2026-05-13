'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { signInWithPassword, signInWithMagicLink } from '@/server/auth';
import { GoogleAuthButton } from '@/components/auth/google-auth-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'password' | 'magic'>('password');
  const [isPending, startTransition] = useTransition();
  const nextPathParam = searchParams.get('next');
  const nextPath = nextPathParam?.startsWith('/') && !nextPathParam.startsWith('//') ? nextPathParam : '/';

  const handlePasswordLogin = () => {
    startTransition(async () => {
      try {
        await signInWithPassword({ email, password });
        router.push(nextPath);
      } catch (error) {
        pushToast({
          title: 'Login failed',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleMagicLink = () => {
    startTransition(async () => {
      try {
        await signInWithMagicLink(email, nextPath);
        pushToast({
          title: 'Check your email',
          description: 'Magic link sent. Open it to continue.',
          variant: 'success',
        });
      } catch (error) {
        pushToast({
          title: 'Could not send link',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <div>
      <GoogleAuthButton nextPath={nextPath} />

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--color-border-tertiary)]" />
        <span className="text-[12px] text-[var(--color-text-tertiary)]">or continue with email</span>
        <span className="h-px flex-1 bg-[var(--color-border-tertiary)]" />
      </div>

      <div className="flex rounded-[22px] bg-[var(--color-background-secondary)] p-[3px]">
        <button
          type="button"
          onClick={() => setAuthMode('password')}
          className={`flex h-9 flex-1 items-center justify-center rounded-[20px] text-[14px] transition-colors ${
            authMode === 'password'
              ? 'border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] font-medium text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-tertiary)]'
          }`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setAuthMode('magic')}
          className={`flex h-9 flex-1 items-center justify-center rounded-[20px] text-[14px] transition-colors ${
            authMode === 'magic'
              ? 'border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] font-medium text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-tertiary)]'
          }`}
        >
          Magic link
        </button>
      </div>

      <div className="mt-4 rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
              Work email
            </p>
            <Input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
              placeholder="you@example.com"
              className="mt-1.5"
              disabled={isPending}
            />
          </div>

          {authMode === 'password' ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
                Password
              </p>
              <Input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                required
                placeholder="••••••••"
                className="mt-1.5"
                disabled={isPending}
              />
            </div>
          ) : null}
        </div>
      </div>

      {authMode === 'password' ? (
        <div className="mt-2 text-right">
          <Link href="/forgot-password" className="text-[13px] text-[var(--color-text-tertiary)]">
            Forgot password?
          </Link>
        </div>
      ) : null}

      <Button
        type="button"
        variant="primary"
        onClick={authMode === 'password' ? handlePasswordLogin : handleMagicLink}
        disabled={isPending || (authMode === 'password' ? !email || !password : !email)}
        className="mt-5 h-11 w-full"
      >
        {isPending
          ? authMode === 'password'
            ? 'Signing in…'
            : 'Sending link…'
          : authMode === 'password'
            ? 'Sign in'
            : 'Send magic link'}
      </Button>

      <p className="mt-5 text-center text-[13px] text-[var(--color-text-secondary)]">
        Don&apos;t have an account?{' '}
        <Link href="/signup/step1" className="font-medium text-[var(--color-action)]">
          Sign up
        </Link>
      </p>

      <p className="mt-4 text-center text-[11px] text-[var(--color-text-tertiary)]">
        By continuing, you agree to certnow&apos;s{' '}
        <Link href="/legal/terms" className="text-[var(--color-action)]">
          Terms
        </Link>{' '}
        and{' '}
        <Link href="/legal/privacy" className="text-[var(--color-action)]">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
