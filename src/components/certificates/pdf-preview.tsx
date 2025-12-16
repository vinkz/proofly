type PdfPreviewProps = {
  url: string | null;
  error?: string | null;
};

export function PdfPreview({ url, error }: PdfPreviewProps) {
  const message = error ?? (!url ? 'No PDF found for this job' : null);
  if (message) {
    return (
      <div className="rounded-3xl border border-dashed border-white/30 bg-white/80 p-6 text-sm text-muted-foreground/70">
        {message}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/30 bg-white shadow-sm">
      <iframe src={url} title="Certificate PDF" className="h-[70vh] w-full border-0" />
    </div>
  );
}
