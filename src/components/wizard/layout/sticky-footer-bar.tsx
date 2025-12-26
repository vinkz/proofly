'use client';

import type { ReactNode } from 'react';

export type StickyFooterBarProps = {
  leftContent?: ReactNode;
  rightAction: ReactNode;
  disabled?: boolean;
  hint?: string;
};

export function StickyFooterBar({ leftContent, rightAction, hint }: StickyFooterBarProps) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-white/10 bg-surface/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground/80">
          {leftContent}
          {hint ? <span className="block text-[11px] text-muted-foreground/60">{hint}</span> : null}
        </div>
        <div className="flex items-center gap-2">{rightAction}</div>
      </div>
    </div>
  );
}
