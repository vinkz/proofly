export type PublicComplianceStatus = 'unknown' | 'overdue' | 'due_soon' | 'current';

export type PublicComplianceInfo = {
  status: PublicComplianceStatus;
  dotColor: string;
  label: string;
  sub: string | null;
  badgeClass: string;
  nextInspectionDue: string | null;
};

type CertificateLike = {
  certType?: string | null;
  cert_type?: string | null;
  issuedAt?: string | null;
  issued_at?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
};

export function normalizePublicDateOnly(value: string | null | undefined): string | null {
  const slice = String(value ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(slice) ? slice : null;
}

export function formatPublicDisplayDate(value: string | null | undefined): string | null {
  const normalized = normalizePublicDateOnly(value);
  if (!normalized) return null;
  const date = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function addOneYearDateOnly(value: string | null | undefined): string | null {
  const normalized = normalizePublicDateOnly(value);
  if (!normalized) return null;
  const date = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

export function deriveNextDueFromCertificates(certificates: CertificateLike[]): string | null {
  const datedCertificates = certificates
    .map((certificate) => {
      const type = String(certificate.certType ?? certificate.cert_type ?? '').toLowerCase();
      const issuedAt = normalizePublicDateOnly(
        certificate.issuedAt ?? certificate.issued_at ?? certificate.createdAt ?? certificate.created_at,
      );
      return issuedAt ? { type, issuedAt } : null;
    })
    .filter((certificate): certificate is { type: string; issuedAt: string } => Boolean(certificate))
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));

  const renewalCertificate =
    datedCertificates.find((certificate) => certificate.type === 'cp12') ??
    datedCertificates.find((certificate) => certificate.type === 'boiler_service') ??
    datedCertificates[0];

  return renewalCertificate ? addOneYearDateOnly(renewalCertificate.issuedAt) : null;
}

export function getPublicComplianceInfo(
  nextInspectionDue: string | null | undefined,
  hasCertificates: boolean,
  options: { dueSoonDays?: number } = {},
): PublicComplianceInfo {
  const normalized = normalizePublicDateOnly(nextInspectionDue);
  if (!normalized) {
    return {
      status: 'unknown',
      dotColor: 'var(--color-border-secondary)',
      label: hasCertificates ? 'Certificate issued' : 'No certificate on record',
      sub: null,
      badgeClass: 'bg-[var(--color-background-secondary)] text-[var(--color-text-tertiary)]',
      nextInspectionDue: null,
    };
  }

  const due = new Date(`${normalized}T00:00:00Z`).getTime();
  const today = new Date();
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const daysUntil = Math.floor((due - todayMs) / 86_400_000);
  const formattedDate = formatPublicDisplayDate(normalized) ?? normalized;

  if (daysUntil < 0) {
    return {
      status: 'overdue',
      dotColor: '#a32d2d',
      label: 'Certificate overdue',
      sub: `Expired ${formattedDate}`,
      badgeClass: 'bg-[var(--color-red)]/10 text-[var(--color-red)]',
      nextInspectionDue: normalized,
    };
  }

  const dueSoonDays = options.dueSoonDays ?? 45;
  if (daysUntil <= dueSoonDays) {
    return {
      status: 'due_soon',
      dotColor: '#BA7517',
      label: `Due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
      sub: `Renewal due: ${formattedDate}`,
      badgeClass: 'bg-[var(--color-amber)]/10 text-[var(--color-amber)]',
      nextInspectionDue: normalized,
    };
  }

  return {
    status: 'current',
    dotColor: '#1a7a52',
    label: 'Certificate current',
    sub: `Next inspection: ${formattedDate}`,
    badgeClass: 'bg-[var(--color-action-bg)] text-[var(--color-action)]',
    nextInspectionDue: normalized,
  };
}
