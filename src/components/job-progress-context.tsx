'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Database } from '@/lib/database.types';

type ChecklistStatus = Database['public']['Tables']['job_checklist']['Row']['status'];
type ProgressState = Record<string, ChecklistStatus | null>;

interface JobProgressContextValue {
  statuses: ProgressState;
  setStatus: (itemId: string, status: ChecklistStatus | null) => void;
}

const JobProgressContext = createContext<JobProgressContextValue | null>(null);

export function JobProgressProvider({
  initialStatuses,
  children,
}: {
  initialStatuses: ProgressState;
  children: ReactNode;
}) {
  const [statuses, setStatuses] = useState<ProgressState>(initialStatuses);

  useEffect(() => {
    setStatuses(initialStatuses);
  }, [initialStatuses]);

  const setStatus = useCallback((itemId: string, status: ChecklistStatus | null) => {
    setStatuses((prev) => {
      if (prev[itemId] === status) return prev;
      return { ...prev, [itemId]: status };
    });
  }, []);

  const value = useMemo<JobProgressContextValue>(
    () => ({
      statuses,
      setStatus,
    }),
    [setStatus, statuses],
  );

  return <JobProgressContext.Provider value={value}>{children}</JobProgressContext.Provider>;
}

export function useJobProgress() {
  const context = useContext(JobProgressContext);
  if (!context) {
    throw new Error('useJobProgress must be used within a JobProgressProvider');
  }
  return context;
}
