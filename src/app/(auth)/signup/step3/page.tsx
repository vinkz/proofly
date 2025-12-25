'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { MultiSelect } from '../_components/multi-select';
import { SignupStepShell, loadSignupState, saveSignupState, type SignupState } from '../_components/signup-step-shell';
import { TRADE_TYPES, CERTIFICATIONS } from '@/lib/profile-options';
import { completeSignupWizard } from '@/server/signup-wizard';

const defaultTrades = TRADE_TYPES as unknown as string[];

export default function SignupStep3Page() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [certs, setCerts] = useState<string[]>([]);

  useEffect(() => {
    const state = loadSignupState();
    setCerts(state.certifications ?? []);
  }, []);

  const toggle = (value: string, current: string[], setter: (v: string[]) => void) => {
    setter(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  };

  const handleBack = () => router.push('/signup/step2');

  const handleFinish = () => {
    startTransition(async () => {
      const state: SignupState = {
        ...loadSignupState(),
        trade_types: defaultTrades,
        certifications: certs,
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
        pushToast({ title: 'Welcome to certnow', description: 'Account created.', variant: 'success' });
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
      title="Add certifications"
      description="Optional. This helps tailor templates in the future."
    >
      <div className="space-y-6">
        <MultiSelect
          title="Certifications"
          subtitle="Optional."
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
