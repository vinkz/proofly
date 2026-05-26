import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPublicPropertyByToken } from '@/server/public-property';
import { PropertyRenewalForm } from './renewal-form';

const formatDate = (value: string | null | undefined) => {
  if (!value) return null;
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const getComplianceBadge = (nextServiceDue: string | null) => {
  if (!nextServiceDue) return { label: 'No cert date', badgeClass: 'bg-[var(--color-background-secondary)] text-[var(--color-text-tertiary)]', status: 'unknown' as const };
  const due = new Date(`${nextServiceDue.slice(0, 10)}T00:00:00`).getTime();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const daysUntil = Math.floor((due - todayStart) / 86_400_000);
  if (daysUntil < 0) return { label: 'Overdue', badgeClass: 'bg-[var(--color-red)]/10 text-[var(--color-red)]', status: 'overdue' as const };
  if (daysUntil <= 45) return { label: `Due in ${daysUntil}d`, badgeClass: 'bg-[var(--color-amber)]/10 text-[var(--color-amber)]', status: 'amber' as const };
  return { label: 'Current', badgeClass: 'bg-[var(--color-action-bg)] text-[var(--color-action)]', status: 'current' as const };
};

const JOB_TYPE_LABELS: Record<string, string> = {
  safety_check: 'Gas Safety Check',
  service: 'Boiler Service',
  safety_check_service: 'Gas Safety Check & Service',
  breakdown: 'Breakdown',
  installation: 'Installation',
  warning_notice: 'Gas Warning Notice',
  general: 'General Works',
};

export default async function PropertyVaultPage({ params }: { params: Promise<{ publicToken: string }> }) {
  const { publicToken } = await params;
  const vault = await getPublicPropertyByToken(publicToken);
  if (!vault) notFound();

  const badge = getComplianceBadge(vault.nextServiceDue);
  const ctaLabel = vault.jobs.length === 0
    ? 'Request Gas Safety Check'
    : badge.status === 'overdue' || badge.status === 'amber'
      ? 'Request Renewal'
      : 'Book next service';

  return (
    <div className="min-h-screen bg-[var(--color-background-secondary)]">
      {/* Minimal header */}
      <header className="border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
        <div className="mx-auto flex h-12 max-w-lg items-center justify-between px-4">
          <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">CertNow</span>
          <span className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Property Vault</span>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-3 px-4 py-5">

        {/* Property address */}
        <section className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Property</p>
          <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[var(--color-text-primary)]">
            {vault.name || vault.address.split(',')[0]}
          </h1>
          {vault.name ? (
            <p className="mt-0.5 text-[14px] text-[var(--color-text-secondary)]">{vault.address}</p>
          ) : vault.address.includes(',') ? (
            <p className="mt-0.5 text-[14px] text-[var(--color-text-secondary)]">{vault.address.split(',').slice(1).join(',').trim()}</p>
          ) : null}
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${badge.badgeClass}`}>
              {badge.label}
            </span>
            {vault.nextServiceDue ? (
              <p className="text-[12px] text-[var(--color-text-tertiary)]">
                Next due: {formatDate(vault.nextServiceDue)}
              </p>
            ) : null}
          </div>
        </section>

        {/* Certificates */}
        {vault.certificates.length > 0 ? (
          <section className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Certificates</p>
            <div className="mt-3 space-y-2">
              {vault.certificates.map((cert) => (
                <div key={cert.id} className="flex items-center justify-between gap-3 rounded-[12px] bg-[var(--color-background-secondary)] px-3 py-2.5">
                  <div>
                    <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{cert.label}</p>
                    {cert.issuedAt ? (
                      <p className="text-[11px] text-[var(--color-text-tertiary)]">Issued {formatDate(cert.issuedAt)}</p>
                    ) : null}
                  </div>
                  {cert.downloadUrl ? (
                    <Link
                      href={cert.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center justify-center rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 text-[11px] font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-action)]"
                    >
                      Download
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Engineer info */}
        {(vault.engineer.name || vault.engineer.company) ? (
          <section className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Engineer</p>
            <p className="mt-1.5 text-[15px] font-medium text-[var(--color-text-primary)]">
              {vault.engineer.company || vault.engineer.name}
            </p>
            {vault.engineer.company && vault.engineer.name ? (
              <p className="mt-0.5 text-[13px] text-[var(--color-text-secondary)]">{vault.engineer.name}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--color-text-tertiary)]">
              {vault.engineer.gasSafeNumber ? <span>Gas Safe: {vault.engineer.gasSafeNumber}</span> : null}
              {vault.engineer.phone ? <span>{vault.engineer.phone}</span> : null}
              {vault.engineer.email ? <span>{vault.engineer.email}</span> : null}
            </div>
          </section>
        ) : null}

        {/* Service history */}
        {vault.jobs.length > 0 ? (
          <section className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Service history</p>
            <div className="mt-3 space-y-2">
              {vault.jobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between gap-3 rounded-[12px] bg-[var(--color-background-secondary)] px-3 py-2.5">
                  <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                    {job.title || JOB_TYPE_LABELS[job.jobType ?? ''] || 'Service visit'}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-tertiary)]">
                    {formatDate(job.scheduledFor ?? job.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Renewal / request CTA */}
        <section className={`rounded-[16px] border-[0.5px] p-4 shadow-sm ${
          badge.status === 'overdue'
            ? 'border-[var(--color-red)]/30 bg-[var(--color-red-bg)]'
            : badge.status === 'amber'
              ? 'border-[var(--color-amber)]/30 bg-[var(--color-amber-bg)]'
              : 'border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]'
        }`}>
          <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">{ctaLabel}</p>
          {badge.status === 'overdue' ? (
            <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">This property&apos;s gas safety certificate has expired. Request a renewal to stay compliant.</p>
          ) : badge.status === 'amber' ? (
            <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">Your certificate expires soon. Book your renewal now to avoid a gap in cover.</p>
          ) : vault.jobs.length === 0 ? (
            <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">No service history found. Send your access details and the engineer will be in touch.</p>
          ) : (
            <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">Your certificate is current. Use this form to book your next service.</p>
          )}
          <div className="mt-4">
            {vault.hasRenewalRequest && vault.renewalRequestStatus === 'pending' ? (
              <div className="rounded-[10px] bg-[var(--color-action-bg)] p-3">
                <p className="text-[13px] font-medium text-[var(--color-action)]">Renewal request received</p>
                <p className="mt-0.5 text-[12px] text-[var(--color-text-secondary)]">Your engineer has been notified and will be in touch.</p>
              </div>
            ) : (
              <PropertyRenewalForm token={vault.token} ctaLabel={ctaLabel} />
            )}
          </div>
        </section>

        <p className="pb-4 text-center text-[11px] text-[var(--color-text-tertiary)]">Powered by CertNow</p>
      </main>
    </div>
  );
}
