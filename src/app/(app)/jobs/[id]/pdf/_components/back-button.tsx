'use client';

import Link from 'next/link';

export function DocumentBackButton({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="w-fit rounded-full border border-white/50 bg-white/90 px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm"
    >
      ← Back
    </Link>
  );
}
