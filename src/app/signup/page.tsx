'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { z } from 'zod';

import { signUpWithPassword } from '@/server/auth';
import { useToast } from '@/components/ui/use-toast';
import { TRADE_TYPES, CERTIFICATIONS } from '@/lib/profile-options';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const SignupSchema = z.object({
  email: z.string().email({ message: 'Valid email required' }),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(2, 'Name is required'),
  date_of_birth: z.string().min(4, 'Date of birth required'),
  profession: z.string().min(2, 'Profession required'),
  trade_types: z.array(z.string()).min(1, 'Select at least one trade'),
  certifications: z.array(z.string()).optional(),
});

export default function SignupPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    date_of_birth: '',
    profession: '',
    trade_types: [] as string[],
    certifications: [] as string[],
  });
  const [isPending, startTransition] = useTransition();

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const toggleArray = (key: 'trade_types' | 'certifications', value: string) => {
    setForm((prev) => {
      const current = prev[key];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  const handleSubmit = () => {
    startTransition(async () => {
      const parsed = SignupSchema.safeParse(form);
      if (!parsed.success) {
        pushToast({
          title: 'Check your details',
          description: parsed.error.issues[0]?.message ?? 'Please correct the fields.',
          variant: 'error',
        });
        return;
      }
      try {
        await signUpWithPassword(parsed.data);
        pushToast({ title: 'Account created', description: 'Welcome to Proofly.', variant: 'success' });
        router.push('/dashboard');
      } catch (error) {
        pushToast({
          title: 'Could not sign up',
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
            Proofly • Signup
          </div>
          <h1 className="text-3xl font-bold text-[var(--brand)] sm:text-4xl">Create your account</h1>
          <p className="text-sm text-muted-foreground/80">
            Set up your credentials and a few details so we can personalise your workflows.
          </p>
        </div>

        <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/60 bg-white/90 p-6 shadow-xl backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Account</p>
            <h2 className="text-xl font-semibold text-[var(--brand)]">Sign up with email and password</h2>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-muted">
              Email
              <Input
                value={form.email}
                onChange={update('email')}
                type="email"
                required
                placeholder="you@example.com"
                className="mt-2"
                disabled={isPending}
              />
            </label>
            <label className="block text-sm font-semibold text-muted">
              Password
              <Input
                value={form.password}
                onChange={update('password')}
                type="password"
                required
                placeholder="••••••••"
                className="mt-2"
                disabled={isPending}
              />
            </label>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-muted">
              Full name
              <Input
                value={form.full_name}
                onChange={update('full_name')}
                type="text"
                required
                placeholder="Alex Morgan"
                className="mt-2"
                disabled={isPending}
              />
            </label>
            <label className="block text-sm font-semibold text-muted">
              Date of birth
              <Input
                value={form.date_of_birth}
                onChange={update('date_of_birth')}
                type="date"
                required
                className="mt-2"
                disabled={isPending}
              />
            </label>
            <label className="block text-sm font-semibold text-muted">
              Profession
              <Input
                value={form.profession}
                onChange={update('profession')}
                type="text"
                required
                placeholder="Plumber, Gas Engineer..."
                className="mt-2"
                disabled={isPending}
              />
            </label>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-muted">Trades</p>
              <p className="text-xs text-muted-foreground/70">Select all that apply.</p>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {TRADE_TYPES.map((trade) => {
                const selected = form.trade_types.includes(trade);
                return (
                  <button
                    key={trade}
                    type="button"
                    onClick={() => toggleArray('trade_types', trade)}
                    className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-left text-sm transition ${
                      selected
                        ? 'border-[var(--action)] bg-[var(--action)]/10 text-[var(--brand)]'
                        : 'border-white/50 bg-white/80 text-muted hover:border-[var(--accent)]/40'
                    }`}
                    disabled={isPending}
                  >
                    <span>{trade}</span>
                    {selected ? (
                      <span className="rounded-full bg-[var(--action)] px-2 py-1 text-[11px] font-bold uppercase text-white">
                        Selected
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold uppercase text-muted-foreground/60">Tap</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-muted">Certifications</p>
              <p className="text-xs text-muted-foreground/70">Optional. Helps tailor workflows.</p>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {CERTIFICATIONS.map((cert) => {
                const selected = form.certifications.includes(cert);
                return (
                  <button
                    key={cert}
                    type="button"
                    onClick={() => toggleArray('certifications', cert)}
                    className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-left text-sm transition ${
                      selected
                        ? 'border-[var(--action)] bg-[var(--action)]/10 text-[var(--brand)]'
                        : 'border-white/50 bg-white/80 text-muted hover:border-[var(--accent)]/40'
                    }`}
                    disabled={isPending}
                  >
                    <span>{cert}</span>
                    {selected ? (
                      <span className="rounded-full bg-[var(--action)] px-2 py-1 text-[11px] font-bold uppercase text-white">
                        Selected
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold uppercase text-muted-foreground/60">Tap</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full rounded-full bg-[var(--action)] px-4 py-3 text-sm font-semibold text-white shadow-md"
          >
            {isPending ? 'Creating account…' : 'Create account'}
          </Button>
        </div>
      </div>
    </div>
  );
}
