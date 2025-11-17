'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { clsx } from 'clsx';

import type { Database } from '@/lib/database.types';
import type { JobChecklistItem } from '@/types/job-detail';
import { updateChecklistItem, uploadPhoto, deletePhoto } from '@/server/jobs';
import { useToast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useJobProgress } from '@/components/job-progress-context';

type GalleryPhoto = {
  id: string;
  url: string;
  storage_path?: string;
  optimistic?: boolean;
};

interface ChecklistItemCardProps {
  jobId: string;
  item: JobChecklistItem;
  photos: { id: string; signedUrl: string | null; storage_path: string }[];
  nextItemId: string | null;
}

type ChecklistResult = Database['public']['Tables']['job_items']['Row']['result'];
const resultOptions = [
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
  { value: 'pending', label: 'Pending' },
] as const;
type ResultValue = (typeof resultOptions)[number]['value'];

export function ChecklistItemCard({ jobId, item, photos, nextItemId }: ChecklistItemCardProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const { setStatus: setProgressStatus } = useJobProgress();
  const [status, setStatusState] = useState<ResultValue>((item.result ?? 'pending') as ResultValue);
  const [note, setNote] = useState(item.note ?? '');
  const [noteFocused, setNoteFocused] = useState(false);
  const [optimisticPhotos, setOptimisticPhotos] = useState<GalleryPhoto[]>([]);
  const [isUploading, setUploading] = useState(false);
  const [isTransitionPending, startTransition] = useTransition();
  const [pulse, setPulse] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const pulseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const label = item.label ?? 'Checklist item';

  useEffect(() => {
    setStatusState((item.result ?? 'pending') as ResultValue);
  }, [item.result]);

  useEffect(() => {
    setNote(item.note ?? '');
  }, [item.note]);

  useEffect(
    () => () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      optimisticPhotos.forEach((photo) => {
        if (photo.optimistic) URL.revokeObjectURL(photo.url);
      });
    },
    [optimisticPhotos],
  );

  const schedulePulseReset = useCallback(() => {
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => {
      setPulse(false);
    }, 450);
  }, []);

  const focusNextCard = useCallback(() => {
    if (!nextItemId) return;
    requestAnimationFrame(() => {
      const nextCard = document.querySelector<HTMLElement>(`[data-item-card="${nextItemId}"]`);
      if (!nextCard) return;
      nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const nextButton = nextCard.querySelector<HTMLButtonElement>('[data-status-button]');
      nextButton?.focus({ preventScroll: true });
    });
  }, [nextItemId]);

  const handleStatusSelection = (nextStatus: ResultValue) => {
    if (nextStatus === status) {
      focusNextCard();
      return;
    }

    const previousStatus = status;
    setStatusState(nextStatus);
    setProgressStatus(item.id, nextStatus);
    setPulse(true);
    focusNextCard();

    startTransition(() => {
      void (async () => {
        try {
          await updateChecklistItem({ jobId, itemId: item.id, result: nextStatus });
          schedulePulseReset();
        } catch (error) {
          setStatusState(previousStatus);
          setProgressStatus(item.id, previousStatus);
          setPulse(false);
          pushToast({
            title: 'Update failed',
            description: error instanceof Error ? error.message : 'Try again in a moment.',
            variant: 'error',
          });
        }
      })();
    });
  };

  const saveNote = useCallback(
    (payload: string) => {
      if (payload === (item.note ?? '')) return;
      const previous = item.note ?? '';
      setPulse(true);
      startTransition(() => {
        void (async () => {
          try {
            await updateChecklistItem({ jobId, itemId: item.id, note: payload });
            schedulePulseReset();
          } catch (error) {
            setNote(previous);
            setPulse(false);
            pushToast({
              title: 'Could not save note',
              description: error instanceof Error ? error.message : 'Try again in a moment.',
              variant: 'error',
            });
          }
        })();
      });
    },
    [item.id, item.note, jobId, pushToast, schedulePulseReset, startTransition],
  );

  const handleNoteBlur = () => {
    saveNote(note);
    setNoteFocused(false);
  };

  const handleNoteKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const isMetaEnter = (event.metaKey || event.ctrlKey) && event.key === 'Enter';
    if (isMetaEnter) {
      event.preventDefault();
      saveNote(note);
      (event.currentTarget as HTMLTextAreaElement).blur();
    }
  };

  const normalizedServerPhotos = useMemo<GalleryPhoto[]>(() => {
    return photos
      .filter((photo) => photo.signedUrl)
      .map((photo) => ({
        id: photo.id,
        url: photo.signedUrl as string,
        storage_path: photo.storage_path,
        optimistic: false,
      }));
  }, [photos]);

  const galleryPhotos = useMemo<GalleryPhoto[]>(() => {
    const merged = [...optimisticPhotos, ...normalizedServerPhotos];
    return merged.slice(0, 3);
  }, [normalizedServerPhotos, optimisticPhotos]);

  const maxPhotosReached = galleryPhotos.length >= 3;

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (maxPhotosReached) {
      pushToast({
        title: 'Photo limit reached',
        description: 'Remove an existing photo before adding another.',
        variant: 'error',
      });
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const objectUrl = URL.createObjectURL(file);
    setOptimisticPhotos((prev) => [{ id: tempId, url: objectUrl, optimistic: true }, ...prev]);
    setUploading(true);

    try {
      await uploadPhoto({ jobId, itemId: item.id, file });
      pushToast({ title: 'Photo added', variant: 'success' });
      setOptimisticPhotos((prev) => prev.filter((photo) => photo.id !== tempId));
      URL.revokeObjectURL(objectUrl);
      router.refresh();
    } catch (error) {
      setOptimisticPhotos((prev) => prev.filter((photo) => photo.id !== tempId));
      URL.revokeObjectURL(objectUrl);
      pushToast({
        title: 'Photo upload failed',
        description: error instanceof Error ? error.message : 'Try again with a different image.',
        variant: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = (photo: GalleryPhoto) => {
    if (photo.optimistic) {
      setOptimisticPhotos((prev) => prev.filter((itemPhoto) => itemPhoto.id !== photo.id));
      URL.revokeObjectURL(photo.url);
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          if (photo.storage_path) {
            await deletePhoto({ jobId, photoId: photo.id, storagePath: photo.storage_path });
            router.refresh();
            pushToast({ title: 'Photo removed', variant: 'success' });
          }
        } catch (error) {
          pushToast({
            title: 'Could not remove photo',
            description: error instanceof Error ? error.message : 'Please try again in a moment.',
            variant: 'error',
          });
        }
      })();
    });
  };

  const cardClasses = clsx(
    'rounded-2xl border border-white/10 bg-white/5 p-5 shadow-brand/40 transition',
    pulse && 'animate-pulse',
  );

  return (
    <article ref={cardRef} data-item-card={item.id} className={cardClasses}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-muted">{label}</h3>
          {item.note ? <p className="text-sm text-muted-foreground/70">{item.note}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {resultOptions.map((option) => {
            const isActive = status === option.value;
            return (
              <Button
                key={option.value}
                type="button"
                variant={isActive ? 'primary' : 'outline'}
                data-status-button
                className={clsx(
                  'min-h-12 min-w-[96px] px-5 text-base',
                  !isActive && 'border-white/20 text-muted-foreground hover:border-accent/40 hover:text-muted',
                )}
                disabled={isTransitionPending}
                onClick={() => handleStatusSelection(option.value)}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      </header>

      <div className="mt-5">
        <label htmlFor={`note-${item.id}`} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
          Notes
        </label>
        <Textarea
          id={`note-${item.id}`}
          rows={noteFocused || note.length > 0 ? 4 : 2}
          value={note}
          onFocus={() => setNoteFocused(true)}
          onChange={(event) => setNote(event.target.value)}
          onBlur={handleNoteBlur}
          onKeyDown={handleNoteKeyDown}
          placeholder="Optional notes for this checklist item"
          disabled={isTransitionPending}
          className="mt-2 resize-none bg-surface-elevated/60"
        />
        <p className="mt-2 text-xs text-muted-foreground/60">Press ⌘⏎ / Ctrl⏎ to save instantly.</p>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-muted">Photos</p>
          <label
            className={clsx(
              'inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/15 px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-white/10',
              (isUploading || maxPhotosReached) && 'cursor-not-allowed opacity-60',
            )}
          >
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoChange}
              disabled={isUploading || maxPhotosReached}
            />
            {isUploading ? 'Uploading…' : 'Add photo'}
          </label>
        </div>
        {galleryPhotos.length === 0 ? (
          <p className="text-xs text-muted-foreground/60">No photos yet.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {galleryPhotos.map((photo) => (
              <div key={photo.id} className="relative h-20 w-20">
                <Image
                  src={photo.url}
                  alt="Checklist attachment"
                  width={80}
                  height={80}
                  unoptimized
                  className={clsx(
                    'h-20 w-20 rounded-2xl border border-white/15 object-cover',
                    photo.optimistic && 'opacity-70',
                  )}
                />
                <button
                  type="button"
                  className="absolute -right-2 -top-2 h-6 w-6 rounded-full border border-white/20 bg-surface text-xs text-muted transition hover:bg-white/10"
                  onClick={() => handleRemovePhoto(photo)}
                  aria-label="Remove photo"
                  disabled={isTransitionPending}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
