import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getClientDetail } from '@/server/clients';
import { isUUID } from '@/lib/ids';

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatStatus = (value: string | null | undefined) =>
  value
    ? value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Draft';

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUUID(id)) notFound();

  let detail;
  try {
    detail = await getClientDetail(id);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') redirect('/login');
      if (error.message === 'Client not found') notFound();
    }
    throw error;
  }

  const { client, contactDetails, jobs } = detail;
  const displayName = contactDetails.landlord_name || contactDetails.name || client.name || 'Client';

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <Link
        href="/clients"
        className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
      >
        ← Clients
      </Link>

      <section className="rounded-[18px] bg-[var(--color-background-primary)] p-5 shadow-sm">
        <p className="text-[12px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
          Client
        </p>
        <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]">
          {displayName}
        </h1>
        {contactDetails.organization ? (
          <p className="mt-1 text-[14px] text-[var(--color-text-secondary)]">{contactDetails.organization}</p>
        ) : null}

        <div className="mt-4 grid gap-2 border-t-[0.5px] border-[var(--color-border-tertiary)] pt-4 text-[14px] text-[var(--color-text-secondary)]">
          {contactDetails.email ? <p className="truncate">Email: {contactDetails.email}</p> : null}
          {contactDetails.phone ? <p className="truncate">Phone: {contactDetails.phone}</p> : null}
          {contactDetails.address ? <p>Address: {contactDetails.address}</p> : null}
          {contactDetails.postcode ? <p>Postcode: {contactDetails.postcode}</p> : null}
          {contactDetails.landlord_address && contactDetails.landlord_address !== contactDetails.address ? (
            <p>Landlord address: {contactDetails.landlord_address}</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-[18px] bg-[var(--color-background-primary)] p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
              Jobs
            </p>
            <h2 className="mt-1 text-[18px] font-semibold text-[var(--color-text-primary)]">
              History
            </h2>
          </div>
          <Link
            href="/jobs/new"
            className="inline-flex h-9 items-center justify-center rounded-[18px] bg-[var(--color-cta)] px-3.5 text-[13px] font-medium text-[var(--color-cta-fg)]"
          >
            New job
          </Link>
        </div>

        <div className="mt-4 grid gap-2">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}/complete`}
              className="rounded-[14px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] p-3 transition hover:border-[var(--color-border-secondary)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-[var(--color-text-primary)]">
                    {job.title || job.address || 'Job'}
                  </p>
                  {job.address ? (
                    <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-secondary)]">{job.address}</p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-full bg-[var(--color-background-primary)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
                  {formatStatus(job.status)}
                </span>
              </div>
              <p className="mt-2 text-[12px] text-[var(--color-text-tertiary)]">
                {formatDate(job.scheduled_for ?? job.created_at)}
              </p>
            </Link>
          ))}

          {jobs.length === 0 ? (
            <p className="rounded-[14px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] p-4 text-[13px] text-[var(--color-text-secondary)]">
              No jobs linked to this client yet.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
