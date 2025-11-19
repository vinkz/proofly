import { NextResponse } from 'next/server';

import { supabaseServerAction } from '@/lib/supabaseServer';

export async function POST(request: Request) {
  const sb = await supabaseServerAction();
  await sb.auth.signOut();
  const url = new URL('/login', request.url);
  return NextResponse.redirect(url);
}
