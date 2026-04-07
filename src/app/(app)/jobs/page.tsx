import { redirect } from 'next/navigation';

import { listJobs } from '@/server/jobs';
import { JobsListSection } from './JobsListSection';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function JobsPage() {
  let jobGroups;
  try {
    jobGroups = await listJobs();
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      redirect('/login');
    }
    throw error;
  }

  const jobs = [...jobGroups.active, ...jobGroups.completed];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[var(--surface)]/90 p-6 shadow-md backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Jobs</p>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--brand)]">Jobs</h1>
            <p className="text-sm text-gray-600">Browse upcoming and past jobs, then filter to the view you need.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" asChild className="rounded-full">
              <Link href="/jobs/new">+ New Job</Link>
            </Button>
            <Button variant="secondary" asChild className="rounded-full">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </div>
      </section>

      <JobsListSection jobs={jobs as Array<Record<string, unknown>>} showActions />
    </div>
  );
}
