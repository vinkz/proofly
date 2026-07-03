import { notFound } from 'next/navigation';

// Dev-only utility pages (e.g. /dev/storage-test) must never ship to production.
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return <>{children}</>;
}
