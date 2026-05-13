import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const protectedPrefixes = [
  '/clients',
  '/dashboard',
  '/documents',
  '/invoices',
  '/jobs',
  '/onboarding',
  '/requests',
  '/settings',
  '/wizard',
];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-current-path', request.nextUrl.pathname);
  requestHeaders.set('x-current-search', request.nextUrl.search);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options) {
        response.cookies.set({ name, value: '', expires: new Date(0), ...options });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return response;

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/clients',
    '/clients/:path*',
    '/dashboard',
    '/dashboard/:path*',
    '/documents',
    '/documents/:path*',
    '/invoices',
    '/invoices/:path*',
    '/jobs',
    '/jobs/:path*',
    '/onboarding',
    '/onboarding/:path*',
    '/requests',
    '/requests/:path*',
    '/settings',
    '/settings/:path*',
    '/wizard',
    '/wizard/:path*',
  ],
};
