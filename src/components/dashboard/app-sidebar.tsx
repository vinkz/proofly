'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/properties', label: 'Properties', notify: true },
  { href: '/clients', label: 'Clients' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/settings', label: 'Settings' },
];

/**
 * Desktop (>=1024px) primary nav. Pairs with BottomNav (<1024px) so every standard route shares
 * one shell on one breakpoint. Hidden below lg; the mobile header + BottomNav take over there.
 */
export function AppSidebar({ pendingRequestsCount = 0 }: { pendingRequestsCount?: number }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-5 py-7 lg:flex lg:sticky lg:top-0 lg:h-screen">
      <Link href="/dashboard" className="text-2xl font-extrabold tracking-tight text-[var(--brand)]">
        certnow
      </Link>
      <nav className="mt-8 flex flex-col gap-0.5">
        {LINKS.map((link) => {
          const active =
            pathname === link.href || (link.href !== '/dashboard' && Boolean(pathname?.startsWith(link.href)));
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center justify-between rounded-[10px] px-3 py-2 text-[14px] font-medium transition-colors ${
                active
                  ? 'bg-[var(--color-action-bg)] text-[var(--color-action)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-background-tertiary)]'
              }`}
            >
              {link.label}
              {link.notify && pendingRequestsCount > 0 ? (
                <span className="ml-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[10px] bg-[var(--color-red-bg)] px-1.5 text-[11px] font-medium text-[var(--color-red)]">
                  {pendingRequestsCount}
                </span>
              ) : null}
            </Link>
          );
        })}
        <Link
          href="/tools/gas-rate"
          target="_blank"
          rel="noreferrer"
          className="rounded-[10px] px-3 py-2 text-[14px] font-medium text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-background-tertiary)]"
        >
          Gas rate calculator
        </Link>
      </nav>
      <div className="mt-auto text-[12px] text-[var(--color-text-tertiary)]">© {new Date().getFullYear()} certnow</div>
    </aside>
  );
}
