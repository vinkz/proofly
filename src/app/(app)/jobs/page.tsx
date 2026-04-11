import { redirect } from 'next/navigation';

import { listJobs } from '@/server/jobs';
import { JobsListSection } from './JobsListSection';

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

  return <JobsListSection jobs={jobs as Array<Record<string, unknown>>} />;
}
