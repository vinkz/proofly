import { NextResponse } from 'next/server';

import { supabaseServerServiceRole } from '@/lib/supabaseServer';

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  if (configuredSecret) {
    const header = request.headers.get('authorization') ?? '';
    if (header !== `Bearer ${configuredSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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

  const rows = reminders ?? [];
  const ids = rows.map((row) => row.id);
  if (ids.length) {
    const { error: updateErr } = await admin
      .from('reminders')
      .update({ sent_at: new Date().toISOString() })
      .in('id', ids);
    if (updateErr) throw new Error(updateErr.message);
  }

  return NextResponse.json({
    processed: rows.length,
    sent: rows.length,
    delivery: 'marked_sent_email_provider_not_configured',
  });
}
