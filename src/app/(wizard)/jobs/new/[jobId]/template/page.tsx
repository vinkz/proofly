import { notFound, redirect } from 'next/navigation';

import { isUUID } from '@/lib/ids';

export default async function TemplateStepPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!isUUID(jobId)) notFound();
  redirect(`/wizard/create/cp12?jobId=${jobId}`);
}
