import type { Metadata } from 'next';

import { FREE_BOILER_SERVICE_NOINDEX } from '@/lib/boiler-service/free-tool';
import { FreeBoilerServiceForm } from './_components/free-boiler-service-form';

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
        <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-[var(--color-text-tertiary)]">
          Nothing you type here is saved. Close the tab and it is gone — so finish in one sitting.
        </p>
      </header>
      <FreeBoilerServiceForm />
    </main>
  );
}
