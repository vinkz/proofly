import type { Metadata } from 'next';

import { FREE_CP12_NOINDEX, FREE_CP12_ROUTE } from '@/lib/cp12/free-tool';
import { FreeToolFooter } from '@/app/_components/free-tool-footer';
import { FreeCp12Form } from './_components/free-cp12-form';
import { SampleDocumentPreview } from '@/app/_components/sample-document-preview';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';

export const metadata: Metadata = {
  title: 'Free CP12 generator | Landlord Gas Safety Record | CertNow',
  description: 'Create and download a complete Landlord Gas Safety Record PDF.',
  // Discoverability is controlled by the single FREE_CP12_NOINDEX flag in
  // @/lib/cp12/free-tool. robots.ts reads the same flag.
  ...(FREE_CP12_NOINDEX ? { robots: { index: false, follow: false } } : {}),
};

export default function FreeCp12Page() {
  return (
    <main className="mx-auto w-full max-w-[860px] px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <p className="text-[12px] font-medium uppercase tracking-[1px] text-[var(--color-text-tertiary)]">
          Free tool
        </p>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight text-[var(--color-text-primary)] sm:text-[34px]">
          CP12 generator
        </h1>
        <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          Create and download a complete Landlord Gas Safety Record PDF for any gas appliance.
        </p>
        {/* Reads as the next sentence of the paragraph above. It sits outside the
            <p> because a paragraph may only contain phrasing content. */}
        <SampleDocumentPreview
          src="/api/free-cp12/sample"
          title="Example CP12"
          viewedEvent={ANALYTICS_EVENTS.freeCp12SampleViewed}
        />
        <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-[var(--color-text-tertiary)]">
          Your progress is saved in this browser until you download.
        </p>
      </header>
      <FreeCp12Form />
      <FreeToolFooter currentRoute={FREE_CP12_ROUTE} />
    </main>
  );
}
