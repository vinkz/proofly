import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { supabaseServer } from '@/lib/supabaseServer';

export default async function RequireAuth({ children }: { children: ReactNode }) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <>{children}</>;
}
