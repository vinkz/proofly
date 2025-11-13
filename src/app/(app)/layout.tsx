import type { ReactNode } from 'react';

import RequireAuth from './_components/require-auth';
import NavLink from '@/components/nav-link';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/templates', label: 'Templates' },
  { href: '/clients', label: 'Clients' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings', label: 'Settings' },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
        <aside className="hidden border-r bg-white p-4 md:flex md:flex-col md:gap-4">
          <div className="text-lg font-semibold">PlumbLog</div>
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <NavLink key={link.href} href={link.href}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <div className="flex flex-col">
          <header className="flex items-center justify-between border-b bg-white px-4 py-3 md:hidden">
            <div className="text-lg font-semibold">PlumbLog</div>
            <nav className="flex gap-2 overflow-x-auto">
              {links.map((link) => (
                <NavLink key={link.href} href={link.href}>
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </header>
          <main className="flex-1 bg-gray-50 p-4">{children}</main>
        </div>
      </div>
    </RequireAuth>
  );
}
