'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition, type ChangeEvent } from 'react';
import { clsx } from 'clsx';

import type { JobChecklistItem } from '@/types/job-detail';
import type { Database } from '@/lib/database.types';
import { updateChecklistItem, uploadPhoto } from '@/server/jobs';
import { useToast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

type ChecklistResult = Database['public']['Tables']['job_items']['Row']['result'];

interface InspectionFlowProps {
  jobId: string;
  items: JobChecklistItem[];
  photos: Record<string, { id: string; url: string }[]>;
}

const statusButtons: { label: string; value: Exclude<ChecklistResult, null>; tone: 'pass' | 'fail' }[] = [
  { label: 'Pass', value: 'pass', tone: 'pass' },
  { label: 'Fail', value: 'fail', tone: 'fail' },
];

export function InspectionFlow({ jobId, items, photos }: InspectionFlowProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [activeIndex, setActiveIndex] = useState(0);
  const [notes, setNotes] = useState(() =>
    items.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = item.note ?? '';
      return acc;
    }, {}),
  );
  const [statuses, setStatuses] = useState(() =>
    items.reduce<Record<string, ChecklistResult>>((acc, item) => {
      acc[item.id] = (item.result ?? 'pending') as ChecklistResult;
      return acc;
    }, {}),
  );
  const [isPending, startTransition] = useTransition();

  const currentItem = items[activeIndex];
  const currentStatus = statuses[currentItem.id] ?? 'pending';
  const currentPhotos = photos[currentItem.id] ?? [];
  const completedCount = useMemo(
    () =>
      Object.values(statuses).filter((status) => status === 'pass' || status === 'fail')
        .length,
    [statuses],
  );
  const progress = Math.round((completedCount / items.length) * 100);

  const changeStatus = (status: ChecklistResult) => {
    setStatuses((prev) => ({ ...prev, [currentItem.id]: status }));
    startTransition(async () => {
      try {
        await updateChecklistItem({ jobId, itemId: currentItem.id, result: status });
      } catch (error) {
        pushToast({
          title: 'Unable to update status',
          description: error instanceof Error ? error.message : 'Try again shortly.',
          variant: 'error',
        });
      }
    });
  };

  const saveNote = () => {
    const note = notes[currentItem.id] ?? '';
    startTransition(async () => {
      try {
        await updateChecklistItem({ jobId, itemId: currentItem.id, note });
        pushToast({ title: 'Note saved', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Unable to save note',
          description: error instanceof Error ? error.message : 'Try again shortly.',
          variant: 'error',
        });
      }
    });
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    startTransition(async () => {
      try {
        await uploadPhoto({ jobId, itemId: currentItem.id, file });
        pushToast({ title: 'Photo uploaded', variant: 'success' });
        router.refresh();
      } catch (error) {
        pushToast({
          title: 'Upload failed',
          description: error instanceof Error ? error.message : 'Try again shortly.',
          variant: 'error',
        });
      }
    });
  };

  const go = (direction: 'next' | 'prev') => {
    setActiveIndex((index) => {
      if (direction === 'next') return Math.min(items.length - 1, index + 1);
      return Math.max(0, index - 1);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-white/40 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Inspection progress</p>
          <h2 className="text-2xl font-semibold text-muted">{currentItem.label}</h2>
          <p className="text-sm text-muted-foreground/70">
            Item {activeIndex + 1} of {items.length}
          </p>
        </div>
        <div className="w-full md:w-64">
          <div className="flex items-center justify-between text-xs text-muted-foreground/70">
            <span>{progress}% complete</span>
            <span>
              {completedCount}/{items.length}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-muted/30">
            <div className="h-2 rounded-full bg-[var(--accent)]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex gap-4">
          {statusButtons.map((button) => (
            <Button
              key={button.value}
              type="button"
              variant="outline"
              className={clsx('w-full rounded-2xl border px-4 py-6 text-lg', {
                'bg-emerald-600 text-white': button.tone === 'pass' && currentStatus === button.value,
                'bg-red-600 text-white': button.tone === 'fail' && currentStatus === button.value,
              })}
              onClick={() => changeStatus(button.value)}
              disabled={isPending}
            >
              {button.label}
            </Button>
          ))}
        </div>

        <div className="rounded-2xl border border-white/20 bg-white/70 p-4 shadow-inner">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
            Notes
          </label>
          <Textarea
            value={notes[currentItem.id]}
            onChange={(event) => setNotes((prev) => ({ ...prev, [currentItem.id]: event.target.value }))}
            rows={4}
            placeholder="Capture findings, measurements, or required follow-up."
            className="mt-2 text-sm"
          />
          <div className="mt-2 flex justify-end">
            <Button type="button" variant="secondary" onClick={saveNote} disabled={isPending}>
              Save note
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-white/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-muted">Photos</p>
              <p className="text-xs text-muted-foreground/70">Attach up to three supporting photos.</p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/30 px-3 py-1.5 text-xs font-semibold text-muted hover:bg-white/80">
              Upload
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {currentPhotos.length === 0 ? (
              <p className="text-xs text-muted-foreground/70">No photos yet.</p>
            ) : (
              currentPhotos.map((photo) =>
                photo.url ? (
                  <Image
                    key={photo.id}
                    src={photo.url}
                    alt="Checklist photo"
                    width={96}
                    height={96}
                    className="h-24 w-24 rounded-xl border border-white/30 object-cover"
                    unoptimized
                  />
                ) : null,
              )
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" onClick={() => go('prev')} disabled={activeIndex === 0 || isPending}>
          Previous
        </Button>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/jobs/${jobId}`)}
          >
            Review list
          </Button>
          <Button
            type="button"
            onClick={() => go('next')}
            disabled={activeIndex === items.length - 1 || isPending}
          >
            Next item
          </Button>
        </div>
      </div>
    </div>
  );
}
