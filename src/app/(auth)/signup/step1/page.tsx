'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { SignupStepShell, loadSignupState, saveSignupState } from '../_components/signup-step-shell';

const Step1Schema = z
  .object({
    email: z.string().email({ message: 'Valid email required' }),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirm: z.string().min(6, 'Password must be at least 6 characters'),
    full_name: z.string().min(2, 'Full name is required'),
  })
  .refine((data) => data.password === data.confirm, { message: 'Passwords do not match', path: ['confirm'] });

export default function SignupStep1Page() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirm: '',
    full_name: '',
  });

  useEffect(() => {
    const state = loadSignupState();
    setForm((prev) => ({
      ...prev,
      email: state.email,
      password: state.password,
      confirm: state.password,
      full_name: state.full_name,
    }));
  }, []);

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleNext = () => {
    startTransition(async () => {
      const parsed = Step1Schema.safeParse(form);
      if (!parsed.success) {
        pushToast({
          title: 'Check your details',
          description: parsed.error.issues[0]?.message ?? 'Please correct the fields.',
          variant: 'error',
        });
        return;
      }
      const state = loadSignupState();
      saveSignupState({
        ...state,
        email: parsed.data.email,
        password: parsed.data.password,
        full_name: parsed.data.full_name,
      });
      router.push('/signup/step2');
    });
  };

  return (
    <SignupStepShell step={1} total={3} title="Create your account" description="Set your credentials and name.">
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-muted">
          Email
          <Input
            type="email"
            value={form.email}
            onChange={update('email')}
            placeholder="you@example.com"
            className="mt-2"
            disabled={isPending}
          />
        </label>
        <label className="block text-sm font-semibold text-muted">
          Password
          <Input
            type="password"
            value={form.password}
            onChange={update('password')}
            placeholder="••••••••"
            className="mt-2"
            disabled={isPending}
          />
        </label>
        <label className="block text-sm font-semibold text-muted">
          Confirm password
          <Input
            type="password"
            value={form.confirm}
            onChange={update('confirm')}
            placeholder="••••••••"
            className="mt-2"
            disabled={isPending}
          />
        </label>
        <label className="block text-sm font-semibold text-muted">
          Full name
          <Input
            type="text"
            value={form.full_name}
            onChange={update('full_name')}
            placeholder="Alex Morgan"
            className="mt-2"
            disabled={isPending}
          />
        </label>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={handleNext} disabled={isPending} className="rounded-full">
          {isPending ? 'Saving…' : 'Continue'}
        </Button>
      </div>
    </SignupStepShell>
  );
}
