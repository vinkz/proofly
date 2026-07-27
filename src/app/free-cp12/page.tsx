import type { Metadata } from 'next';

import { FREE_CP12_NOINDEX } from '@/lib/cp12/free-tool';
import { FreeCp12Form } from './_components/free-cp12-form';

export const metadata: Metadata = {
  title: 'Free CP12 generator — Landlord Gas Safety Record | CertNow',
  description:
    'Fill in a Landlord Gas Safety Record and download a complete CP12 PDF. No account, no watermark.',
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
          Fill this in and get a complete Landlord Gas Safety Record as a PDF. No account, no
          watermark, nothing held back. It covers every gas appliance type, not just boilers.
        </p>
        <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-[var(--color-text-tertiary)]">
          Nothing you type here is saved. Close the tab and it is gone — so finish in one sitting.
        </p>
      </header>
      <FreeCp12Form />
    </main>
  );
}
