import Link from 'next/link';

import { dismissJobRequest, listPendingJobRequestsForDashboard, type DashboardJobRequest } from '@/server/job-requests';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default async function RequestsPage() {
  const requests = await listPendingJobRequestsForDashboard();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-16 pt-6 md:pt-10">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[var(--surface)]/90 p-6 shadow-md md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--brand)]">Landlord Requests</h1>
          <p className="mt-1 text-sm text-gray-600">Review submitted requests and schedule them into jobs.</p>
        </div>
        <Button asChild variant="secondary" className="rounded-full">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>

      <div className="space-y-3">
        {requests.length ? (
          requests.map((request) => <RequestRow key={request.id} request={request} />)
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
            No pending landlord requests.
          </div>
        )}
      </div>
    </div>
  );
}

function RequestRow({ request }: { request: DashboardJobRequest }) {
  const label = request.requestType === 'renewal' ? 'Renewal Request' : 'New Job Request';

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-950">{request.landlordName ?? 'Landlord request'}</p>
            <Badge variant="brand" className="uppercase">
              {label}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-700">{request.propertyAddress ?? 'Property address missing'}</p>
          <p className="mt-2 text-xs text-slate-500">
            {[request.landlordPhone, request.landlordEmail, request.preferredDates].filter(Boolean).join(' / ') ||
              'No contact details captured'}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="rounded-full">
            <Link href={`/jobs/new?requestId=${request.id}`}>Schedule job</Link>
          </Button>
          <form
            action={async () => {
              'use server';
              await dismissJobRequest(request.id);
            }}
          >
            <Button type="submit" variant="outline" className="w-full rounded-full sm:w-auto">
              Dismiss
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
