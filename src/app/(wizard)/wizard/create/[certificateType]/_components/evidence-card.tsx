'use client';

import { useRef } from 'react';

import type { EvidenceField } from '@/types/cp12';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type EvidenceCardProps = {
  title: string;
  fields: EvidenceField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  photoPreview?: string;
  onPhotoUpload?: (file: File) => void;
  onVoice?: () => void;
  onText?: () => void;
};

export function EvidenceCard({
  title,
  fields,
  values,
  onChange,
  photoPreview,
  onPhotoUpload,
  onVoice,
  onText,
}: EvidenceCardProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const triggerFile = () => fileRef.current?.click();

  return (
    <div className="flex flex-col rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
        {photoPreview ? <span className="text-[10px] text-[var(--color-text-secondary)]">Photo uploaded</span> : null}
      </div>
      <div className="mt-3 grid gap-2">
        {fields.map((field) => {
          const value = values[field.key] ?? '';
          if (field.type === 'select' && field.options) {
            return (
              <div key={field.key} className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">{field.label}</p>
                <select
                  className="w-full rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-[13px] text-[var(--color-text-primary)]"
                  value={value}
                  onChange={(e) => onChange(field.key, e.target.value)}
                >
                  <option value="">Select</option>
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          }
          const isMultiline = field.key.includes('notes') || field.key.includes('description');
          return (
            <div key={field.key} className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">{field.label}</p>
              {isMultiline ? (
                <Textarea value={value} onChange={(e) => onChange(field.key, e.target.value)} className="min-h-[68px]" />
              ) : (
                <Input value={value} onChange={(e) => onChange(field.key, e.target.value)} />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--color-border-secondary)] pt-3 text-xs font-semibold text-[var(--color-text-primary)]">
        <button
          type="button"
          className="flex items-center gap-1 rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-1 transition hover:border-[var(--color-action)]"
          onClick={triggerFile}
        >
          <span role="img" aria-label="Photo">
            📷
          </span>
          Photo
        </button>
        {onVoice ? (
          <button
            type="button"
            className="flex items-center gap-1 rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-1 transition hover:border-[var(--color-action)]"
            onClick={onVoice}
          >
            <span role="img" aria-label="Voice">
              🎤
            </span>
            Voice
          </button>
        ) : null}
        {onText ? (
          <button
            type="button"
            className="flex items-center gap-1 rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-1 transition hover:border-[var(--color-action)]"
            onClick={onText}
          >
            <span role="img" aria-label="Text">
              ⌨️
            </span>
            Text
          </button>
        ) : null}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          onPhotoUpload?.(file);
        }}
      />
    </div>
  );
}
