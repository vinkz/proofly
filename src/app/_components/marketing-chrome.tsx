import Link from 'next/link';

import { Button } from '@/components/ui/button';

/**
 * Shared public marketing chrome, extracted from the landing page so every
 * marketing surface (/, /blog, …) renders the identical header and footer.
 * Styling reference: DESIGN_TOKENS.md.
 */
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 h-14 border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
      <div className="flex h-full items-center justify-between px-5">
        <div className="flex items-baseline gap-5">
          <Link href="/">
            <span className="text-xl font-extrabold tracking-tight text-[var(--brand)]">certnow</span>
          </Link>
          <Link
            href="/blog"
            className="text-[14px] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            Blog
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="h-9 px-4 text-[14px] font-normal text-[var(--color-text-secondary)]">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild variant="primary" className="h-9 px-4 text-[14px]">
            <Link href="/signup/step1">Try free</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-5 py-6">
      <p className="mb-2 text-[15px] font-medium text-[var(--color-text-primary)]">certnow</p>
      <p className="mb-4 text-[13px] leading-[1.6] text-[var(--color-text-tertiary)]">
        Built for Gas Safe engineers in the UK. certnow.uk
      </p>
      <div className="flex gap-5">
        <Link href="/blog" className="text-[13px] text-[var(--color-text-secondary)]">
          Blog
        </Link>
        {['Privacy', 'Terms', 'Contact'].map((l) => (
          <Link key={l} href="#" className="text-[13px] text-[var(--color-text-secondary)]">
            {l}
          </Link>
        ))}
      </div>
    </footer>
  );
}
