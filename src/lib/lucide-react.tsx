import * as React from 'react';
import type { SVGProps } from 'react';

export type LucideProps = SVGProps<SVGSVGElement>;
export type LucideIcon = (props: LucideProps) => React.ReactElement;

const baseIcon = (paths: React.ReactElement[], displayName: string): LucideIcon => {
  const Icon = ({ className, ...props }: LucideProps) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths}
    </svg>
  );
  Icon.displayName = displayName;
  return Icon;
};

export const Wrench = baseIcon(
  [
    <path
      key="shaft"
      d="M21.66 5.05a4 4 0 0 1-5.66 5.66L7 19l-4 1 1-4 9.29-9.29a4 4 0 0 1 6.37-1.66Z"
    />,
    <path key="detail" d="m16 7 1 5 5 1" />,
  ],
  'Wrench',
);

export const FileText = baseIcon(
  [
    <path key="body" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />,
    <polyline key="fold" points="14 2 14 8 20 8" />,
    <line key="l1" x1="16" x2="8" y1="13" y2="13" />,
    <line key="l2" x1="16" x2="8" y1="17" y2="17" />,
    <line key="l3" x1="10" x2="8" y1="9" y2="9" />,
  ],
  'FileText',
);

export const Users = baseIcon(
  [
    <path key="group" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />,
    <circle key="lead" cx="9" cy="7" r="4" />,
    <path key="support1" d="M22 21v-2a4 4 0 0 0-3-3.87" />,
    <path key="support2" d="M16 3.13a4 4 0 0 1 0 7.75" />,
  ],
  'Users',
);
