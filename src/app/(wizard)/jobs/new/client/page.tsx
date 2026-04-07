import { redirect } from 'next/navigation';

export default async function ClientStepPage() {
  redirect('/jobs/new');
}
