import type { Metadata } from 'next';
import Link from 'next/link';

import { FREE_TOOLS, FREE_TOOLS_HUB_NOINDEX, indexableFreeTools } from '@/lib/free-tools';

export const metadata: Metadata = {
  title: 'Free tools for Gas Safe engineers | CertNow',
  description:
    'Free certificate generators and calculators for Gas Safe engineers. No account, no watermark.',
  ...(FREE_TOOLS_HUB_NOINDEX ? { robots: { index: false, follow: false } } : {}),
};

/**
 * The hub. Shows every tool to a visitor — someone given the link should see
 * everything on offer — but a tool still controls its own indexability through
 * its own flag, and the hub hides itself entirely when none are public.
 */
export default function FreeToolsPage() {
  const live = indexableFreeTools().length;

  return (
    <main className="mx-auto w-full max-w-[860px] px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <p className="text-[12px] font-medium uppercase tracking-[1px] text-[var(--color-text-tertiary)]">
          Free tools
        </p>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight text-[var(--color-text-primary)] sm:text-[34px]">
          Free tools for Gas Safe engineers
        </h1>
        <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          Real, complete documents. No account, no watermark, nothing held back. Built by the team
          behind CertNow because we needed them ourselves.
        </p>
      </header>

      <div className="grid gap-4">
        {FREE_TOOLS.map((tool) => (
          <Link
            key={tool.route}
            href={tool.route}
            className="block rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5 transition-colors hover:bg-[var(--color-background-secondary)]"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[17px] font-semibold text-[var(--color-text-primary)]">{tool.name}</h2>
              <span className="text-[12px] text-[var(--color-text-tertiary)]">{tool.effort}</span>
            </div>
            <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
              {tool.blurb}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-10 rounded-[16px] bg-[var(--color-background-secondary)] p-5">
        <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
          What the free tools do not do
        </h2>
        <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
          They keep nothing. Every certificate starts from a blank form, we cannot re-send one you
          have lost, and there is no record to reissue. That is fine for the occasional job. If you
          are doing several a week, an account remembers your details and your customers, keeps
          every certificate, and gives each one a link for the landlord.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href="/signup/step1"
            className="inline-flex items-center justify-center rounded-full bg-[var(--color-cta)] px-5 py-2.5 text-sm font-medium text-[var(--color-cta-fg)] transition-colors hover:bg-[var(--color-text-primary)]"
          >
            Create a free account
          </Link>
          <span className="text-[13px] text-[var(--color-text-tertiary)]">No card required</span>
        </div>
      </div>

      {live === 0 ? (
        <p className="mt-6 text-[12px] text-[var(--color-text-tertiary)]">
          These tools are not yet listed in search results.
        </p>
      ) : null}
    </main>
  );
}
