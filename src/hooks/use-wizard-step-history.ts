'use client';

import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

type WizardHistoryState = {
  __certnowWizardKey?: string;
  step?: number;
};

type UseWizardStepHistoryOptions = {
  enabled?: boolean;
  key: string;
  maxStep: number;
  minStep?: number;
  setStep: Dispatch<SetStateAction<number>>;
  step: number;
};

const clampStep = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function useWizardStepHistory({
  enabled = true,
  key,
  maxStep,
  minStep = 1,
  setStep,
  step,
}: UseWizardStepHistoryOptions) {
  const initializedRef = useRef(false);
  const applyingPopRef = useRef(false);
  const initialStepRef = useRef(step);
  const previousStepRef = useRef(step);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const nextState: WizardHistoryState = {
      ...(window.history.state ?? {}),
      __certnowWizardKey: key,
      step: clampStep(initialStepRef.current, minStep, maxStep),
    };
    window.history.replaceState(nextState, '', window.location.href);
    initializedRef.current = true;
    previousStepRef.current = initialStepRef.current;

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as WizardHistoryState | null;
      if (state?.__certnowWizardKey === key && typeof state.step === 'number') {
        applyingPopRef.current = true;
        const nextStep = clampStep(state.step, minStep, maxStep);
        previousStepRef.current = nextStep;
        setStep(nextStep);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [enabled, key, maxStep, minStep, setStep]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !initializedRef.current) return;
    const nextStep = clampStep(step, minStep, maxStep);
    if (previousStepRef.current === nextStep) return;

    if (applyingPopRef.current) {
      applyingPopRef.current = false;
      previousStepRef.current = nextStep;
      return;
    }

    window.history.pushState(
      {
        ...(window.history.state ?? {}),
        __certnowWizardKey: key,
        step: nextStep,
      },
      '',
      window.location.href,
    );
    previousStepRef.current = nextStep;
  }, [enabled, key, maxStep, minStep, step]);
}
