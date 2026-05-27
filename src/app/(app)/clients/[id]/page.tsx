import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getClientDetail, type ComplianceStatus, type ClientPropertyHealth } from '@/server/clients';
import { isUUID } from '@/lib/ids';

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return (words[0][0] ?? '?').toUpperCase();
  return ((words[0][0] ?? '') + (words[words.length - 1][0] ?? '')).toUpperCase();
}

const AVATAR_STYLE: Record<ComplianceStatus, { bg: string; color: string }> = {
  overdue: { bg: '#fcebeb', color: '#a32d2d' },
  amber: { bg: '#faeeda', color: '#BA7517' },
  current: { bg: '#edf7f2', color: '#1a7a52' },
  unknown: { bg: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' },
};

const DOT_COLOR: Record<ComplianceStatus, string> = {
  overdue: '#a32d2d',
  amber: '#BA7517',
  current: '#1a7a52',
  unknown: 'var(--color-border-secondary)',
};

const STATUS_LABEL: Record<ComplianceStatus, string> = {
  overdue: 'Overdue',
  amber: 'Due soon',
  current: 'Current',
  unknown: 'No cert date',
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatStatus = (value: string | null | undefined) =>
  value ? value.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : 'Draft';

function worstStatusFromProps(properties: ClientPropertyHealth[]): ComplianceStatus {
  if (properties.some((p) => p.status === 'overdue')) return 'overdue';
  if (properties.some((p) => p.status === 'amber')) return 'amber';
  if (properties.some((p) => p.status === 'current')) return 'current';
  return 'unknown';
}

function PropertyRow({ property, clientId }: { property: ClientPropertyHealth; clientId: string }) {
  const displayName = property.name || property.addressLine1;
  const secondaryAddress = property.name
    ? [property.addressLine1, property.town, property.postcode].filter(Boolean).join(', ')
    : null;
  const dueDateFormatted = formatDate(property.nextServiceDue);
  const isUrgent = property.status === 'overdue' || property.status === 'amber';

  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-[var(--color-text-primary)]">{displayName}</p>
        {secondaryAddress ? (
          <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-secondary)]">{secondaryAddress}</p>
        ) : null}
        {dueDateFormatted ? (
          <p
            className="mt-0.5 text-[12px] font-medium"
            style={{ color: isUrgent ? DOT_COLOR[property.status] : 'var(--color-text-tertiary)' }}
          >
            {property.status === 'overdue'
              ? `Expired ${dueDateFormatted}`
              : property.status === 'amber'
                ? `Due ${dueDateFormatted}`
                : `Next due: ${dueDateFormatted}`}
          </p>
        ) : (
          <p className="mt-0.5 text-[12px] text-[var(--color-text-tertiary)]">No service date recorded</p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <div className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: DOT_COLOR[property.status] }}
            aria-hidden="true"
          />
          <span
            className="text-[12px] font-medium"
            style={{ color: DOT_COLOR[property.status] }}
          >
            {STATUS_LABEL[property.status]}
          </span>
        </div>
        <Link
          href={`/jobs/new?clientId=${clientId}&propertyId=${property.id}`}
          className={`inline-flex h-7 items-center justify-center rounded-full px-3 text-[12px] font-medium ${
            isUrgent
              ? 'bg-[#111] text-white'
              : 'border-[0.5px] border-[var(--color-border-secondary)] bg-transparent text-[var(--color-text-secondary)]'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          New job
        </Link>
      </div>
    </div>
  );
}

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

  const { client, contactDetails, jobs, properties } = detail;
  const displayName = contactDetails.landlord_name || contactDetails.name || client.name || 'Client';
  const worstStatus = worstStatusFromProps(properties);
  const avatar = AVATAR_STYLE[worstStatus];
  const initials = getInitials(displayName);

  const overdueCount = properties.filter((p) => p.status === 'overdue').length;
  const amberCount = properties.filter((p) => p.status === 'amber').length;
  const currentCount = properties.filter((p) => p.status === 'current').length;

  const complianceParts: string[] = [];
  if (overdueCount > 0) complianceParts.push(`${overdueCount} overdue`);
  if (amberCount > 0) complianceParts.push(`${amberCount} due soon`);
  if (currentCount > 0) complianceParts.push(`${currentCount} current`);
  const complianceSummary =
    properties.length > 0
      ? `${properties.length} ${properties.length === 1 ? 'property' : 'properties'}${complianceParts.length > 0 ? ` — ${complianceParts.join(', ')}` : ''}`
      : null;

  return (
    <div className="min-h-full">
      {/* Page header */}
      <div className="border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-[18px] py-[14px]">
          <Link
            href="/clients"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] text-[var(--color-text-secondary)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="sr-only">Back to clients</span>
          </Link>
          <h1 className="truncate text-[20px] font-medium text-[var(--color-text-primary)]">
            {displayName}
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {/* Client summary card */}
        <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] font-medium"
              style={{ backgroundColor: avatar.bg, color: avatar.color }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-medium text-[var(--color-text-primary)]">{displayName}</p>
              {contactDetails.organization ? (
                <p className="mt-0.5 truncate text-[13px] text-[var(--color-text-secondary)]">
                  {contactDetails.organization}
                </p>
              ) : null}
              {complianceSummary ? (
                <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">{complianceSummary}</p>
              ) : null}
            </div>
          </div>

          {(contactDetails.email || contactDetails.phone || contactDetails.address) ? (
            <div className="mt-3 space-y-1 border-t-[0.5px] border-[var(--color-border-tertiary)] pt-3 text-[13px] text-[var(--color-text-secondary)]">
              {contactDetails.email ? (
                <p className="truncate">{contactDetails.email}</p>
              ) : null}
              {contactDetails.phone ? (
                <p className="truncate">{contactDetails.phone}</p>
              ) : null}
              {contactDetails.address ? (
                <p className="truncate">{contactDetails.address}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Properties section */}
        <div>
          <p className="mb-1.5 px-0.5 text-[13px] font-medium tracking-[0.3px] text-[var(--color-text-tertiary)]">
            Properties
          </p>
          <div className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
            {properties.length > 0 ? (
              properties.map((property, index) => (
                <div
                  key={property.id}
                  className={index > 0 ? 'border-t-[0.5px] border-[var(--color-border-tertiary)]' : ''}
                >
                  <PropertyRow property={property} clientId={id} />
                </div>
              ))
            ) : (
              <p className="p-4 text-[13px] text-[var(--color-text-secondary)]">
                No properties recorded for this client yet. Properties are created when you deliver jobs.
              </p>
            )}
          </div>
        </div>

        {/* Recent jobs section */}
        <div>
          <p className="mb-1.5 px-0.5 text-[13px] font-medium tracking-[0.3px] text-[var(--color-text-tertiary)]">
            Recent jobs
          </p>
          <div className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
            {jobs.length > 0 ? (
              jobs.slice(0, 5).map((job, index) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}/complete`}
                  className={`flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-[var(--color-background-secondary)]/50 ${
                    index > 0 ? 'border-t-[0.5px] border-[var(--color-border-tertiary)]' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-[var(--color-text-primary)]">
                      {job.title || job.address || 'Job'}
                    </p>
                    {job.address && job.title ? (
                      <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-secondary)]">
                        {job.address}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-[12px] text-[var(--color-text-tertiary)]">
                      {formatDate(job.scheduled_for ?? job.created_at) ?? 'No date'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
                    {formatStatus(job.status)}
                  </span>
                </Link>
              ))
            ) : (
              <p className="p-4 text-[13px] text-[var(--color-text-secondary)]">
                No jobs linked to this client yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
