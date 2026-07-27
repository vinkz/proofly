'use client';

/**
 * The shared bottom-of-page block on every free tool.
 *
 * Two jobs, in this order: point at the other free tools (an engineer who found
 * one via a link has no idea the others exist), then make the account case
 * once, honestly. Deliberately below the tool and never a modal — someone who
 * came for a certificate should be able to get it and leave.
 */
import Link from 'next/link';

import { ANALYTICS_EVENTS, track } from '@/lib/analytics/events';
import { FREE_TOOLS, FREE_TOOLS_ROUTE } from '@/lib/free-tools';

export function FreeToolFooter({ currentRoute }: { currentRoute: string }) {
  const others = FREE_TOOLS.filter((tool) => tool.route !== currentRoute);

  return (
    <div className="mt-10 border-t-[0.5px] border-[var(--color-border-tertiary)] pt-8">
      {others.length ? (
        <>
          <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            Other free tools
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {others.map((tool) => (
              <Link
                key={tool.route}
                href={tool.route}
                onClick={() => track(ANALYTICS_EVENTS.freeToolCrossLinkClicked, { to: tool.route })}
                className="block rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] p-4 transition-colors hover:bg-[var(--color-background-secondary)]"
              >
                <p className="text-[14px] font-medium text-[var(--color-text-primary)]">{tool.name}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                  {tool.blurb}
                </p>
                <p className="mt-2 text-[12px] text-[var(--color-text-tertiary)]">{tool.effort}</p>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-[13px]">
            <Link href={FREE_TOOLS_ROUTE} className="underline text-[var(--color-text-secondary)]">
              All free tools
            </Link>
          </p>
        </>
      ) : null}

      <div className="mt-8 rounded-[16px] bg-[var(--color-background-secondary)] p-5">
        <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
          Doing more than one of these a month?
        </h2>
        <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
          These tools keep nothing — every certificate starts from a blank form, and we cannot
          re-send one you have lost. An account remembers your details and your customers, keeps
          every certificate you issue, and gives each one a link you can send to the landlord.
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
    </div>
  );
}
