import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const protectedPrefixes = [
  '/admin',
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
  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // When getUser() rotates the refresh token, forward the *new* cookies to
        // the downstream request as well as the browser response. Without this,
        // the Server Components in this same request keep reading the old cookie
        // and re-refresh an already-rotated token, which fails as "invalid
        // refresh token" -> null user -> a 500 on the page's own getUser().
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        requestHeaders.set('cookie', request.cookies.toString());
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set({ name, value, ...options }),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return response;

  if (request.nextUrl.pathname === '/dashboard' || request.nextUrl.pathname === '/dashboard/') {
    const landingUrl = request.nextUrl.clone();
    landingUrl.pathname = '/';
    return NextResponse.redirect(landingUrl);
  }

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
