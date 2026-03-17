'use client';

import { useRouter } from 'next/navigation';

export function DocumentBackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="w-fit rounded-full border border-white/50 bg-white/90 px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm"
    >
      ← Back
    </button>
  );
}
