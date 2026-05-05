import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { getSupabaseUser, supabaseServerReadOnly } from '@/lib/supabaseServer';

export default async function RequireAuth({ children }: { children: ReactNode }) {
  const supabase = await supabaseServerReadOnly();
  const user = await getSupabaseUser(supabase);

  if (!user) {
    redirect('/login');
  }

  return <>{children}</>;
}
