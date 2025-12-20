'use client';

import { useMemo, useState } from 'react';

type ClientCalendarProps = {
  jobs: Array<{ id: string; title?: string | null; scheduled_for?: string | null; created_at?: string | null }>;
};

function formatDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function ClientCalendar({ jobs }: ClientCalendarProps) {
  const today = formatDateString(new Date());
  const [selected, setSelected] = useState<string>(today);

  const jobsByDate = useMemo(() => {
    const map = new Map<string, Array<{ id: string; title?: string | null }>>();
    jobs.forEach((job) => {
      const when = job.scheduled_for ?? job.created_at;
      if (!when) return;
      const key = formatDateString(new Date(when));
      const list = map.get(key) ?? [];
      list.push({ id: job.id, title: job.title ?? 'Job' });
      map.set(key, list);
    });
    return map;
  }, [jobs]);

  const entries = jobsByDate.get(selected) ?? [];

  return (
    <div className="space-y-3 rounded-3xl border border-white/20 bg-white/80 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Calendar</p>
          <p className="text-sm text-muted-foreground/70">Select a date to view jobs.</p>
        </div>
        <input
          type="date"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-md border border-white/20 bg-white/60 px-3 py-1 text-sm text-muted focus:border-[var(--accent)] focus:outline-none"
        />
      </div>
      <div className="space-y-2">
        {entries.length ? (
          entries.map((job) => (
            <div key={job.id} className="rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm">
              <p className="font-semibold text-muted">{job.title}</p>
              <p className="text-xs text-muted-foreground/70">Job #{job.id.slice(0, 6)}…</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground/70">No jobs on this date.</p>
        )}
      </div>
    </div>
  );
}
