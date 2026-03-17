import { redirect } from 'next/navigation';

export default async function ReportPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  redirect(`/documents/${jobId}`);
}
