import Link from 'next/link';

import { getCp12RemoteSignatureRequest } from '@/server/certificates';
import { PublicCp12SignatureClient } from './public-cp12-signature-client';

export default async function PublicCp12SignaturePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const request = await getCp12RemoteSignatureRequest(token);

  if (request.status === 'invalid') {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded-3xl border border-white/20 bg-white/90 p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-muted">Signature link unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground/70">
            This CP12 signature link is invalid or has been removed.
          </p>
        </div>
      </main>
    );
  }

  if (request.status === 'expired') {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded-3xl border border-white/20 bg-white/90 p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-muted">Signature link expired</h1>
          <p className="mt-2 text-sm text-muted-foreground/70">
            Ask your engineer to send you a fresh CP12 signature link.
          </p>
        </div>
      </main>
    );
  }

  if (request.status === 'completed') {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded-3xl border border-white/20 bg-white/90 p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-muted">CP12 already signed</h1>
          <p className="mt-2 text-sm text-muted-foreground/70">
            This certificate has already been completed.
          </p>
          {request.completedPdfUrl ? (
            <Link
              href={request.completedPdfUrl}
              target="_blank"
              className="mt-4 inline-flex rounded-full bg-[var(--action)] px-4 py-2 text-sm font-medium text-white"
            >
              Open completed certificate
            </Link>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="space-y-6">
        <div className="rounded-3xl border border-white/20 bg-white/90 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">Remote signature</p>
          <h1 className="mt-2 text-2xl font-semibold text-muted">CP12 Gas Safety Certificate</h1>
          <p className="mt-2 text-sm text-muted-foreground/70">
            Review the job details below, then sign to confirm receipt of the certificate.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/20 bg-white/90 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Property</p>
            <p className="mt-2 text-sm font-semibold text-muted">{request.propertyAddress || 'Property address on file'}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Landlord / owner</p>
            <p className="mt-2 text-sm text-muted">{request.landlordName || 'Responsible person'}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Inspection date</p>
            <p className="mt-2 text-sm text-muted">{request.inspectionDate || 'Not recorded'}</p>
          </div>

          <div className="rounded-3xl border border-white/20 bg-white/90 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Engineer</p>
            <p className="mt-2 text-sm font-semibold text-muted">{request.engineerName || 'Engineer on file'}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Company</p>
            <p className="mt-2 text-sm text-muted">{request.companyName || 'Company on file'}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Current draft</p>
            <Link
              href={request.previewPath}
              target="_blank"
              className="mt-2 inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-muted"
            >
              Preview current draft PDF
            </Link>
          </div>
        </div>

        {request.appliances.length ? (
          <div className="rounded-3xl border border-white/20 bg-white/90 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Appliances inspected</p>
            <div className="mt-3 space-y-2">
              {request.appliances.map((appliance, index) => (
                <div key={`${appliance.applianceType}-${index}`} className="rounded-2xl bg-[var(--muted)]/40 px-3 py-2 text-sm text-muted">
                  {appliance.applianceType}
                  {appliance.location ? ` - ${appliance.location}` : ''}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <PublicCp12SignatureClient token={token} />
      </div>
    </main>
  );
}
