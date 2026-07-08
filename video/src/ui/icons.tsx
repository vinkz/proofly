import React from 'react';

/**
 * Feather/lucide-style line icons matching the CertNow landing page
 * (strokeWidth 1.75, currentColor). Sized via `s`.
 */
type P = { s?: number };
const svg = (s: number, children: React.ReactNode, fill = false): React.ReactElement => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export const IconFileCheck: React.FC<P> = ({ s = 24 }) => svg(s, <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><polyline points="14 2 14 8 20 8" /><path d="m9 15 2 2 4-4" /></>);
export const IconBell: React.FC<P> = ({ s = 24 }) => svg(s, <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>);
export const IconLink: React.FC<P> = ({ s = 24 }) => svg(s, <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>);
export const IconRepeat: React.FC<P> = ({ s = 24 }) => svg(s, <><path d="m17 2 4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>);
export const IconCheck: React.FC<P> = ({ s = 24 }) => svg(s, <polyline points="20 6 9 17 4 12" />);
export const IconCircleCheck: React.FC<P> = ({ s = 24 }) => svg(s, <><circle cx="12" cy="12" r="9" /><path d="m9 12 2 2 4-4" /></>);
export const IconShare: React.FC<P> = ({ s = 24 }) => svg(s, <><circle cx="6" cy="12" r="3" /><circle cx="18" cy="6" r="3" /><circle cx="18" cy="18" r="3" /><path d="m8.7 10.7 6.6-3.4M8.7 13.3l6.6 3.4" /></>);
export const IconBuilding: React.FC<P> = ({ s = 24 }) => svg(s, <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" /></>);
export const IconClipboard: React.FC<P> = ({ s = 24 }) => svg(s, <><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></>);
export const IconFolder: React.FC<P> = ({ s = 24 }) => svg(s, <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />);
export const IconMail: React.FC<P> = ({ s = 24 }) => svg(s, <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>);
export const IconMic: React.FC<P> = ({ s = 24 }) => svg(s, <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4" /></>);
export const IconArrowRight: React.FC<P> = ({ s = 24 }) => svg(s, <path d="M5 12h14M12 5l7 7-7 7" />);
export const IconPlus: React.FC<P> = ({ s = 24 }) => svg(s, <path d="M12 5v14M5 12h14" />);
export const IconMenu: React.FC<P> = ({ s = 24 }) => svg(s, <path d="M4 6h16M4 12h16M4 18h16" />);
