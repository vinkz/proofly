import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSupabaseUser, supabaseServerReadOnly } from '@/lib/supabaseServer';
import NavLink from '@/components/nav-link';
import { PageFade } from '@/app/(app)/_components/page-fade';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/jobs', label: 'Certificates' },
  { href: '/settings', label: 'Settings' },
];

export default async function WizardLayout({ children }: { children: ReactNode }) {
  const supabase = await supabaseServerReadOnly();
  const user = await getSupabaseUser(supabase);

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="font-sans text-[var(--color-text-primary)]">
      <div className="min-h-screen bg-[var(--color-background-secondary)] md:flex">
        <aside className="hidden w-64 flex-col border-r-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-6 py-8 md:flex md:sticky md:top-0 md:h-screen">
          <div className="text-2xl font-bold text-[var(--brand)] tracking-tight">certnow</div>
          <nav className="mt-8 flex flex-col gap-1">
            {links.map((link) => (
              <NavLink key={link.href} href={link.href}>
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto text-[12px] text-[var(--color-text-tertiary)]">© {new Date().getFullYear()} certnow</div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 h-14 border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
            <div className="flex h-full items-center justify-between gap-4 px-4">
              <div className="flex items-center gap-3">
                <Link href="/dashboard" className="flex items-center gap-2">
                  <span className="text-xl font-extrabold text-[var(--brand)] tracking-tight">certnow</span>
                  <span className="hidden text-[13px] text-[var(--color-text-tertiary)] sm:inline">Field compliance</span>
                </Link>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <details className="relative md:hidden">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-[13px] font-medium text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action)]">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M4 7h16M4 12h16M4 17h16" strokeWidth={2} strokeLinecap="round" />
                    </svg>
                  </summary>
                  <div className="absolute right-0 mt-2 w-56 rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-2">
                    <nav className="flex flex-col gap-1">
                      {links.map((link) => (
                        <NavLink key={link.href} href={link.href}>
                          {link.label}
                        </NavLink>
                      ))}
                    </nav>
                  </div>
                </details>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 pb-8 pt-6 md:px-10">
            <PageFade>{children}</PageFade>
          </main>
        </div>
      </div>
    </div>
  );
}
