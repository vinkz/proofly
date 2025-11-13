'use client';

import { useMemo } from 'react';
import { useJobProgress } from '@/components/job-progress-context';
import { Progress } from '@/components/ui/progress';

export function JobProgressBar({ total }: { total: number }) {
  const { statuses } = useJobProgress();

  const completed = useMemo(() => {
    return Object.values(statuses).filter((status) => status !== 'pending').length;
  }, [statuses]);

  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div className="sticky top-0 z-20 flex flex-col gap-2 border-b border-white/10 bg-surface/90 p-4 backdrop-blur">
      <div className="flex items-center justify-between text-sm text-muted-foreground/80">
        <span className="font-semibold text-muted">Checklist progress</span>
        <span>
          {completed}/{total} complete
        </span>
      </div>
      <Progress value={percent} />
    </div>
  );
}
