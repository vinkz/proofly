'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { SignupStepShell, loadSignupState, saveSignupState } from '../_components/signup-step-shell';
import { TRADE_TYPES } from '@/lib/profile-options';
import { completeSignupWizard } from '@/server/signup-wizard';

const Step2Schema = z.object({
  date_of_birth: z.string().min(4, 'Date of birth required'),
  profession: z.string().min(2, 'Profession required'),
  company_name: z.string().min(2, 'Company name required'),
  default_engineer_name: z.string().min(2, 'Engineer name required'),
  default_engineer_id: z.string().min(2, 'Engineer ID card number required'),
  gas_safe_number: z.string().min(2, 'Gas Safe number required'),
  business_name: z.string().optional(),
});

const PROFESSION_OPTIONS = [...TRADE_TYPES, 'Other'] as string[];

export default function SignupStep2Page() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    date_of_birth: '',
    profession: '',
    company_name: '',
    default_engineer_name: '',
    default_engineer_id: '',
    gas_safe_number: '',
    business_name: '',
  });
  const [professionChoice, setProfessionChoice] = useState('');

  useEffect(() => {
    const state = loadSignupState();
    setForm({
      date_of_birth: state.date_of_birth ?? '',
      profession: state.profession ?? '',
      company_name: state.company_name ?? state.business_name ?? '',
      default_engineer_name: state.default_engineer_name ?? '',
      default_engineer_id: state.default_engineer_id ?? '',
      gas_safe_number: state.gas_safe_number ?? '',
      business_name: state.business_name ?? '',
    });
    const savedProfession = (state.profession ?? '').trim();
    if (!savedProfession) {
      setProfessionChoice('');
    } else if (PROFESSION_OPTIONS.includes(savedProfession)) {
      setProfessionChoice(savedProfession);
    } else {
      setProfessionChoice('Other');
    }
  }, []);

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleNext = () => {
    startTransition(async () => {
      const parsed = Step2Schema.safeParse(form);
      if (!parsed.success) {
        pushToast({
          title: 'Check your details',
          description: parsed.error.issues[0]?.message ?? 'Please correct the fields.',
          variant: 'error',
        });
        return;
      }
      const state = loadSignupState();
      const nextState = {
        ...state,
        ...parsed.data,
        business_name: parsed.data.company_name,
      };
      saveSignupState(nextState);
      try {
        await completeSignupWizard({
          email: nextState.email,
          password: nextState.password,
          full_name: nextState.full_name,
          date_of_birth: nextState.date_of_birth,
          profession: nextState.profession,
          business_name: nextState.company_name ?? nextState.business_name ?? '',
          company_name: nextState.company_name ?? '',
          default_engineer_name: nextState.default_engineer_name ?? '',
          default_engineer_id: nextState.default_engineer_id ?? '',
          gas_safe_number: nextState.gas_safe_number ?? '',
          trade_types: TRADE_TYPES as unknown as string[],
          certifications: [],
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

  const handleBack = () => router.push('/signup/step1');

  return (
      <SignupStepShell
        step={2}
        total={2}
        title="Tell us about your work"
        description="We tailor certificates and reports to your profession."
      >
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-muted">
          Date of birth
          <Input
            type="date"
            value={form.date_of_birth}
            onChange={update('date_of_birth')}
            className="mt-2"
            disabled={isPending}
          />
        </label>
        <label className="block text-sm font-semibold text-muted">
          Profession
          <Select
            value={professionChoice}
            onChange={(event) => {
              const value = event.target.value;
              setProfessionChoice(value);
              if (value && value !== 'Other') {
                setForm((prev) => ({ ...prev, profession: value }));
              } else if (value === 'Other') {
                setForm((prev) => ({ ...prev, profession: '' }));
              } else {
                setForm((prev) => ({ ...prev, profession: '' }));
              }
            }}
            className="mt-2"
            disabled={isPending}
          >
            <option value="">Select profession</option>
            {PROFESSION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </label>
        {professionChoice === 'Other' ? (
          <label className="block text-sm font-semibold text-muted">
            Profession (manual)
            <Input
              type="text"
              value={form.profession}
              onChange={update('profession')}
              placeholder="Your profession"
              className="mt-2"
              disabled={isPending}
            />
          </label>
        ) : null}
        <label className="block text-sm font-semibold text-muted">
          Company name
          <Input
            type="text"
            value={form.company_name}
            onChange={update('company_name')}
            placeholder="certnow Plumbing Co."
            className="mt-2"
            disabled={isPending}
          />
        </label>
        <label className="block text-sm font-semibold text-muted">
          Engineer name
          <Input
            type="text"
            value={form.default_engineer_name}
            onChange={update('default_engineer_name')}
            placeholder="Alex Turner"
            className="mt-2"
            disabled={isPending}
          />
        </label>
        <label className="block text-sm font-semibold text-muted">
          Engineer ID card number
          <Input
            type="text"
            value={form.default_engineer_id}
            onChange={update('default_engineer_id')}
            placeholder="GS-123456"
            className="mt-2"
            disabled={isPending}
          />
        </label>
        <label className="block text-sm font-semibold text-muted">
          Gas Safe registration number
          <Input
            type="text"
            value={form.gas_safe_number}
            onChange={update('gas_safe_number')}
            placeholder="123456"
            className="mt-2"
            disabled={isPending}
          />
        </label>
      </div>
      <div className="mt-4 flex justify-between">
        <Button variant="outline" onClick={handleBack} disabled={isPending}>
          Back
        </Button>
        <Button onClick={handleNext} disabled={isPending} className="rounded-full">
          {isPending ? 'Creating…' : 'Create my account'}
        </Button>
      </div>
    </SignupStepShell>
  );
}
