'use client';

/**
 * "Show me what I get" before committing five minutes to a form.
 *
 * Uses native <details> rather than React state, matching the collapsible
 * sections in the form itself. That means no hydration dependency: the summary
 * opens even if the client bundle is slow, blocked or broken, which is the
 * right failure mode for the one element whose whole job is reassuring a
 * sceptical visitor.
 *
 * The iframe is lazy so the sample costs nothing for the majority who scroll
 * straight into the form.
 */
import { ANALYTICS_EVENTS, track } from '@/lib/analytics/events';

export function SampleCp12Preview() {
  return (
    <details
      className="group mb-8 rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4 sm:p-5"
      onToggle={(event) => {
        if ((event.currentTarget as HTMLDetailsElement).open) {
          track(ANALYTICS_EVENTS.freeCp12SampleViewed);
        }
      }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            See an example first
          </span>
          <span className="mt-1 block text-[13px] text-[var(--color-text-tertiary)]">
            A filled-in CP12, produced by this tool. Watermarked so it is never mistaken for a real
            record.
          </span>
        </span>
        <span
          aria-hidden
          className="shrink-0 text-[13px] text-[var(--color-text-tertiary)] transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </summary>

      <div className="mt-4">
        <div className="overflow-hidden rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)]">
          <iframe
            src="/api/free-cp12/sample"
            title="Example CP12"
            className="h-[60vh] w-full border-0"
            loading="lazy"
          />
        </div>
        <p className="mt-2 text-[12px] text-[var(--color-text-tertiary)]">
          Not showing?{' '}
          <a className="underline" href="/api/free-cp12/sample" target="_blank" rel="noreferrer">
            Open the example in a new tab
          </a>
          .
        </p>
      </div>
    </details>
  );
}
