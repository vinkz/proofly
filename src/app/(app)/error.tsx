'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
      <h2 className="font-semibold text-red-700">Something went wrong</h2>
      <pre className="whitespace-pre-wrap text-xs text-red-600">{error.message}</pre>
      <button
        type="button"
        onClick={reset}
        className="rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
      >
        Try again
      </button>
    </div>
  );
}
