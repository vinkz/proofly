'use server';

import { z } from 'zod';

import { isEmailConfigured, sendEmail } from '@/lib/resend';
import {
  baseEmail,
  ctaButton,
  emailSubtitle,
  emailTitle,
  formatDate,
  infoCard,
  joinAddress,
  note,
  titleCase,
} from '@/lib/email-templates';
import { supabaseServerReadOnly, supabaseServerServiceRole, getSupabaseUser } from '@/lib/supabaseServer';
import { getSiteUrl } from './renewal-confirm';

const JobIdSchema = z.string().uuid();

const pickText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
};

export type RenewalSendResult =
  | { status: 'sent'; recipient: string }
  | { status: 'missing_recipient' }
  | { status: 'not_configured' }
  | { status: 'failed'; error?: string };

export type NextRenewalToSend = {
  jobId: string;
  address: string;
  renewalDue: string | null;
  dueToSend: boolean;
  completeHref: string;
};

/**
 * Dashboard helper: the single soonest CP12 renewal that still needs the engineer to send a
 * landlord request — regardless of whether it's the 8- or 4-week prompt. Best-effort: any error
 * (missing table, RLS) resolves to null so the dashboard never breaks.
 */
export async function getNextRenewalToSend(): Promise<NextRenewalToSend | null> {
  try {
    const readClient = await supabaseServerReadOnly();
    const user = await getSupabaseUser(readClient);
    if (!user) return null;

    const admin = await supabaseServerServiceRole();
    const today = new Date().toISOString().slice(0, 10);
    const windowEnd = (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + 56);
      return d.toISOString().slice(0, 10);
    })();

    // State-driven (mirrors the cron): the soonest due-and-not-booked property for this engineer.
    const { data, error } = await admin
      .from('properties')
      .select('id, name, address_line1, address_line2, town, postcode, next_service_due')
      .eq('user_id', user.id)
      .is('renewal_booked_at', null)
      .not('next_service_due', 'is', null)
      .lte('next_service_due', windowEnd)
      .order('next_service_due', { ascending: true })
      .limit(1);
    if (error || !data?.length) return null;
    const property = data[0] as unknown as {
      id: string;
      name: string | null;
      address_line1: string | null;
      address_line2: string | null;
      town: string | null;
      postcode: string | null;
      next_service_due: string | null;
    };

    // The latest job on the property anchors the in-app link the engineer acts from.
    const { data: latestJob } = await admin
      .from('jobs')
      .select('id')
      .eq('property_id', property.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const jobId = (latestJob as { id?: string } | null)?.id ?? '';

    const address =
      pickText(
        joinAddress([property.address_line1, property.address_line2, property.town, property.postcode], ''),
        property.name,
      ) || 'Property';

    return {
      jobId,
      address,
      renewalDue: property.next_service_due,
      dueToSend: Boolean(property.next_service_due && property.next_service_due <= today),
      completeHref: jobId ? `/jobs/${jobId}/complete` : '/dashboard',
    };
  } catch {
    return null;
  }
}

/**
 * Engineer-triggered send: emails the landlord a renewal request for a completed CP12 job,
 * linking them to the public job page where they can confirm a date. This is the
 * engineer-in-the-loop counterpart to the reminder cron, which only prompts the engineer.
 */
