import { NextResponse } from 'next/server';

import { isEmailConfigured, sendEmail } from '@/lib/resend';
import {
  baseEmail,
  classificationBadge,
  ctaButton,
  emailSubtitle,
  emailTitle,
  formatDate,
  infoCard,
  joinAddress,
  note,
  titleCase,
} from '@/lib/email-templates';
import { supabaseServerServiceRole } from '@/lib/supabaseServer';
import { getSiteUrl } from '@/server/renewal-confirm';

type ReminderRow = {
  id: string;
  job_id: string | null;
  user_id: string | null;
  kind: string | null;
  due_date: string;
};

type EmailResult = 'sent' | 'failed' | 'missing_recipient';

const pickText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
};

const formatAddress = (fields: Record<string, string | null>, fallback: string | null | undefined) =>
  pickText(
    joinAddress(
      [
      fields.job_address_line1,
      fields.job_address_line2,
      fields.job_address_city,
      fields.job_postcode,
      ],
      '',
    ),
    fields.property_address,
    fallback,
  );

const reminderCopy = (kind: string | null, address: string, publicUrl: string) => {
  // CP12 renewal reminders are engineer-facing prompts: we ask the engineer to review the
  // job and send the landlord a renewal request, rather than emailing the landlord directly.
  if (kind?.startsWith('landlord_cp12_4_weeks')) {
    return {
      subject: `Renewal due in ~4 weeks — ${address}`,
      text: [
        'A gas safety certificate you issued is due for renewal in around 4 weeks.',
        '',
        `Property: ${address}`,
        'Review the job and send the landlord a renewal request:',
        publicUrl,
      ].join('\n'),
    };
  }

  if (kind?.startsWith('landlord_cp12_8_weeks') || kind?.startsWith('engineer_cp12_8_weeks')) {
    return {
      subject: `Renewal coming up in ~8 weeks — ${address}`,
      text: [
        'A gas safety certificate you issued is due for renewal in around 8 weeks.',
        '',
        `Property: ${address}`,
        'Review the job and send the landlord a renewal request:',
        publicUrl,
      ].join('\n'),
    };
  }

  if (kind?.startsWith('gas_warning_id')) {
    return {
      subject: `Urgent: gas warning follow-up needed — ${address}`,
      text: [
        'An Immediately Dangerous gas warning follow-up is due.',
        '',
        `Property: ${address}`,
        `Open job context: ${publicUrl}`,
      ].join('\n'),
    };
  }

  if (kind?.startsWith('gas_warning_ar')) {
    return {
      subject: `At Risk appliance follow-up — ${address}`,
      text: [
        'An At Risk gas warning follow-up is due.',
        '',
        `Property: ${address}`,
        `Open job context: ${publicUrl}`,
      ].join('\n'),
    };
  }

  if (kind?.startsWith('gas_warning_ncs')) {
    return {
      subject: `Gas warning follow-up due — ${address}`,
      text: [
        'A Not to Current Standards gas warning follow-up is due.',
        '',
        `Property: ${address}`,
        `Open job context: ${publicUrl}`,
      ].join('\n'),
    };
  }

  return {
    subject: `CertNow reminder: ${address}`,
    text: [`A CertNow reminder is due.`, '', `Property: ${address}`, `Open job context: ${publicUrl}`].join('\n'),
  };
};

type RenewalPropertyRow = {
  id: string;
  user_id: string | null;
  name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  town: string | null;
  postcode: string | null;
  next_service_due: string | null;
  renewal_requested_at: string | null;
  renewal_last_reminded_at: string | null;
};

const RENEWAL_WINDOW_DAYS = 56; // begin nudging ~8 weeks before due
const RENEWAL_GRACE_DAYS = 30; // stop nudging once more than 30 days overdue
const RENEWAL_CADENCE_DAYS = 7; // at most one nudge per property per week

