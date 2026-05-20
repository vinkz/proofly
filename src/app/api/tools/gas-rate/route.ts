import { NextResponse } from 'next/server';

import { calculateGasRateForTool } from '@/server/gas-rate';

export async function POST(request: Request) {
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
    const message = error instanceof Error ? error.message : 'Unable to calculate gas rate.';
    const status = /unauthorized/i.test(message) ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
