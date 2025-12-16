'use client';

import { PhotoUploadCard } from './photo-upload-card';

type BeforeAfterCardProps = {
  onBefore?: (file: File) => void;
  onAfter?: (file: File) => void;
};

export function BeforeAfterCard({ onBefore, onAfter }: BeforeAfterCardProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <PhotoUploadCard label="Before" onSelect={onBefore} hint="Capture the starting condition" />
      <PhotoUploadCard label="After" onSelect={onAfter} hint="Capture the finished condition" />
    </div>
  );
}
