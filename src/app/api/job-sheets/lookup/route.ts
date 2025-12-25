import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import type { Database } from '@/lib/database.types';
import { assertSupabaseEnv, env } from '@/lib/env';
import { lookupJobBySheetCode } from '@/server/job-sheets';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export async function POST(req: Request) {
  assertSupabaseEnv();
  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {
        return;
      },
      remove() {
        return;
      },
    },
  });
  const payload = await req.json().catch(() => null);

  const code = isRecord(payload) && typeof payload.code === 'string' ? payload.code.trim() : '';
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const lookup = await lookupJobBySheetCode(supabase, code);
  if (!lookup) {
    return NextResponse.json({ error: 'Job sheet not found' }, { status: 404 });
  }

  if (!lookup.isActive) {
    return NextResponse.json({ error: 'Job sheet inactive' }, { status: 410 });
  }

  await supabase
    .from('job_sheets')
    .update({ last_scanned_at: new Date().toISOString() })
    .eq('code', code.toUpperCase());

  return NextResponse.json({ jobId: lookup.jobId }, { status: 200 });
}
