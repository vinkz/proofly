'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

type WizardLayoutProps = {
  step: number;
  total: number;
  title: string;
  status?: string;
  onBack?: () => void;
  actions?: ReactNode;
  actionsHideWhenVisibleId?: string;
  children: ReactNode;
  /**
   * `step` is the wizard: its own sticky header, progress bar, back button and
   * action bar, one screen at a time.
   *
   * `section` is the same content stacked into a single-page form — a heading
   * and the children, nothing else. The per-step chrome is exactly what makes
   * four of these unreadable in a row, and the navigation it provides has no
   * meaning when everything is already on screen.
   */
  variant?: 'step' | 'section';
  /** Small control beside the step counter — used for the layout toggle. */
  headerAction?: ReactNode;
};

export function WizardLayout({
  step,
  total,
  title,
  onBack,
  actions,
  actionsHideWhenVisibleId,
  children,
  variant = 'step',
  headerAction,
}: WizardLayoutProps) {
  const router = useRouter();
  const isSection = variant === 'section';
  const percent = Math.round((step / total) * 100);

  /**
   * Back means the page before this one.
   *
   * With no step to retreat to, this fell back to a link to /jobs — so leaving
   * a certificate always landed on the full job list, whichever screen the
   * engineer had actually come from. History is what "back" means everywhere
   * else in a browser; /jobs is only the answer when there is no history to
   * return to, which is the case for a link opened cold.
   */
  const goBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/jobs');
  }, [router]);
  const [hideActions, setHideActions] = useState(false);

  useEffect(() => {
    if (isSection || !actions || !actionsHideWhenVisibleId || typeof window === 'undefined') {
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
  }, [actions, actionsHideWhenVisibleId, isSection]);

  if (isSection) {
    return (
      <section className="mb-8 scroll-mt-32">
        <h2 className="mb-4 border-b-[0.5px] border-[var(--color-border-tertiary)] pb-2 text-[18px] font-medium text-[var(--color-text-primary)]">
          {title}
        </h2>
        {children}
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background-secondary)]">
      <header className="sticky top-14 z-20 border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-4 pt-3">
        <div className="mx-auto flex max-w-2xl items-center">
          <div className="flex flex-1 items-center">
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
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-1 text-[13px] text-[var(--color-text-secondary)]"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                Back
              </button>
            )}
          </div>
          <span className="flex items-center gap-3 text-[11px] text-[var(--color-text-tertiary)]">
            Step {step} of {total}
            {headerAction}
          </span>
          <div className="flex flex-1 justify-end">
            {/* Keep the node mounted and only toggle visibility. Unmounting it
                changed the sticky header's height, which shifted the observed
                footer across the IntersectionObserver threshold and caused an
                infinite setHideActions(true/false) layout-thrash loop. */}
            {actions ? (
              <div className={hideActions ? 'invisible' : undefined} aria-hidden={hideActions}>
                {actions}
              </div>
            ) : null}
          </div>
        </div>
        <div className="mx-auto mb-[10px] mt-[10px] max-w-2xl">
          <p className="text-[18px] font-medium text-[var(--color-text-primary)]">{title}</p>
        </div>
      </header>

      <div className="h-[3px] w-full bg-[var(--color-border-tertiary)]">
        <div
          className="h-full bg-[#1a7a52] transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <main className="mx-auto max-w-2xl px-4 pb-32 pt-6">{children}</main>
    </div>
  );
}
