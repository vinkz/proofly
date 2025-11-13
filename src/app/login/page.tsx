'use client';

import { useState } from 'react';

import { supabaseBrowser } from '@/lib/supabaseClient';

export default function LoginPage() {
  const supabase = supabaseBrowser();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    });
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-3 p-6">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        type="email"
        required
        placeholder="you@example.com"
        className="w-full rounded border px-3 py-2"
      />
      <button type="submit" className="w-full rounded bg-black px-3 py-2 text-white" disabled={loading}>
        {loading ? 'Sending…' : 'Send magic link'}
      </button>
      {sent ? <p>Check your email.</p> : null}
    </form>
  );
}