const shiftDateOnly = (base: Date, days: number) => {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * State-driven CP12 renewal nudges (replaces the old fixed 8/4-week reminder rows). Emails the
 * engineer for any property that is due-soon-or-overdue, not yet booked, and not nudged within the
 * cadence window — stopping automatically once the landlord books (renewal_booked_at) or a new
 * certificate advances next_service_due (which clears the lifecycle on delivery).
 */
async function sendRenewalNudgesForProperties(
  admin: Awaited<ReturnType<typeof supabaseServerServiceRole>>,
) {
  const counts = { processed: 0, sent: 0, failed: 0, skipped: 0 };
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const windowEnd = shiftDateOnly(now, RENEWAL_WINDOW_DAYS);
  const overdueFloor = shiftDateOnly(now, -RENEWAL_GRACE_DAYS);
  const cadenceCutoff = new Date(now.getTime() - RENEWAL_CADENCE_DAYS * 86_400_000).toISOString();

  const { data, error } = await admin
    .from('properties')
    .select(
      'id, user_id, name, address_line1, address_line2, town, postcode, next_service_due, renewal_requested_at, renewal_last_reminded_at',
    )
    .is('renewal_booked_at', null)
    .not('next_service_due', 'is', null)
    .lte('next_service_due', windowEnd)
    .gte('next_service_due', overdueFloor)
    .limit(100);
  if (error) {
    // Table or renewal columns not migrated yet — nothing to do.
    if (error.code === '42P01' || error.code === '42703') return counts;
    throw new Error(error.message);
  }

  for (const property of (data ?? []) as unknown as RenewalPropertyRow[]) {
    counts.processed += 1;
    if (!property.user_id || !property.next_service_due) {
      counts.skipped += 1;
      continue;
    }
    // Throttle: skip if nudged within the cadence window (ISO timestamps compare lexically).
    if (property.renewal_last_reminded_at && property.renewal_last_reminded_at >= cadenceCutoff) {
      counts.skipped += 1;
      continue;
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('default_engineer_name, full_name, company_name, company_email')
      .eq('id', property.user_id)
      .maybeSingle();
    let recipient = pickText(profile?.company_email ?? null);
    if (!recipient) {
      const { data: authUser } = await admin.auth.admin.getUserById(property.user_id);
      recipient = pickText(authUser?.user?.email);
    }
    if (!recipient) {
      counts.skipped += 1;
      continue;
    }

    // The most recent job on the property anchors the landlord name and the in-app link.
    const { data: latestJob } = await admin
      .from('jobs')
      .select('id, client_name')
      .eq('property_id', property.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const address =
      pickText(
        [property.address_line1, property.address_line2, property.town, property.postcode]
          .filter(Boolean)
          .join(', '),
        property.name,
      ) || 'the property';
    const landlordName = titleCase(pickText(latestJob?.client_name ?? null, property.name) || 'Not provided');
    const appUrl = latestJob?.id ? `${getSiteUrl()}/jobs/${latestJob.id}/complete` : `${getSiteUrl()}/dashboard`;
    const overdue = property.next_service_due < today;
    const alreadyRequested = Boolean(property.renewal_requested_at);
    const subject = overdue ? `Renewal overdue — ${address}` : `Renewal due soon — ${address}`;

    let delivery;
    try {
      delivery = await sendEmail({
        to: recipient,
        replyTo: profile?.company_email ?? undefined,
        subject,
        text: [
          overdue
            ? 'A gas safety certificate you issued is now overdue for renewal.'
            : 'A gas safety certificate you issued is due for renewal soon.',
          '',
          `Property: ${address}`,
          `Landlord: ${landlordName}`,
          `Renewal due: ${formatDate(property.next_service_due)}`,
          '',
          alreadyRequested
            ? 'You have already sent the landlord a request — this is a reminder to follow up.'
            : 'Review the job and send the landlord a renewal request.',
          appUrl,
        ].join('\n'),
        html: baseEmail(
          [
            emailTitle(overdue ? 'Renewal overdue' : 'Renewal due soon'),
            emailSubtitle(
              overdue
                ? `A gas safety certificate you issued for ${address} is overdue for renewal. Send the landlord a renewal request.`
                : `A gas safety certificate you issued for ${address} is due for renewal soon. Review the job and send the landlord a renewal request.`,
            ),
            infoCard('Renewal', [
              { label: 'Property', value: address },
              { label: 'Landlord', value: landlordName },
              { label: 'Renewal due', value: formatDate(property.next_service_due) },
              ...(alreadyRequested ? [{ label: 'Status', value: 'Request already sent — follow up' }] : []),
            ]),
            ctaButton('Review & send renewal request', appUrl, 'green'),
            note('Nothing is sent to the landlord until you choose to send it.'),
          ].join(''),
          { subject },
        ),
      });
    } catch (sendError) {
      console.error('[cron/reminders] renewal nudge failed:', sendError);
      delivery = { status: 'failed' as const };
    }

    if (delivery.status === 'sent') {
      counts.sent += 1;
      try {
        await admin
          .from('properties')
          .update({ renewal_last_reminded_at: new Date().toISOString() } as never)
          .eq('id', property.id);
      } catch (markErr) {
        console.error('[cron/reminders] failed to set renewal_last_reminded_at:', markErr);
      }
    } else {
      counts.failed += 1;
    }
  }
  return counts;
}

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  if (configuredSecret) {
    const header = request.headers.get('authorization') ?? '';
    if (header !== `Bearer ${configuredSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({
      processed: 0,
      sent: 0,
      delivery: 'email_not_configured',
    });
  }

  const admin = await supabaseServerServiceRole();
  const today = new Date().toISOString().slice(0, 10);
  const { data: reminders, error } = await admin
    .from('reminders')
    .select('id, job_id, user_id, kind, due_date')
    .is('sent_at', null)
    .lte('due_date', today)
    .limit(100);
  if (error) {
    if (error.code === '42P01') return NextResponse.json({ processed: 0, sent: 0 });
    throw new Error(error.message);
  }

  const rows = (reminders ?? []) as ReminderRow[];
  const results: Record<EmailResult, number> = {
    sent: 0,
    failed: 0,
    missing_recipient: 0,
  };
  const sentIds: string[] = [];

  for (const reminder of rows) {
    if (!reminder.job_id) {
      results.missing_recipient += 1;
      continue;
    }

    // CP12 renewals are now driven by property state (sendRenewalNudgesForProperties below),
    // so any legacy CP12 reminder rows are skipped here to avoid double-sending.
    if (reminder.kind?.startsWith('landlord_cp12_') || reminder.kind?.startsWith('engineer_cp12_')) {
      continue;
    }

    const { data: job } = await admin
      .from('jobs')
      .select('id, user_id, client_id, client_name, address, public_token')
      .eq('id', reminder.job_id)
      .maybeSingle();
    if (!job) {
      results.failed += 1;
      continue;
    }

    const [{ data: fields }, { data: profile }, { data: client }] = await Promise.all([
      admin.from('job_fields').select('field_key, value').eq('job_id', reminder.job_id),
      admin
        .from('profiles')
        .select('default_engineer_name, full_name, company_name, company_email, company_phone')
        .eq('id', job.user_id ?? reminder.user_id ?? '')
        .maybeSingle(),
      job.client_id
        ? admin.from('clients').select('name, email, phone').eq('id', job.client_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const fieldMap = Object.fromEntries((fields ?? []).map((field) => [field.field_key ?? '', field.value ?? null]));
    const address = formatAddress(fieldMap, job.address);
    // Every reminder is now engineer-facing, so the CTA points at the in-app job page where
    // the engineer reviews the job and chooses to send the landlord a renewal request.
    const appJobUrl = `${getSiteUrl()}/jobs/${job.id}/complete`;
    const engineerName = pickText(profile?.default_engineer_name, profile?.full_name, profile?.company_name);
    let recipient = pickText(profile?.company_email ?? null);
    const engineerUserId = job.user_id ?? reminder.user_id ?? null;
    if (!recipient && engineerUserId) {
      // company_email is rarely set (not exposed in the UI), so fall back to the engineer's
      // login email — otherwise these reminders silently never send.
      const { data: authUser } = await admin.auth.admin.getUserById(engineerUserId);
      recipient = pickText(authUser?.user?.email);
    }

    if (!recipient) {
      results.missing_recipient += 1;
      continue;
    }

    const copy = reminderCopy(reminder.kind, address || 'the property', appJobUrl);
    const displayEngineerName = titleCase(engineerName || 'Your engineer');
    const landlordName = titleCase(pickText(fieldMap.landlord_name, client?.name ?? null, job.client_name) || 'Not provided');
    const isFourWeekRenewal = reminder.kind?.startsWith('landlord_cp12_4_weeks');
    const isCp12Renewal =
      reminder.kind?.startsWith('landlord_cp12_') || reminder.kind?.startsWith('engineer_cp12_');
    const isGasWarning = reminder.kind?.startsWith('gas_warning_');
    const classification = reminder.kind?.startsWith('gas_warning_id')
      ? 'ID'
      : reminder.kind?.startsWith('gas_warning_ar')
        ? 'AR'
        : reminder.kind?.startsWith('gas_warning_ncs')
          ? 'NCS'
          : '';
    const html = isCp12Renewal
      ? baseEmail(
          [
            emailTitle(isFourWeekRenewal ? 'Renewal due soon' : 'Renewal coming up'),
            emailSubtitle(
              isFourWeekRenewal
                ? `A gas safety certificate you issued for ${address} is due for renewal in approximately 4 weeks. Review the job and send the landlord a renewal request.`
                : `A gas safety certificate you issued for ${address} is due for renewal in approximately 8 weeks. Review the job and send the landlord a renewal request.`,
            ),
            infoCard('Renewal', [
              { label: 'Property', value: address },
              { label: 'Landlord', value: landlordName },
              { label: 'Renewal due', value: formatDate(reminder.due_date) },
            ]),
            ctaButton('Review & send renewal request', appJobUrl, 'green'),
            note('Nothing is sent to the landlord until you choose to send it.'),
          ].join(''),
          { subject: copy.subject },
        )
      : isGasWarning
        ? baseEmail(
            [
              emailTitle(classification === 'ID' ? 'Urgent follow-up required' : classification === 'AR' ? 'Follow-up visit needed' : 'Follow-up recommended'),
              emailSubtitle(
                classification === 'ID'
                  ? 'A gas appliance marked Immediately Dangerous requires a follow-up visit. This is a safety-critical issue.'
                  : classification === 'AR'
                    ? 'A gas appliance marked At Risk requires a follow-up visit.'
                    : 'A gas appliance flagged as Not to Current Standards may need a follow-up visit.',
              ),
              infoCard('Property', [
                { label: 'Property', value: address },
                { label: 'Landlord', value: landlordName },
                { label: 'Appliance', value: pickText(fieldMap.appliance_type, fieldMap.appliance_location) || 'Not provided' },
                { label: 'Classification', value: classificationBadge(classification), rawValue: true },
              ]),
              ctaButton(classification === 'NCS' ? 'View job' : 'Open follow-up job', appJobUrl, 'green'),
            ].join(''),
            { subject: copy.subject },
          )
        : baseEmail(
            [
              emailTitle('Reminder'),
              emailSubtitle(`A reminder is due for ${address}.`),
              infoCard('Reminder', [
                { label: 'Property', value: address },
                { label: 'Due', value: formatDate(reminder.due_date) },
                { label: 'Engineer', value: displayEngineerName },
              ]),
              ctaButton('Open job', appJobUrl, 'green'),
            ].join(''),
            { subject: copy.subject },
          );
    let delivery;
    try {
      delivery = await sendEmail({
        to: recipient,
        subject: copy.subject,
        text: copy.text,
        html,
      });
    } catch (error) {
      console.error('[cron/reminders] email failed:', error);
      delivery = { status: 'failed' as const };
    }

    if (delivery.status === 'sent') {
      results.sent += 1;
      sentIds.push(reminder.id);
    } else {
      results.failed += 1;
    }
  }

  if (sentIds.length) {
    const { error: updateErr } = await admin
      .from('reminders')
      .update({ sent_at: new Date().toISOString() })
      .in('id', sentIds);
    if (updateErr) throw new Error(updateErr.message);
  }

  const renewal = await sendRenewalNudgesForProperties(admin);

  return NextResponse.json({
    processed: rows.length + renewal.processed,
    sent: results.sent + renewal.sent,
    failed: results.failed + renewal.failed,
    missingRecipient: results.missing_recipient,
    renewalSent: renewal.sent,
    renewalSkipped: renewal.skipped,
    delivery: 'resend',
  });
}
