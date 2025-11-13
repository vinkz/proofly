import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">PlumbLog</h1>
      <p className="mt-2 text-gray-500">
        Snap, sign, and send compliance reports.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/login" className="rounded-md border px-4 py-2">
          Log in
        </Link>
        <Link href="/dashboard" className="rounded-md border px-4 py-2">
          Dashboard
        </Link>
      </div>
    </main>
  );
}
