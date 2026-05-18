'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { SVGProps } from 'react';

type IconComponent = (props: SVGProps<SVGSVGElement>) => React.ReactElement;

type NavItem = {
  href: string;
  label: string;
  Icon: IconComponent;
  notificationKey?: 'jobs';
};

const items: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', Icon: HomeIcon },
  { href: '/properties', label: 'Properties', Icon: BriefcaseIcon, notificationKey: 'jobs' },
  { href: '/clients', label: 'Clients', Icon: UsersIcon },
  { href: '/jobs', label: 'Jobs', Icon: FileTextIcon },
  { href: '/settings', label: 'Settings', Icon: SettingsIcon },
];

export function BottomNav({ pendingRequestsCount = 0 }: { pendingRequestsCount?: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 flex h-14 border-t-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]"
    >
      {items.map((item) => {
        const active =
          pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
        const showDot = item.notificationKey === 'jobs' && pendingRequestsCount > 0;
        const tone = active
          ? 'text-[var(--color-action)]'
          : 'text-[var(--color-text-tertiary)]';

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-[3px] transition-colors ${tone}`}
          >
            <span className="relative inline-flex">
              <item.Icon width={22} height={22} aria-hidden="true" />
              {showDot ? (
                <span
                  className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-[var(--color-red)] ring-[1.5px] ring-[var(--color-background-primary)]"
                  aria-hidden="true"
                />
              ) : null}
            </span>
            <span className={`text-[10px] leading-none ${active ? 'font-medium' : 'font-normal'}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/* ---------- Tabler-style outline icons ---------- */

function baseIconProps(props: SVGProps<SVGSVGElement>) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  };
}

function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseIconProps(props)}>
      <path d="M3 12 12 4l9 8" />
      <path d="M5 10.5V20h14v-9.5" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

function BriefcaseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseIconProps(props)}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </svg>
  );
}

function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseIconProps(props)}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M21 20a5 5 0 0 0-4-4.9" />
    </svg>
  );
}

function FileTextIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseIconProps(props)}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h6" />
    </svg>
  );
}

function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseIconProps(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="m19.4 15-.8-.5a2 2 0 0 1 0-3.4l.8-.5a1 1 0 0 0 .4-1.3l-1-1.7a1 1 0 0 0-1.3-.4l-.9.4a2 2 0 0 1-2.9-1.7v-1a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v1a2 2 0 0 1-2.9 1.7l-.9-.4a1 1 0 0 0-1.3.4l-1 1.7a1 1 0 0 0 .4 1.3l.8.5a2 2 0 0 1 0 3.4l-.8.5a1 1 0 0 0-.4 1.3l1 1.7a1 1 0 0 0 1.3.4l.9-.4a2 2 0 0 1 2.9 1.7v1a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-1a2 2 0 0 1 2.9-1.7l.9.4a1 1 0 0 0 1.3-.4l1-1.7a1 1 0 0 0-.4-1.3Z" />
    </svg>
  );
}
