import Link from 'next/link';

/**
 * Public marketing header/footer for the blog, matching the landing page chrome
 * in src/app/page.tsx (tokens, hairline borders, pill CTAs).
 */
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 h-14 border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
      <div className="mx-auto flex h-full max-w-[1080px] items-center justify-between px-5">
        <div className="flex items-center gap-5">
          <Link href="/">
            <span className="text-xl font-extrabold tracking-tight text-[var(--brand)]">certnow</span>
          </Link>
          <Link
            href="/blog"
            className="text-[14px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            Blog
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="flex h-9 items-center rounded-[20px] border-[0.5px] border-[var(--color-border-primary)] px-4 text-[14px] text-[var(--color-text-secondary)]"
          >
            Log in
          </Link>
          <Link
            href="/signup/step1"
            className="flex h-9 items-center rounded-[20px] bg-[var(--color-cta)] px-4 text-[14px] font-medium text-[var(--color-cta-fg)]"
          >
            Try free
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-5 py-6">
      <div className="mx-auto max-w-[1080px]">
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
      </div>
    </footer>
  );
}
