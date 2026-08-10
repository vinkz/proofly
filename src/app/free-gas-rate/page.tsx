import type { Metadata } from 'next';

import { FREE_GAS_RATE_NOINDEX, FREE_GAS_RATE_ROUTE } from '@/lib/gas-rate/free-tool';
import { FreeToolFooter } from '@/app/_components/free-tool-footer';
import { FreeGasRateClient } from './_components/free-gas-rate-client';

export const metadata: Metadata = {
  title: 'Gas rate calculator | Timed meter test | CertNow',
  description: 'Calculate gas rate and heat input from a metric or imperial timed meter test.',
  ...(FREE_GAS_RATE_NOINDEX ? { robots: { index: false, follow: false } } : {}),
};

export default function FreeGasRatePage() {
  return (
    <main className="mx-auto w-full max-w-[860px] px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <p className="text-[12px] font-medium uppercase tracking-[1px] text-[var(--color-text-tertiary)]">
          Free tool
        </p>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight text-[var(--color-text-primary)] sm:text-[34px]">
          Gas rate calculator
        </h1>
        <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          Calculate heat input from a metric or imperial timed meter test, with the working shown.
        </p>
      </header>
      <FreeGasRateClient />
      <FreeToolFooter currentRoute={FREE_GAS_RATE_ROUTE} />
    </main>
  );
}
