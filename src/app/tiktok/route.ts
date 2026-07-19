import { type NextRequest, NextResponse } from 'next/server';

export function GET(request: NextRequest) {
  const destination = request.nextUrl.clone();
  destination.pathname = '/dashboard';

  return NextResponse.redirect(destination, 307);
}
