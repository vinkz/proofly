import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';

export default async function RequireAuth({ children }: { children: ReactNode }) {
  const supabase = await supabaseServerReadOnly();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <>{children}</>;
}
