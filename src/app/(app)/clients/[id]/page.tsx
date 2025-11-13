import { notFound } from 'next/navigation';

import { isUUID } from '@/lib/ids';

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUUID(id)) {
    notFound();
  }
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold text-muted">Client Detail</h1>
      <p className="text-sm text-muted-foreground/70">Viewing client ID: {id}</p>
    </div>
  );
}
