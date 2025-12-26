'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

type SummaryRowProps = {
  label: string;
  valueText: string;
  onClick?: () => void;
  rightSlot?: ReactNode;
};

export function SummaryRow({ label, valueText, onClick, rightSlot }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/70 px-3 py-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{label}</p>
        <p className="text-sm text-muted">{valueText}</p>
      </div>
      {rightSlot ? (
        rightSlot
      ) : onClick ? (
        <Button type="button" variant="ghost" className="h-8 rounded-full px-3 text-xs" onClick={onClick}>
          Edit
        </Button>
      ) : null}
    </div>
  );
}
