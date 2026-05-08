import { NextResponse } from 'next/server';

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
    fields.property_address,
    [
      fields.job_address_line1,
      fields.job_address_line2,
      fields.job_address_city,
      fields.job_postcode,
    ].filter(Boolean).join(', '),
    fallback,
  );

const reminderCopy = (kind: string | null, address: string, publicUrl: string, engineerName: string) => {
  if (kind?.startsWith('landlord_cp12_4_weeks')) {
    return {
      subject: `Gas safety renewal due soon for ${address}`,
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
      subject: `Gas safety renewal reminder for ${address}`,
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
      subject: `CP12 renewal due soon: ${address}`,
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
      subject: `Urgent gas warning follow-up: ${address}`,
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
      subject: `At Risk gas warning follow-up: ${address}`,
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
      subject: `Gas warning follow-up due: ${address}`,
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

async function sendEmail(input: { to: string; subject: string; text: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return false;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    }),
  });

  return response.ok;
}

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  if (configuredSecret) {
    const header = request.headers.get('authorization') ?? '';
    if (header !== `Bearer ${configuredSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!process.env.RESEND_API_KEY?.trim() || !process.env.EMAIL_FROM?.trim()) {
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
    const ok = await sendEmail({
      to: recipient,
      subject: copy.subject,
      text: copy.text,
    });

    if (ok) {
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
