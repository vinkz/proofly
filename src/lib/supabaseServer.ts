import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

import type { Database } from '@/lib/database.types';

export async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options?: CookieOptions) {
          cookieStore.set({
            name,
            value,
            httpOnly: options?.httpOnly ?? true,
            sameSite: options?.sameSite ?? 'lax',
            secure: options?.secure ?? process.env.NODE_ENV === 'production',
            path: options?.path ?? '/',
            domain: options?.domain,
            expires: options?.expires,
            maxAge: options?.maxAge,
          });
        },
        remove(name: string, options?: CookieOptions) {
          cookieStore.set({
            name,
            value: '',
            httpOnly: options?.httpOnly ?? true,
            sameSite: options?.sameSite ?? 'lax',
            secure: options?.secure ?? process.env.NODE_ENV === 'production',
            path: options?.path ?? '/',
            domain: options?.domain,
            expires: new Date(0),
            maxAge: 0,
          });
        },
      },
    },
  );
}
