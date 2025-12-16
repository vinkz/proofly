'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { MultiSelect } from '../_components/multi-select';
import { SignupStepShell, loadSignupState, saveSignupState, type SignupState } from '../_components/signup-step-shell';
import { TRADE_TYPES, CERTIFICATIONS } from '@/lib/profile-options';
import { completeSignupWizard } from '@/server/signup-wizard';

const Step3Schema = z.object({
  trade_types: z.array(z.string()).min(1, 'Select at least one trade'),
  certifications: z.array(z.string()).optional(),
});

export default function SignupStep3Page() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [trades, setTrades] = useState<string[]>([]);
  const [certs, setCerts] = useState<string[]>([]);

  useEffect(() => {
    const state = loadSignupState();
    setTrades(state.trade_types ?? []);
    setCerts(state.certifications ?? []);
  }, []);

  const toggle = (value: string, current: string[], setter: (v: string[]) => void) => {
    setter(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  };

  const handleBack = () => router.push('/signup/step2');

  const handleFinish = () => {
    startTransition(async () => {
      const parsed = Step3Schema.safeParse({ trade_types: trades, certifications: certs });
      if (!parsed.success) {
        pushToast({
          title: 'Select at least one trade',
          description: parsed.error.issues[0]?.message ?? 'Pick your trade.',
          variant: 'error',
        });
        return;
      }
      const state: SignupState = {
        ...loadSignupState(),
        trade_types: parsed.data.trade_types,
        certifications: parsed.data.certifications ?? [],
      };
      saveSignupState(state);
      try {
        await completeSignupWizard({
          email: state.email,
          password: state.password,
          full_name: state.full_name,
          date_of_birth: state.date_of_birth,
          profession: state.profession,
          business_name: state.business_name ?? '',
          trade_types: state.trade_types,
          certifications: state.certifications,
        });
        pushToast({ title: 'Welcome to CertNow', description: 'Account created.', variant: 'success' });
        router.push('/dashboard');
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem('proofly_signup_state');
        }
      } catch (error) {
        pushToast({
          title: 'Could not create account',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <SignupStepShell
      step={3}
      total={3}
      title="Choose your trades"
      description="Select the trades and certifications that apply. This shapes your certificates."
    >
      <div className="space-y-6">
        <MultiSelect
          title="Trades"
          subtitle="Pick at least one."
          options={TRADE_TYPES as unknown as string[]}
          selected={trades}
          onToggle={(value) => toggle(value, trades, setTrades)}
        />
        <MultiSelect
          title="Certifications"
          subtitle="Optional. Helps us tailor templates."
          options={CERTIFICATIONS as unknown as string[]}
          selected={certs}
          onToggle={(value) => toggle(value, certs, setCerts)}
        />
      </div>
      <div className="mt-6 flex justify-between">
        <Button variant="outline" onClick={handleBack} disabled={isPending}>
          Back
        </Button>
        <Button onClick={handleFinish} disabled={isPending} className="rounded-full">
          {isPending ? 'Creating…' : 'Create my account'}
        </Button>
      </div>
    </SignupStepShell>
  );
}
