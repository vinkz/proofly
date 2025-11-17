import type { ReactNode } from 'react';

export default function NewJobLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[var(--muted)] px-4 py-6 md:px-8">{children}</div>;
}
