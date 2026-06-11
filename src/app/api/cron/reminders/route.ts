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
    const recipient = pickText(profile?.company_email ?? null);

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

  return NextResponse.json({
    processed: rows.length,
    sent: results.sent,
    failed: results.failed,
    missingRecipient: results.missing_recipient,
    delivery: 'resend',
  });
}
