import { NextResponse } from 'next/server';

import { calculateGasRateForTool } from '@/server/gas-rate';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { toUserMessage } from '@/lib/user-errors';

export async function POST(request: Request) {
  // Only the signed-in /tools/gas-rate page calls this. Gate it so the compute
  // isn't a free, unauthenticated endpoint.
  const supabase = await supabaseServerReadOnly();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Send a valid JSON body.' }, { status: 400 });
  }

  try {
    const result = await calculateGasRateForTool(payload as Parameters<typeof calculateGasRateForTool>[0]);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = toUserMessage(error, 'Unable to calculate gas rate.');
    const status = /unauthorized/i.test(message) ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
