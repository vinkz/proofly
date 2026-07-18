import { redirect } from 'next/navigation';

// /request-job is kept as a permanent alias of the canonical /request page so old
// links (and the sitemap's previous entry) keep working, but there is a single page.
export default function RequestJobPage() {
  redirect('/request');
}
