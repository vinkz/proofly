'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

export function GenerateJobSheetButton({ jobId }: { jobId: string }) {
  const router = useRouter();

  const handleGenerateJobSheet = () => {
    const url = `/api/jobs/${jobId}/job-sheet`;
    window.open(url, '_blank', 'noopener,noreferrer');
    router.push(`/jobs/${jobId}/pdf`);
  };

  return (
    <Button type="button" variant="secondary" onClick={handleGenerateJobSheet}>
      Generate Job Sheet PDF
    </Button>
  );
}
