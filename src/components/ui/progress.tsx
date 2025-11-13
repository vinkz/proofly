import type { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  min?: number;
}

export function Progress({ className, value = 0, min = 0, max = 100, ...props }: ProgressProps) {
  const safeMax = max <= min ? min + 100 : max;
  const clamped = Math.min(Math.max(value, min), safeMax);
  const percent = ((clamped - min) / (safeMax - min)) * 100;

  return (
    <div
      className={clsx(
        'relative h-2 w-full overflow-hidden rounded-full border border-white/10 bg-white/5',
        className,
      )}
      role="progressbar"
      aria-valuemin={min}
      aria-valuenow={Math.round(percent)}
      aria-valuemax={safeMax}
      {...props}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width]"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
