import { redirect } from 'next/navigation';

export default async function ClientsPage() {
  redirect('/jobs');
}
