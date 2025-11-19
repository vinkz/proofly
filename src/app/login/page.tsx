'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { signInWithPassword, signInWithMagicLink } from '@/server/auth';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'password' | 'magic'>('password');
  const [isPending, startTransition] = useTransition();

  const handlePasswordLogin = () => {
    startTransition(async () => {
      try {
        await signInWithPassword({ email, password });
        router.push('/');
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
        await signInWithMagicLink(email);
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
    <div className="min-h-screen bg-gradient-to-b from-[var(--muted)] to-white">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10 md:flex-row md:items-start md:justify-between">
        <div className="space-y-4">
          <div className="inline-flex items-center rounded-full bg-[var(--brand)]/10 px-3 py-1 text-xs font-semibold text-[var(--brand)]">
            Proofly • Account access
          </div>
          <h1 className="text-3xl font-bold text-[var(--brand)] sm:text-4xl">Log in</h1>
          <p className="text-sm text-muted-foreground/80">
            Use your password or get a magic link to continue. Need an account?{' '}
            <Link href="/signup/step1" className="font-semibold text-[var(--accent)] underline underline-offset-4">
              Start signup
            </Link>
            .
          </p>
        </div>

        <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/60 bg-white/90 p-6 shadow-xl backdrop-blur">
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
            By continuing, you agree to Proofly&apos;s{' '}
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
      </div>
    </div>
  );
}
