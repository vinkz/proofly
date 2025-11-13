"use client";

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export function PageFade({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timeout = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(timeout);
  }, []);

  return (
    <div
      className={`h-full transform transition-all duration-300 ease-out ${ready ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
    >
      {children}
    </div>
  );
}
