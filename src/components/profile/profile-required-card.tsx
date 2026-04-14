import Link from 'next/link';

import { Button } from '@/components/ui/button';

export function ProfileRequiredCard({
  title = 'Finish your profile before creating a job',
  missingFields,
}: {
  title?: string;
  missingFields: string[];
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 rounded-3xl border border-white/10 bg-white/80 p-6 shadow-sm">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-muted">{title}</h1>
        <p className="text-sm text-muted-foreground/70">
          You can browse the app without completing setup, but these details are required before you can create a job or issue certificates.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">Missing details</p>
        <p className="mt-2 text-sm text-amber-800">{missingFields.join(', ')}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild className="rounded-full">
          <Link href="/settings">Open settings</Link>
        </Button>
        <Button asChild variant="ghost" className="rounded-full">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
