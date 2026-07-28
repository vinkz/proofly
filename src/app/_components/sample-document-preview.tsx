'use client';

/**
 * "Show me what I get" — as a sentence in the intro, not a card competing with
 * it. Someone who already wants the document scrolls past a link far more
 * comfortably than a panel.
 *
 * Native <details> rather than React state, matching the collapsible sections
 * in the forms: no hydration dependency, so the sample opens even if the client
 * bundle is slow or blocked. It is rendered just after the intro paragraph
 * rather than inside it, because a <p> may only contain phrasing content —
 * styled to read as the next sentence.
 *
 * The iframe is lazy, so the sample costs nothing for the majority who never
 * open it.
 */
import { track, type AnalyticsEvent } from '@/lib/analytics/events';

export function SampleDocumentPreview({
  src,
  title,
  viewedEvent,
}: {
  src: string;
  /** Names the document in the iframe and for screen readers. */
  title: string;
  viewedEvent: AnalyticsEvent;
}) {
  return (
    <details
      className="group mt-1"
      onToggle={(event) => {
        if ((event.currentTarget as HTMLDetailsElement).open) track(viewedEvent);
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
          <iframe src={src} title={title} className="h-[60vh] w-full border-0" loading="lazy" />
        </div>
        <p className="mt-2 text-[12px] text-[var(--color-text-tertiary)]">
          Watermarked so it is never mistaken for a real record. Not showing?{' '}
          <a className="underline" href={src} target="_blank" rel="noreferrer">
            Open it in a new tab
          </a>
          .
        </p>
      </div>
    </details>
  );
}
