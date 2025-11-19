'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { markOnboardingComplete } from '@/server/profile';

export function ConfirmationStep({ trades, certifications }: { trades: string[]; certifications: string[] }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isSkipping, startSkip] = useTransition();

  const finish = () => {
    startTransition(async () => {
      try {
        await markOnboardingComplete();
        router.push('/dashboard');
      } catch (error) {
        pushToast({
          title: 'Unable to finish setup',
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
          Step 3 of 3
        </span>
        <h1 className="text-2xl font-bold text-[var(--brand)]">Confirm your setup</h1>
        <p className="text-sm text-muted-foreground/80">
          We’ll use this to show the right workflows, terminology, and reminders for your trade.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <SummaryBlock title="Trades" items={trades} />
        <SummaryBlock title="Certifications" items={certifications} />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <span className="text-xs text-muted-foreground/70">You can edit this anytime in Settings.</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
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
              })
            }
            disabled={isSkipping}
            className="rounded-full"
          >
            {isSkipping ? 'Skipping…' : 'Skip for now'}
          </Button>
          <Button
            type="button"
            onClick={finish}
            disabled={isPending}
            className="rounded-full bg-[var(--action)] px-6 py-2 text-white hover:bg-emerald-600"
          >
            {isPending ? 'Finishing…' : 'Finish setup'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-white/40 bg-white/70 p-4 shadow-inner">
      <p className="text-sm font-semibold text-muted">{title}</p>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground/80">
          {items.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--action)]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground/60">No selections yet.</p>
      )}
    </div>
  );
}
