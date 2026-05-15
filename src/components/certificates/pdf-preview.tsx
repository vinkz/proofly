type PdfPreviewProps = {
  url: string | null;
  error?: string | null;
};

export function PdfPreview({ url, error }: PdfPreviewProps) {
  const message = error ?? (!url ? 'No PDF found for this job' : null);
  if (message) {
    return (
      <div className="rounded-[16px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-6 text-[13px] text-[var(--color-text-secondary)]">
        {message}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
      <iframe src={url ?? undefined} title="Certificate PDF" className="h-[70vh] w-full border-0" />
    </div>
  );
}
