'use client';

import { useEffect, useState } from 'react';

type ThemeChoice = 'light' | 'dark' | 'system';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

export function ThemeSection() {
  const [choice, setChoice] = useState<ThemeChoice>('system');

  useEffect(() => {
    const saved = getCookie('theme');
    if (saved === 'dark' || saved === 'light') {
      setChoice(saved);
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      setChoice('system');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  }, []);

  const applyTheme = (next: ThemeChoice) => {
    setChoice(next);
    if (next === 'system') {
      deleteCookie('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', next);
      setCookie('theme', next);
    }
  };

  const options: { id: ThemeChoice; label: string; sub: string }[] = [
    { id: 'light', label: 'Light', sub: '' },
    { id: 'dark', label: 'Dark', sub: '' },
    { id: 'system', label: 'System', sub: 'Auto' },
  ];

  return (
    <div className="grid grid-cols-3 gap-[10px]">
      {options.map((opt) => {
        const active = choice === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => applyTheme(opt.id)}
            className={`rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] p-[10px] text-center transition-colors ${
              active ? 'bg-[var(--color-background-secondary)]' : 'bg-[var(--color-background-primary)]'
            }`}
          >
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{opt.label}</p>
            {opt.sub ? (
              <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">{opt.sub}</p>
            ) : (
              <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
                {active ? 'Active' : 'Switch'}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
