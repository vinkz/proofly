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
    <div className="flex flex-col rounded-md border border-white/30 bg-white/85 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted">{title}</p>
        {photoPreview ? <span className="text-[10px] text-gray-500">Photo uploaded</span> : null}
      </div>
      <div className="mt-3 grid gap-2">
        {fields.map((field) => {
          const value = values[field.key] ?? '';
          if (field.type === 'select' && field.options) {
            return (
              <div key={field.key} className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">{field.label}</p>
                <select
                  className="w-full rounded-md border border-white/15 bg-white/80 px-3 py-2 text-sm text-muted shadow-sm"
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
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/20 pt-3 text-xs font-semibold text-muted">
        <button
          type="button"
          className="flex items-center gap-1 rounded-md border border-white/30 bg-white/80 px-3 py-1 shadow-sm transition hover:border-[var(--accent)]"
          onClick={triggerFile}
        >
          <span role="img" aria-label="Photo">
            📷
          </span>
          Photo
        </button>
        <button
          type="button"
          className="flex items-center gap-1 rounded-md border border-white/30 bg-white/80 px-3 py-1 shadow-sm transition hover:border-[var(--accent)]"
          onClick={onVoice}
        >
          <span role="img" aria-label="Voice">
            🎤
          </span>
          Voice
        </button>
        <button
          type="button"
          className="flex items-center gap-1 rounded-md border border-white/30 bg-white/80 px-3 py-1 shadow-sm transition hover:border-[var(--accent)]"
          onClick={onText}
        >
          <span role="img" aria-label="Text">
            ⌨️
          </span>
          Text
        </button>
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
