import type { ReactNode } from 'react';

import { MarketingFooter, MarketingHeader } from './_components/marketing-chrome';

export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-background-primary)] text-[var(--color-text-primary)]">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
