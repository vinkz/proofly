'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { JobSummary } from './jobs-command-centre';
import { deleteJob } from '@/server/jobs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

type StatusFilter = 'all' | 'draft' | 'active' | 'awaiting_signatures' | 'awaiting_report' | 'completed';

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'awaiting_signatures', label: 'Awaiting signatures' },
  { value: 'awaiting_report', label: 'Awaiting report' },
  { value: 'completed', label: 'Completed' },
];

export function DeleteJobsMenu({ jobs }: { jobs: JobSummary[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [localJobs, setLocalJobs] = useState<JobSummary[]>(jobs);
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useToast();
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setLocalJobs(jobs);
  }, [jobs]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!panelRef.current || !target) return;
      if (panelRef.current.contains(target)) return;
      if (toggleRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return localJobs.filter((job) => {
      if (status !== 'all' && (job.status ?? 'draft') !== status) return false;
      if (!q) return true;
      const haystack = `${job.title ?? ''} ${job.address ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [localJobs, query, status]);

  const toggleSelection = (jobId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(jobId) ? next.delete(jobId) : next.add(jobId);
      return next;
    });
  };

  const selectAllFiltered = () => {
    const next = new Set<string>();
    filtered.forEach((job) => next.add(job.id));
    setSelected(next);
  };

  const clearSelection = () => setSelected(new Set());

  const handleDelete = () => {
    if (!selected.size) return;
    const confirmed = window.confirm(`Delete ${selected.size} selected job${selected.size === 1 ? '' : 's'}? This cannot be undone.`);
    if (!confirmed) return;
    startTransition(async () => {
      try {
        await Promise.all(Array.from(selected).map((id) => deleteJob(id)));
        setLocalJobs((prev) => prev.filter((job) => !selected.has(job.id)));
        pushToast({ title: 'Jobs deleted', variant: 'success' });
        clearSelection();
        setOpen(false);
        router.refresh();
      } catch (error) {
        pushToast({
          title: 'Unable to delete jobs',
          description: error instanceof Error ? error.message : 'Try again shortly.',
          variant: 'error',
        });
      }
    });
  };

  const renderStatus = (value?: string | null) => {
    const label = (value ?? 'draft').replace('_', ' ');
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  return (
    <div className="relative">
      <Button
        ref={toggleRef}
        type="button"
        variant="ghost"
        className="h-12 w-12 rounded-full border border-white/20 p-0 text-muted-foreground"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Delete jobs menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 6h18" strokeWidth="1.7" />
          <path d="M8 6h1m6 0h1" strokeWidth="1.7" />
          <path d="M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6" strokeWidth="1.7" />
          <path d="M8 11v6m4-6v6m4-6v6" strokeWidth="1.7" />
        </svg>
      </Button>
      {open ? (
        <div
          ref={panelRef}
          className="absolute right-0 z-20 mt-2 w-96 rounded-3xl border border-white/25 bg-white/95 p-4 text-sm shadow-xl backdrop-blur"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-muted">Delete jobs</p>
              <p className="text-xs text-muted-foreground/70">Filter, select, and remove jobs in one place.</p>
            </div>
            <button type="button" className="text-xs font-semibold text-muted-foreground/70 underline" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <div className="mt-3 space-y-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by client or address"
              className="rounded-full"
            />
            <div className="flex flex-wrap gap-2">
              {statusFilters.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    status === opt.value ? 'bg-[var(--accent)] text-white' : 'bg-[var(--muted)] text-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 max-h-60 overflow-auto rounded-2xl border border-white/20 bg-white/80">
            {filtered.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground/70">No jobs match this filter.</p>
            ) : (
              filtered.map((job) => {
                const isChecked = selected.has(job.id);
                return (
                  <label
                    key={job.id}
                    className="flex cursor-pointer items-start gap-3 border-b border-white/10 px-3 py-2 last:border-b-0 hover:bg-white/60"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-red-600"
                      checked={isChecked}
                      onChange={() => toggleSelection(job.id)}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-muted">{job.title ?? 'Untitled job'}</p>
                      <p className="text-xs text-muted-foreground/70">{job.address ?? 'Address pending'}</p>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground/60">
                        {renderStatus(job.status)} · {(job.certificate_type ?? 'certificate').toString()}
                      </p>
                    </div>
                  </label>
                );
              })
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-full" onClick={selectAllFiltered} disabled={!filtered.length}>
                Select all
              </Button>
              <Button variant="outline" className="rounded-full" onClick={clearSelection} disabled={!selected.size}>
                Clear
              </Button>
            </div>
            <Button
              variant="outline"
              className="rounded-full bg-red-50 px-4 py-2 text-red-700 hover:bg-red-100"
              disabled={!selected.size || isPending}
              onClick={handleDelete}
            >
              {isPending ? 'Deleting…' : `Delete ${selected.size || ''}`}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
