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
    <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/60 bg-white/90 p-6 shadow-xl backdrop-blur">
      <GoogleAuthButton nextPath={nextPath} />

      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        <span className="h-px flex-1 bg-slate-200" />
        <span>Or continue with email</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Auth method</p>
          <h2 className="text-xl font-semibold text-[var(--brand)]">
            {authMode === 'password' ? 'Email + password' : 'Magic link'}
          </h2>
        </div>
        <div className="flex rounded-full bg-[var(--muted)] p-1 text-xs font-semibold text-gray-600">
          <button
            type="button"
            onClick={() => setAuthMode('password')}
            className={`rounded-full px-3 py-1 transition ${authMode === 'password' ? 'bg-white text-[var(--brand)] shadow' : ''}`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('magic')}
            className={`rounded-full px-3 py-1 transition ${authMode === 'magic' ? 'bg-white text-[var(--brand)] shadow' : ''}`}
          >
            Magic link
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-semibold text-muted">
          Work email
          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
            placeholder="you@example.com"
            className="mt-2"
            disabled={isPending}
          />
        </label>

        {authMode === 'password' ? (
          <label className="block text-sm font-semibold text-muted">
            Password
            <Input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
              placeholder="••••••••"
              className="mt-2"
              disabled={isPending}
            />
          </label>
        ) : null}
      </div>

      {authMode === 'password' ? (
        <Button
          type="button"
          onClick={handlePasswordLogin}
          disabled={isPending || !email || !password}
          className="w-full rounded-full bg-[var(--action)] px-4 py-3 text-sm font-semibold text-white shadow-md"
        >
          {isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      ) : (
        <Button
          type="button"
          onClick={handleMagicLink}
          disabled={isPending || !email}
          className="w-full rounded-full bg-[var(--action)] px-4 py-3 text-sm font-semibold text-white shadow-md"
        >
          {isPending ? 'Sending link…' : 'Send magic link'}
        </Button>
      )}

      {authMode === 'password' ? (
        <Link
          href="/forgot-password"
          className="text-xs font-semibold text-[var(--accent)] underline underline-offset-4"
        >
          Forgot password?
        </Link>
      ) : null}

      <p className="text-xs text-muted-foreground/70">
        By continuing, you agree to certnow&apos;s{' '}
        <Link href="/legal/terms" className="font-semibold text-[var(--accent)] underline underline-offset-4">
          Terms
        </Link>{' '}
        and{' '}
        <Link href="/legal/privacy" className="font-semibold text-[var(--accent)] underline underline-offset-4">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
