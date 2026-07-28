import type { Metadata } from 'next';

import { FREE_BOILER_SERVICE_NOINDEX, FREE_BOILER_SERVICE_ROUTE } from '@/lib/boiler-service/free-tool';
import { FreeToolFooter } from '@/app/_components/free-tool-footer';
import { FreeBoilerServiceForm } from './_components/free-boiler-service-form';
import { SampleDocumentPreview } from '@/app/_components/sample-document-preview';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';

export const metadata: Metadata = {
  title: 'Free boiler service record generator | CertNow',
  description:
    'Fill in a gas appliance service record and download a complete PDF. No account, no watermark.',
  // Discoverability is controlled by the single FREE_BOILER_SERVICE_NOINDEX flag
  // in @/lib/boiler-service/free-tool. robots.ts reads the same flag.
  ...(FREE_BOILER_SERVICE_NOINDEX ? { robots: { index: false, follow: false } } : {}),
};

export default function FreeBoilerServicePage() {
  return (
    <main className="mx-auto w-full max-w-[860px] px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <p className="text-[12px] font-medium uppercase tracking-[1px] text-[var(--color-text-tertiary)]">
          Free tool
        </p>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight text-[var(--color-text-primary)] sm:text-[34px]">
          Boiler service record
        </h1>
        <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          Fill this in and get a complete gas appliance service record as a PDF. No account, no
          watermark, nothing held back.
        </p>
        {/* Reads as the next sentence of the paragraph above. It sits outside the
            <p> because a paragraph may only contain phrasing content. */}
        <SampleDocumentPreview
          src="/api/free-boiler-service/sample"
          title="Example boiler service record"
          viewedEvent={ANALYTICS_EVENTS.freeBoilerServiceSampleViewed}
        />
        <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-[var(--color-text-tertiary)]">
          Nothing you type here is saved. Close the tab and it is gone — so finish in one sitting.
        </p>
      </header>
      <FreeBoilerServiceForm />
      <FreeToolFooter currentRoute={FREE_BOILER_SERVICE_ROUTE} />
    </main>
  );
}
