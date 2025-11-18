import type { ReactNode } from 'react';
import Link from 'next/link';

import RequireAuth from './_components/require-auth';
import NavLink from '@/components/nav-link';
import { Button } from '@/components/ui/button';
import { PageFade } from './_components/page-fade';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/templates', label: 'Workflows' },
  { href: '/clients', label: 'Clients' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings', label: 'Settings' },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <div className="font-sans text-gray-900">
        <div className="min-h-screen bg-[var(--muted)] md:flex">
          <aside className="hidden w-64 flex-col border-r border-white/10 bg-[var(--surface)]/95 px-6 py-8 shadow-md backdrop-blur md:flex md:sticky md:top-0 md:h-screen">
            <div className="text-2xl font-semibold text-[var(--brand)]">Proofly</div>
            <p className="mt-1 text-xs text-gray-500">Compliance, simplified</p>
            <nav className="mt-8 flex flex-col gap-1">
              {links.map((link) => (
                <NavLink key={link.href} href={link.href}>
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-auto text-xs text-gray-400">© {new Date().getFullYear()} Proofly</div>
          </aside>

          <div className="flex min-h-screen flex-1 flex-col">
            <header className="sticky top-0 z-30 border-b border-white/10 bg-[var(--surface)]/90 px-4 py-3 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 md:hidden">
                  <span className="text-lg font-semibold text-[var(--brand)]">Proofly</span>
                  <nav className="flex gap-2 overflow-x-auto">
                    {links.map((link) => (
                      <NavLink key={link.href} href={link.href}>
                        {link.label}
                      </NavLink>
                    ))}
                  </nav>
                </div>
                <div className="hidden md:block" aria-hidden>
                  <span className="text-xl font-semibold text-[var(--brand)]">Proofly</span>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <Button asChild className="rounded-full bg-[var(--accent)] text-white">
                    <Link href="/jobs">New job</Link>
                  </Button>
                  <details className="group relative">
                    <summary className="flex cursor-pointer list-none items-center rounded-full bg-[var(--muted)] px-3 py-1 text-sm font-semibold text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
                      <span className="sr-only">Open user menu</span>
                      <div className="mr-2 h-8 w-8 rounded-full bg-[var(--accent)] text-center text-sm font-bold text-white">
                        PL
                      </div>
                      <svg className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M6 9l6 6 6-6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </summary>
                    <div className="absolute right-0 mt-3 w-48 rounded-xl border border-white/10 bg-[var(--surface)] p-3 text-sm shadow-lg">
                      <p className="font-semibold text-gray-800">Alex Morgan</p>
                      <p className="text-xs text-gray-500">Field Supervisor</p>
                      <div className="my-3 border-t border-gray-100" />
                      <Link href="/settings" className="block rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50">
                        Settings
                      </Link>
                      <form action="/logout" method="post">
                        <button type="submit" className="w-full rounded-lg px-3 py-2 text-left text-red-600 hover:bg-red-50">
                          Sign out
                        </button>
                      </form>
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
    </RequireAuth>
  );
}
