'use client';

import { Button } from '@/components/ui/button';

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  title: string;
  subtitle?: string;
}

export function MultiSelect({ options, selected, onToggle, title, subtitle }: MultiSelectProps) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-semibold text-muted">{title}</p>
        {subtitle ? <p className="text-xs text-muted-foreground/70">{subtitle}</p> : null}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <Button
              key={option}
              type="button"
              variant="outline"
              onClick={() => onToggle(option)}
              className={`flex h-auto items-center justify-between rounded-2xl border px-3 py-2 text-left text-sm ${
                isSelected
                  ? 'border-[var(--action)] bg-[var(--action)]/10 text-[var(--brand)]'
                  : 'border-white/60 bg-white/80 text-muted hover:border-[var(--accent)]/50'
              }`}
            >
              <span>{option}</span>
              {isSelected ? (
                <span className="rounded-full bg-[var(--action)] px-2 py-1 text-[11px] font-bold uppercase text-white">
                  Selected
                </span>
              ) : (
                <span className="text-[11px] font-semibold uppercase text-muted-foreground/60">Tap</span>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
