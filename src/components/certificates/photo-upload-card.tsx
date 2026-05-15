'use client';

import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Textarea } from '@/components/ui/textarea';

type PhotoUploadCardProps = {
  label: string;
  onSelect?: (file: File) => void;
  hint?: string;
  note?: string;
  onNoteChange?: (value: string) => void;
  onVoiceRequest?: () => void;
  initialPreview?: string;
};

export function PhotoUploadCard({
  label,
  onSelect,
  hint,
  note,
  onNoteChange,
  onVoiceRequest,
  initialPreview,
}: PhotoUploadCardProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(Boolean(note));
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialPreview) {
      setPreview(initialPreview);
    }
  }, [initialPreview]);

  useEffect(() => {
    if (note && !showNote) {
      setShowNote(true);
    }
  }, [note, showNote]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onSelect?.(file);
  };

  const triggerFile = () => fileInputRef.current?.click();

  return (
    <div
      className={clsx(
        'flex flex-1 cursor-pointer flex-col rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-3 text-left transition hover:border-[var(--color-action)] hover:bg-[var(--color-background-secondary)]',
      )}
    >
      <div className="space-y-1">
        <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{label}</p>
        {hint ? <p className="text-[11px] text-[var(--color-text-tertiary)]">{hint}</p> : null}
      </div>
      <button
        type="button"
        onClick={triggerFile}
        className="mt-2 flex min-h-[88px] items-center justify-between gap-3 rounded-[8px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-2 text-left transition hover:border-[var(--color-action)]"
      >
        <div className="flex items-center gap-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={label} className="h-12 w-12 rounded-lg object-cover" />
          ) : null}
          <div className="leading-tight text-[12px] text-[var(--color-text-secondary)]">
            {preview ? 'Replace photo' : 'Capture or upload photo'}
            <div className="text-[10px] text-[var(--color-text-tertiary)]">Auto-fill from photo; edit anytime.</div>
          </div>
        </div>
        <span className="rounded-[6px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-1 text-[11px] font-medium text-[var(--color-text-primary)]">
          Upload
        </span>
      </button>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-[6px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-1 text-[11px] font-medium text-[var(--color-text-primary)] hover:border-[var(--color-action)]"
          onClick={(event) => {
            event.preventDefault();
            onVoiceRequest?.();
          }}
        >
          Voice note (Whisper)
        </button>
        <button
          type="button"
          className="rounded-[6px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-1 text-[11px] font-medium text-[var(--color-text-primary)] hover:border-[var(--color-action)]"
          onClick={(event) => {
            event.preventDefault();
            setShowNote((prev) => !prev);
          }}
        >
          {showNote ? 'Hide text' : 'Add text'}
        </button>
      </div>
      {showNote ? (
        <div className="mt-2 w-full">
          <Textarea
            value={note ?? ''}
            onChange={(event) => onNoteChange?.(event.target.value)}
            placeholder="Type a quick note"
            className="min-h-[56px]"
          />
        </div>
      ) : null}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </div>
  );
}
