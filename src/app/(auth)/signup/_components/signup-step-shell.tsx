'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

import { Card } from '@/components/ui/card';
import { ProgressHeader } from './progress-header';

export type SignupState = {
  email: string;
  password: string;
  full_name: string;
  date_of_birth: string;
  profession: string;
  business_name?: string;
  trade_types: string[];
  certifications: string[];
};

const STORAGE_KEY = 'proofly_signup_state';

const defaultState: SignupState = {
  email: '',
  password: '',
  full_name: '',
  date_of_birth: '',
  profession: '',
  business_name: '',
  trade_types: [],
  certifications: [],
};

export function loadSignupState(): SignupState {
  if (typeof window === 'undefined') return defaultState;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as SignupState;
    return { ...defaultState, ...parsed };
  } catch {
    return defaultState;
  }
}

export function saveSignupState(state: SignupState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function SignupStepShell({
  step,
  total = 3,
  title,
  description,
  children,
}: {
  step: number;
  total?: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const stored = loadSignupState();
    if (stored.email === '' && pathname !== '/signup/step1') {
      router.replace('/signup/step1');
    }
  }, [pathname, router]);

  return (
    <div className="space-y-6">
      <ProgressHeader step={step} total={total} />
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-[var(--brand)]">{title}</h1>
        <p className="text-sm text-muted-foreground/80">{description}</p>
      </div>
      <Card className="space-y-4 border border-white/60 bg-white/90 p-6 shadow-xl">{children}</Card>
    </div>
  );
}
