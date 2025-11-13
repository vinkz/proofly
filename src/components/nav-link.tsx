'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export default function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== '/' && pathname?.startsWith(href));
  return (
    <Link
      href={href}
      className={
        active
          ? 'rounded-xl px-3 py-2 bg-gray-100 text-blue-700'
          : 'rounded-xl px-3 py-2 text-gray-600 hover:bg-gray-50'
      }
      prefetch
    >
      {children}
    </Link>
  );
}