export async function sendLandlordRenewalRequest(jobId: string): Promise<RenewalSendResult> {
  const parsedJobId = JobIdSchema.parse(jobId);

  const readClient = await supabaseServerReadOnly();
  const user = await getSupabaseUser(readClient);
  if (!user) throw new Error('Unauthorized');

  const admin = await supabaseServerServiceRole();
  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .select('id, user_id, client_id, client_name, address, public_token, property_id')
    .eq('id', parsedJobId)
    .maybeSingle();
  if (jobErr) throw new Error(jobErr.message);
  if (!job) throw new Error('Job not found');
  if (job.user_id && job.user_id !== user.id) throw new Error('Unauthorized');

  if (!isEmailConfigured()) return { status: 'not_configured' };

  const [{ data: fields }, { data: profile }, { data: client }] = await Promise.all([
    admin.from('job_fields').select('field_key, value').eq('job_id', parsedJobId),
    admin
      .from('profiles')
      .select('default_engineer_name, full_name, company_name, company_email, company_phone')
      .eq('id', job.user_id ?? user.id)
      .maybeSingle(),
    job.client_id
      ? admin.from('clients').select('name, email, phone').eq('id', job.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const fieldMap = Object.fromEntries(
    (fields ?? []).map((field) => [field.field_key ?? '', field.value ?? null]),
  ) as Record<string, string | null>;

  const address =
    pickText(
      joinAddress(
        [
          fieldMap.job_address_line1,
          fieldMap.job_address_line2,
          fieldMap.job_address_city,
          fieldMap.job_postcode,
        ],
        '',
      ),
      fieldMap.property_address,
      job.address,
    ) || 'the property';

  const recipient = pickText(fieldMap.landlord_email, fieldMap.customer_email, client?.email ?? null);
  if (!recipient) return { status: 'missing_recipient' };

  const engineerName = pickText(profile?.default_engineer_name, profile?.full_name, profile?.company_name);
  const displayEngineerName = titleCase(engineerName || 'Your engineer');
  const publicUrl = `${getSiteUrl()}/j/${job.public_token}`;
  const dueDate = pickText(fieldMap.next_inspection_due, fieldMap.next_inspection_date);

  const html = baseEmail(
    [
      emailTitle('Time to renew your gas safety certificate'),
      emailSubtitle(
        `The gas safety certificate for ${address} is due for renewal. Confirm a date that works and ${displayEngineerName} will book the visit.`,
      ),
      infoCard('Certificate', [
        { label: 'Property', value: address },
        ...(dueDate ? [{ label: 'Renewal due', value: formatDate(dueDate) }] : []),
        { label: 'Engineer', value: displayEngineerName },
        { label: 'Engineer phone', value: profile?.company_phone ?? 'Not provided' },
      ]),
      ctaButton('Confirm a renewal date', publicUrl, 'green'),
      note('No account needed. Your engineer will confirm the visit.'),
    ].join(''),
    { subject: `Renewal due — ${address}`, sentOnBehalfOf: displayEngineerName },
  );

  const text = [
    `The gas safety certificate for ${address} is due for renewal.`,
    '',
    dueDate ? `Renewal due: ${formatDate(dueDate)}` : '',
    `Engineer: ${displayEngineerName}`,
    `Confirm a renewal date: ${publicUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const delivery = await sendEmail({
      to: recipient,
      subject: `Renewal due — ${address}`,
      replyTo: profile?.company_email ?? undefined,
      text,
      html,
    });
    if (delivery.status === 'sent') {
      // Record that the engineer asked this landlord to confirm a date, so the public job
      // page shows the confirm-a-date card even before the 60-day renewal window — otherwise
      // the email's "Confirm a renewal date" link lands on a page with no action to take.
      try {
        await admin.from('job_fields').delete().eq('job_id', parsedJobId).eq('field_key', 'renewal_requested_at');
        await admin.from('job_fields').insert({
          job_id: parsedJobId,
          field_key: 'renewal_requested_at',
          value: new Date().toISOString(),
        });
        // Mirror onto the property so the state-driven cron / engineer UX can read it without
        // walking job_fields. Best-effort; never fail the send over a marker write.
        if (job.property_id) {
          await admin
            .from('properties')
            .update({ renewal_requested_at: new Date().toISOString() } as never)
            .eq('id', job.property_id);
        }
      } catch (markError) {
        console.error('[renewals] failed to record renewal_requested_at:', markError);
      }
      return { status: 'sent', recipient };
    }
    if (delivery.status === 'not_configured') return { status: 'not_configured' };
    return { status: 'failed' };
  } catch (error) {
    console.error('[renewals] send failed:', error);
    return { status: 'failed', error: error instanceof Error ? error.message : undefined };
  }
}
