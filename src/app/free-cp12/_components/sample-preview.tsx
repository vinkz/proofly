'use client';

/**
 * "Show me what I get" — as a sentence in the intro, not a card competing with
 * it. Someone who already wants the certificate scrolls past a link far more
 * comfortably than a panel.
 *
 * Native <details> rather than React state, matching the collapsible sections
 * in the form: no hydration dependency, so the sample opens even if the client
 * bundle is slow or blocked. It sits just after the intro paragraph rather than
 * inside it, because <p> may only contain phrasing content — styled to read as
 * the next sentence.
 *
 * The iframe is lazy, so the sample costs nothing for the majority who never
 * open it.
 */
import { ANALYTICS_EVENTS, track } from '@/lib/analytics/events';

export function SampleCp12Preview() {
  return (
    <details
      className="group mt-1"
      onToggle={(event) => {
        if ((event.currentTarget as HTMLDetailsElement).open) {
          track(ANALYTICS_EVENTS.freeCp12SampleViewed);
        }
      }}
    >
      <summary className="max-w-[62ch] cursor-pointer list-none text-[15px] leading-relaxed text-[var(--color-text-secondary)] [&::-webkit-details-marker]:hidden">
        Not sure?{' '}
        <span className="underline decoration-[var(--color-border-primary)] underline-offset-2 group-open:no-underline">
          See a sample PDF
        </span>
        <span aria-hidden className="ml-1 inline-block text-[12px] transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>

      <div className="mt-3 max-w-[62ch]">
        <div className="overflow-hidden rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)]">
          <iframe
            src="/api/free-cp12/sample"
            title="Example CP12"
            className="h-[60vh] w-full border-0"
            loading="lazy"
          />
        </div>
        <p className="mt-2 text-[12px] text-[var(--color-text-tertiary)]">
          Watermarked so it is never mistaken for a real record. Not showing?{' '}
          <a className="underline" href="/api/free-cp12/sample" target="_blank" rel="noreferrer">
            Open it in a new tab
          </a>
          .
        </p>
      </div>
    </details>
  );
}
