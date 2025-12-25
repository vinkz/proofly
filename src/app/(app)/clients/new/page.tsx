import { redirect } from 'next/navigation';

import { createClient } from '@/server/clients';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { ClientForm } from '@/components/clients/client-form';

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const supabase = await supabaseServerReadOnly();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }
  const params = await searchParams;
  const redirectParam = typeof params?.redirect === 'string' ? params.redirect : '';
  const safeRedirect = redirectParam.startsWith('/jobs/new') ? redirectParam : '';

  const onCreate = async (formData: FormData) => {
    'use server';
    const { id } = await createClient(formData);
    if (safeRedirect) {
      const joiner = safeRedirect.includes('?') ? '&' : '?';
      redirect(`${safeRedirect}${joiner}clientId=${id}`);
    }
    redirect(`/clients/${id}`);
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-3xl border border-white/20 bg-white/80 p-6 shadow-sm">
      <div>
        <p className="text-xs uppercase tracking-wide text-[var(--accent)]">New client</p>
        <h1 className="text-2xl font-semibold text-muted">Create client</h1>
        <p className="text-sm text-muted-foreground/70">Add a new client to your CRM.</p>
      </div>
      <ClientForm action={onCreate} />
    </div>
  );
}
