import 'server-only';

import { isEmailConfigured, sendEmail } from '@/lib/resend';
import { baseEmail, ctaButton, emailSubtitle, emailTitle, formatDate, infoCard, note, titleCase } from '@/lib/email-templates';
import type { supabaseServerServiceRole } from '@/lib/supabaseServer';

/**
 * Shared renewal-confirmation logic used by both landlord-facing entry points:
 *  - /j/[publicToken]  (a single certificate/job share link)
 *  - /p/[publicToken]  (the property vault)
 *
 * Both let a landlord confirm a renewal date with no account; this module turns that confirmation
 * into a real scheduled job for the engineer plus an email notification, so the two pages behave
 * identically rather than drifting apart.
 */

type AdminClient = Awaited<ReturnType<typeof supabaseServerServiceRole>>;

export const getSiteUrl = () =>
  (
    process.env.NEXT_PUBLIC_SHARE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'https://certnow.uk'
  ).replace(/\/$/, '');

export const pickText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
};

export const normalizeDateOnly = (value: string | null | undefined): string => {
  const slice = String(value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(slice) ? slice : '';
};

/**
 * Make sure a renewal CP12 job exists for the landlord's confirmation to land on. In the normal
 * flow this job was auto-created when the original CP12 was issued (linked by
 * `follow_up_source_job_id`). For older or service-only jobs that have no follow-up, we create one
 * here from the source job's landlord/property details so the engineer always gets a real job with
 * the confirmed date and access notes — never a dangling request. Best-effort; returns null on any
 * failure so the landlord submission is never blocked.
 */
export async function ensureRenewalJobForSource(
  admin: AdminClient,
  params: {
    sourceJob: { id: string; user_id: string | null; client_id: string | null; client_name: string | null; address: string | null };
    acceptedDate: string;
    tenantName: string;
    tenantPhone: string;
    accessNotes: string;
    propertyId?: string | null;
  },
): Promise<string | null> {
  const { sourceJob, acceptedDate, tenantName, tenantPhone, accessNotes, propertyId } = params;
  try {
    const existing = await admin
      .from('job_fields')
      .select('job_id')
      .eq('field_key', 'follow_up_source_job_id')
      .eq('value', sourceJob.id)
      .limit(1)
      .maybeSingle();
    let renewalJobId = (existing.data as { job_id?: string | null } | null)?.job_id ?? null;

    if (!renewalJobId) {
      // No follow-up job on record — build one from the source job's stored fields.
      const { data: sourceFields } = await admin
        .from('job_fields')
        .select('field_key, value')
        .eq('job_id', sourceJob.id);
      const fieldMap = Object.fromEntries(
        (sourceFields ?? []).map((row) => [row.field_key ?? '', row.value ?? null]),
      ) as Record<string, string | null>;
      const landlordName = pickText(fieldMap.landlord_name, sourceJob.client_name);
      const propertyAddress = pickText(
        fieldMap.property_address,
        [fieldMap.job_address_line1, fieldMap.job_address_line2, fieldMap.job_address_city, fieldMap.job_postcode]
          .filter(Boolean)
          .join(', '),
        sourceJob.address,
      );
      const { data: createdJob, error: createErr } = await admin
        .from('jobs')
        .insert({
          client_id: sourceJob.client_id ?? null,
          client_name: landlordName || sourceJob.client_name || null,
          address: propertyAddress || sourceJob.address || null,
          status: 'active',
          user_id: sourceJob.user_id,
          job_type: 'safety_check',
          title: `CP12 for ${landlordName || 'upcoming job'}`,
          ...(propertyId ? { property_id: propertyId } : {}),
        } as never)
        .select('id')
        .single();
      if (createErr || !createdJob) {
        console.error('[renewal-confirm] failed to create renewal job:', createErr?.message);
        return null;
      }
      renewalJobId = (createdJob as { id: string }).id;

      // Carry across the landlord/property fields so the engineer opens a pre-filled job.
      const carryKeys = [
        'landlord_name', 'landlord_company', 'landlord_address_line1', 'landlord_address_line2',
        'landlord_city', 'landlord_postcode', 'landlord_tel', 'landlord_email', 'landlord_address',
        'property_address', 'property_name', 'job_address_name', 'job_address_line1', 'job_address_line2',
        'job_address_city', 'job_postcode', 'postcode',
      ];
      const carryRows = carryKeys
        .map((key) => (fieldMap[key] ? { job_id: renewalJobId as string, field_key: key, value: fieldMap[key] } : null))
        .filter((row): row is { job_id: string; field_key: string; value: string } => Boolean(row));
      carryRows.push({ job_id: renewalJobId, field_key: 'follow_up_source_job_id', value: sourceJob.id });
      await admin.from('job_fields').insert(carryRows);
    }

    if (acceptedDate) {
      await admin
        .from('jobs')
        .update({ scheduled_for: `${acceptedDate}T09:00`, status: 'active' })
        .eq('id', renewalJobId);
      await admin
        .from('job_fields')
        .delete()
        .eq('job_id', renewalJobId)
        .eq('field_key', 'inspection_date');
      await admin.from('job_fields').insert({ job_id: renewalJobId, field_key: 'inspection_date', value: acceptedDate });
    }

    const noteRows = [
      tenantName ? { job_id: renewalJobId, field_key: 'tenant_name', value: tenantName } : null,
      tenantPhone ? { job_id: renewalJobId, field_key: 'tenant_phone', value: tenantPhone } : null,
      accessNotes ? { job_id: renewalJobId, field_key: 'access_notes', value: accessNotes } : null,
    ].filter((row): row is { job_id: string; field_key: string; value: string } => Boolean(row));
    if (noteRows.length) {
      await admin
        .from('job_fields')
        .delete()
        .eq('job_id', renewalJobId)
        .in('field_key', noteRows.map((row) => row.field_key));
      await admin.from('job_fields').insert(noteRows);
    }

    return renewalJobId;
  } catch (error) {
    console.error('[renewal-confirm] ensureRenewalJobForSource failed:', error);
    return null;
  }
}

/**
 * Email the engineer that a landlord responded to (or confirmed a date for) a renewal, so the
 * booking doesn't only live on a dashboard list. Best-effort; never throws.
 */
export async function notifyEngineerOfRenewalResponse(params: {
  admin: AdminClient;
  engineerUserId: string | null;
  address: string;
  landlordName: string | null;
  acceptedDate: string;
  preferredDates: string;
  tenantName: string;
  tenantPhone: string;
  accessNotes: string;
  renewalJobId: string | null;
}) {
  const { admin, engineerUserId, address, landlordName, acceptedDate, preferredDates, tenantName, tenantPhone, accessNotes, renewalJobId } = params;
  if (!engineerUserId || !isEmailConfigured()) return;
  try {
    const { data: profile } = await admin
      .from('profiles')
      .select('company_email')
      .eq('id', engineerUserId)
      .maybeSingle();
    let recipient = pickText((profile as { company_email?: string | null } | null)?.company_email);
    if (!recipient) {
      const { data: authUser } = await admin.auth.admin.getUserById(engineerUserId);
      recipient = pickText(authUser?.user?.email);
    }
    if (!recipient) return;

    const propertyLabel = address || 'the property';
    const dateConfirmed = Boolean(acceptedDate);
    const subject = dateConfirmed
      ? `Renewal confirmed — ${propertyLabel}`
      : `Renewal response — ${propertyLabel}`;
    const headline = dateConfirmed
      ? 'A landlord confirmed a renewal date'
      : 'A landlord responded to your renewal request';
    const jobHref = renewalJobId ? `${getSiteUrl()}/jobs/${renewalJobId}` : `${getSiteUrl()}/dashboard`;

    const rows: Array<{ label: string; value: string }> = [
      { label: 'Property', value: propertyLabel },
      { label: 'Landlord', value: titleCase(landlordName || 'Landlord') },
    ];
    if (dateConfirmed) rows.push({ label: 'Confirmed date', value: formatDate(acceptedDate) });
    if (preferredDates.trim()) rows.push({ label: 'Timing notes', value: preferredDates.trim() });
    if (tenantName.trim()) rows.push({ label: 'Tenant', value: tenantName.trim() });
    if (tenantPhone.trim()) rows.push({ label: 'Tenant phone', value: tenantPhone.trim() });
    if (accessNotes.trim()) rows.push({ label: 'Access notes', value: accessNotes.trim() });

    await sendEmail({
      to: recipient,
      subject,
      text: [
        headline,
        '',
        ...rows.map((row) => `${row.label}: ${row.value}`),
        '',
        dateConfirmed
          ? `The renewal job is scheduled and ready to open: ${jobHref}`
          : `Open the request to follow up: ${jobHref}`,
      ].join('\n'),
      html: baseEmail(
        [
          emailTitle(dateConfirmed ? 'Renewal date confirmed' : 'Renewal response received'),
          emailSubtitle(
            dateConfirmed
              ? `The landlord confirmed ${formatDate(acceptedDate)} for ${propertyLabel}. The renewal job is scheduled with their access details.`
              : `The landlord responded about the renewal at ${propertyLabel}.`,
          ),
          infoCard('Renewal', rows),
          ctaButton(dateConfirmed ? 'Open the scheduled job' : 'Open the request', jobHref, 'green'),
          note('Confirmed on the landlord’s property record link — no account needed on their side.'),
        ].join(''),
        { subject },
      ),
    });
  } catch (error) {
    console.error('[renewal-confirm] engineer renewal notification failed:', error);
  }
}
