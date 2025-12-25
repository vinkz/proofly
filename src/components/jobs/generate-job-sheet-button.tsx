'use client';

import { Button } from '@/components/ui/button';

export function GenerateJobSheetButton({ jobId }: { jobId: string }) {
  const handleGenerateJobSheet = () => {
    const url = `/api/jobs/${jobId}/job-sheet`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Button type="button" variant="secondary" onClick={handleGenerateJobSheet}>
      Generate Job Sheet PDF
    </Button>
  );
}
