export default function EnvCheck() {
  const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasSupabaseKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold">Env Check</h1>
      <ul className="mt-4 list-disc pl-6">
        <li>SUPABASE_URL: {hasSupabaseUrl ? '✔️' : '❌'}</li>
        <li>SUPABASE_ANON_KEY: {hasSupabaseKey ? '✔️' : '❌'}</li>
      </ul>
      <p className="mt-4 text-sm text-gray-500">
        Set these in .env.local and restart dev server if missing.
      </p>
    </main>
  );
}
