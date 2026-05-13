'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

type WizardLayoutProps = {
  step: number;
  total: number;
  title: string;
  status?: string;
  onBack?: () => void;
  actions?: ReactNode;
  actionsHideWhenVisibleId?: string;
  children: ReactNode;
};

export function WizardLayout({
  step,
  total,
  title,
  onBack,
  actions,
  actionsHideWhenVisibleId,
  children,
}: WizardLayoutProps) {
  const percent = Math.round((step / total) * 100);
  const [hideActions, setHideActions] = useState(false);

  useEffect(() => {
    if (!actions || !actionsHideWhenVisibleId || typeof window === 'undefined') {
      setHideActions(false);
      return;
    }

    const target = document.getElementById(actionsHideWhenVisibleId);
    if (!target) {
      setHideActions(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setHideActions(entry?.isIntersecting ?? false);
      },
      { threshold: 0.2 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [actions, actionsHideWhenVisibleId]);

  return (
    <div className="min-h-screen bg-[var(--color-background-secondary)]">
      <header className="sticky top-14 z-20 h-14 border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
        <div className="mx-auto flex h-full max-w-2xl items-center gap-3 px-4">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 text-[13px] text-[var(--color-text-secondary)]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Back
            </button>
          ) : (
            <Link
              href="/jobs"
              className="flex items-center gap-1 text-[13px] text-[var(--color-text-secondary)]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Jobs
            </Link>
          )}
          <div className="flex flex-col">
            <p className="text-[11px] text-[var(--color-text-tertiary)]">Step {step} of {total}</p>
            <p className="text-[16px] font-medium text-[var(--color-text-primary)]">{title}</p>
          </div>
          {actions && !hideActions ? <div className="ml-auto">{actions}</div> : null}
        </div>
      </header>

      <div className="h-[4px] w-full bg-[var(--color-background-secondary)]">
        <div
          className="h-full bg-[var(--color-action)] transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <main className="mx-auto max-w-2xl px-4 pb-32 pt-6">{children}</main>
    </div>
  );
}
