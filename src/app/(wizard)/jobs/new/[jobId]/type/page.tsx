import { notFound, redirect } from 'next/navigation';

import { setJobType } from '@/server/jobs';
import { isUUID } from '@/lib/ids';

export default async function JobTypeStepPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!isUUID(jobId)) notFound();
  await setJobType(jobId, 'safety_check');
  redirect(`/wizard/create/cp12?jobId=${jobId}`);
}
