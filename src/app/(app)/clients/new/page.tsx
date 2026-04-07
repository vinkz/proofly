import { redirect } from 'next/navigation';

export default async function NewClientPage() {
  redirect('/jobs/new');
}
