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

type ReminderRow = {
  id: string;
  job_id: string | null;
  user_id: string | null;
  kind: string | null;
  due_date: string;
};

type EmailResult = 'sent' | 'failed' | 'missing_recipient';

const getSiteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000').replace(/\/$/, '');

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

const reminderCopy = (kind: string | null, address: string, publicUrl: string, engineerName: string) => {
  if (kind?.startsWith('landlord_cp12_4_weeks')) {
    return {
      subject: `Gas safety renewal due soon — ${address}`,
      text: [
        'Your gas safety certificate is due for renewal in around 4 weeks.',
        '',
        `Property: ${address}`,
        `Engineer: ${engineerName || 'Your gas engineer'}`,
        `Request renewal or view the certificate: ${publicUrl}`,
      ].join('\n'),
    };
  }

  if (kind?.startsWith('landlord_cp12_8_weeks')) {
    return {
      subject: `Gas safety renewal coming up — ${address}`,
      text: [
        'Your gas safety certificate is due for renewal in around 8 weeks.',
        '',
        `Property: ${address}`,
        `Engineer: ${engineerName || 'Your gas engineer'}`,
        `Request renewal or view the certificate: ${publicUrl}`,
      ].join('\n'),
    };
  }

  if (kind?.startsWith('engineer_cp12_8_weeks')) {
    return {
      subject: `CP12 renewal due soon — ${address}`,
      text: [
        'A CP12 renewal is due in around 8 weeks.',
        '',
        `Property: ${address}`,
        `Open job context: ${publicUrl}`,
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
    const publicUrl = `${getSiteUrl()}/j/${job.public_token}`;
    const engineerName = pickText(profile?.default_engineer_name, profile?.full_name, profile?.company_name);
    const isLandlordReminder = reminder.kind?.startsWith('landlord_');
    const recipient = isLandlordReminder
      ? pickText(fieldMap.landlord_email, fieldMap.customer_email, client?.email ?? null)
      : pickText(profile?.company_email ?? null);

    if (!recipient) {
      results.missing_recipient += 1;
      continue;
    }

    const copy = reminderCopy(reminder.kind, address || 'the property', publicUrl, engineerName);
    const displayEngineerName = titleCase(engineerName || 'Your engineer');
    const landlordName = titleCase(pickText(fieldMap.landlord_name, client?.name ?? null, job.client_name) || 'Not provided');
    const isFourWeekLandlord = reminder.kind?.startsWith('landlord_cp12_4_weeks');
    const isEngineerCp12 = reminder.kind?.startsWith('engineer_cp12_8_weeks');
    const isGasWarning = reminder.kind?.startsWith('gas_warning_');
    const classification = reminder.kind?.startsWith('gas_warning_id')
      ? 'ID'
      : reminder.kind?.startsWith('gas_warning_ar')
        ? 'AR'
        : reminder.kind?.startsWith('gas_warning_ncs')
          ? 'NCS'
          : '';
    const html = isEngineerCp12
      ? baseEmail(
          [
            emailTitle('CP12 renewal coming up'),
            emailSubtitle('A gas safety certificate is due for renewal in approximately 8 weeks.'),
            infoCard('Property', [
              { label: 'Property', value: address },
              { label: 'Landlord', value: landlordName },
              { label: 'Certificate issued', value: 'Not provided' },
              { label: 'Renewal due', value: formatDate(reminder.due_date) },
            ]),
            ctaButton('Create renewal job', publicUrl, 'green'),
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
              ctaButton(classification === 'NCS' ? 'View job' : 'Open follow-up job', publicUrl, 'green'),
            ].join(''),
            { subject: copy.subject },
          )
        : baseEmail(
            [
              emailTitle(isFourWeekLandlord ? 'Renewal due soon' : 'Renewal coming up'),
              emailSubtitle(
                isFourWeekLandlord
                  ? `The gas safety certificate for ${address} is due for renewal in approximately 4 weeks. Book your engineer now to stay compliant.`
                  : `The gas safety certificate for ${address} is due for renewal in approximately 8 weeks.`,
              ),
              infoCard('Certificate', [
                { label: 'Property', value: address },
                { label: 'Current certificate expires', value: formatDate(reminder.due_date) },
                { label: 'Engineer', value: displayEngineerName },
                { label: 'Engineer phone', value: profile?.company_phone ?? 'Not provided' },
              ]),
              ctaButton(isFourWeekLandlord ? 'Book renewal now' : 'Request renewal', publicUrl, 'green'),
              note('No account needed. Your engineer will confirm the visit.'),
            ].join(''),
            { subject: copy.subject, sentOnBehalfOf: displayEngineerName },
          );
    let delivery;
    try {
      delivery = await sendEmail({
        to: recipient,
        subject: copy.subject,
        replyTo: isLandlordReminder ? profile?.company_email ?? undefined : undefined,
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
