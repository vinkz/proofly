'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { SVGProps } from 'react';

type MenuItem = {
  href: string;
  label: string;
  icon: (props: SVGProps<SVGSVGElement>) => React.ReactElement;
};

const items: MenuItem[] = [
  { href: '/tools/gas-rate', label: 'Gas rate calculator', icon: FlameIcon },
  { href: '/invoices/new', label: 'Create invoice', icon: PlusSquareIcon },
  { href: '/invoices', label: 'Invoices', icon: FileTextIcon },
];

export function ToolsMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Tools"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-background-secondary)] hover:text-[var(--color-text-primary)]"
      >
        <HamburgerIcon width={16} height={16} strokeWidth={1.75} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-[12px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-[0_8px_24px_rgba(0,0,0,0.1)]"
        >
          <div className="px-1 py-1">
            <p className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
              Tools
            </p>
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-[13px] font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-background-secondary)]"
              >
                <item.icon
                  width={15}
                  height={15}
                  strokeWidth={1.75}
                  className="shrink-0 text-[var(--color-text-tertiary)]"
                />
                {item.label}
              </Link>
            ))}
            <div className="my-1 border-t-[0.5px] border-[var(--color-border-tertiary)]" />
            <p className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
              Account
            </p>
            <form action="/logout" method="post">
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-left text-[13px] font-medium text-[var(--color-red)] transition-colors hover:bg-[var(--color-background-secondary)]"
              >
                <LogOutIcon
                  width={15}
                  height={15}
                  strokeWidth={1.75}
                  className="shrink-0 text-[var(--color-red)]"
                />
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function iconBase(props: SVGProps<SVGSVGElement>) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  };
}

function HamburgerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase(props)}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function FlameIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase(props)}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z" />
    </svg>
  );
}

function PlusSquareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase(props)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function FileTextIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase(props)}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6M8 13h8M8 17h6" />
    </svg>
  );
}

function LogOutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase(props)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}
