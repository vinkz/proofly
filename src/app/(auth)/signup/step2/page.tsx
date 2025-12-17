'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { SignupStepShell, loadSignupState, saveSignupState } from '../_components/signup-step-shell';

const Step2Schema = z.object({
  date_of_birth: z.string().min(4, 'Date of birth required'),
  profession: z.string().min(2, 'Profession required'),
  business_name: z.string().optional(),
});

export default function SignupStep2Page() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    date_of_birth: '',
    profession: '',
    business_name: '',
  });

  useEffect(() => {
    const state = loadSignupState();
    setForm({
      date_of_birth: state.date_of_birth ?? '',
      profession: state.profession ?? '',
      business_name: state.business_name ?? '',
    });
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
      saveSignupState({ ...state, ...parsed.data });
      router.push('/signup/step3');
    });
  };

  const handleBack = () => router.push('/signup/step1');

  return (
    <SignupStepShell
      step={2}
      total={3}
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
          <Input
            type="text"
            value={form.profession}
            onChange={update('profession')}
            placeholder="Plumber, Gas Engineer..."
            className="mt-2"
            disabled={isPending}
          />
        </label>
        <label className="block text-sm font-semibold text-muted">
          Business name (optional)
          <Input
            type="text"
            value={form.business_name}
            onChange={update('business_name')}
            placeholder="certnow Plumbing Co."
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
          {isPending ? 'Saving…' : 'Continue'}
        </Button>
      </div>
    </SignupStepShell>
  );
}
