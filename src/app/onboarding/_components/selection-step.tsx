'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { markOnboardingComplete } from '@/server/profile';

interface SelectionStepProps {
  badge: string;
  title: string;
  subtitle: string;
  options: string[];
  initialSelected?: string[];
  onSubmit: (values: string[]) => Promise<void>;
  nextHref: string;
  allowSkip?: boolean;
}

export function SelectionStep({
  badge,
  title,
  subtitle,
  options,
  initialSelected = [],
  onSubmit,
  nextHref,
  allowSkip = true,
}: SelectionStepProps) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [isPending, startTransition] = useTransition();
  const [isSkipping, startSkip] = useTransition();
  const router = useRouter();
  const { pushToast } = useToast();

  const toggle = (value: string) => {
    setSelected((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
  };

  const handleContinue = () => {
    if (selected.length === 0 || isPending) return;
    startTransition(async () => {
      try {
        await onSubmit(selected);
        router.push(nextHref);
      } catch (error) {
        pushToast({
          title: 'Unable to save',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleSkip = () => {
    if (!allowSkip) return;
    startSkip(async () => {
      try {
        await markOnboardingComplete();
        router.push('/dashboard');
      } catch (error) {
        pushToast({
          title: 'Unable to skip',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-xl backdrop-blur">
      <div className="flex flex-col gap-2">
        <span className="w-fit rounded-full bg-[var(--brand)]/10 px-3 py-1 text-xs font-semibold uppercase text-[var(--brand)]">
          {badge}
        </span>
        <h1 className="text-2xl font-bold text-[var(--brand)]">{title}</h1>
        <p className="text-sm text-muted-foreground/80">{subtitle}</p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <Button
              key={option}
              type="button"
              variant="outline"
              onClick={() => toggle(option)}
              className={`flex h-auto items-center justify-between rounded-2xl border px-4 py-3 text-left shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                isSelected
                  ? 'border-[var(--action)] bg-[var(--action)]/10 text-[var(--brand)]'
                  : 'border-white/40 bg-white/70 text-muted hover:border-[var(--accent)]/50'
              }`}
            >
              <span className="font-semibold">{option}</span>
              {isSelected ? (
                <span className="rounded-full bg-[var(--action)] px-3 py-1 text-[11px] font-bold uppercase text-white">
                  Selected
                </span>
              ) : (
                <span className="text-[11px] font-semibold uppercase text-muted-foreground/60">Tap to select</span>
              )}
            </Button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground/70">Pick all that apply. You can change this later in Settings.</p>
        <div className="flex flex-wrap items-center gap-2">
          {allowSkip ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleSkip}
              disabled={isSkipping}
              className="rounded-full"
            >
              {isSkipping ? 'Skipping…' : 'Skip for now'}
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={handleContinue}
            disabled={selected.length === 0 || isPending}
            className="rounded-full bg-[var(--action)] px-5 py-2 text-white hover:bg-emerald-600"
          >
            {isPending ? 'Saving…' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}
