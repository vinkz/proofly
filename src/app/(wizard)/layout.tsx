import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import NavLink from '@/components/nav-link';
import { PageFade } from '@/app/(app)/_components/page-fade';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/jobs', label: 'Certificates' },
  { href: '/clients', label: 'Clients' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings', label: 'Settings' },
];

export default async function WizardLayout({ children }: { children: ReactNode }) {
  const supabase = await supabaseServerReadOnly();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="font-sans text-gray-900">
      <div className="min-h-screen bg-[var(--muted)] md:flex">
        <aside className="hidden w-64 flex-col border-r border-white/10 bg-[var(--surface)]/95 px-6 py-8 shadow-md backdrop-blur md:flex md:sticky md:top-0 md:h-screen">
          <div className="text-2xl font-bold text-[var(--brand)] tracking-tight">certnow</div>
          <p className="mt-1 text-xs text-gray-500">Certificates, simplified</p>
          <nav className="mt-8 flex flex-col gap-1">
            {links.map((link) => (
              <NavLink key={link.href} href={link.href}>
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto text-xs text-gray-400">© {new Date().getFullYear()} certnow</div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-[var(--surface)]/90 px-4 py-3 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Link href="/dashboard" className="flex items-center gap-2">
                  <span className="text-xl font-extrabold text-[var(--brand)] tracking-tight">certnow</span>
                  <span className="hidden text-xs font-medium text-gray-500 sm:inline">Field compliance</span>
                </Link>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <details className="relative md:hidden">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-white/20 bg-white/70 px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M4 7h16M4 12h16M4 17h16" strokeWidth={2} strokeLinecap="round" />
                    </svg>
                  </summary>
            <div className="absolute right-0 mt-3 w-64 rounded-md border border-white/10 bg-[var(--surface)] p-3 shadow-xl">
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
