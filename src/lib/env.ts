const optionalRequired = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const env = {
  get OPENAI_API_KEY() {
    return optionalRequired('OPENAI_API_KEY');
  },
  SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  get SUPABASE_SERVICE_ROLE_KEY() {
    const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!value) {
      throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
    }
    return value;
  },
};

export function assertSupabaseEnv() {
  if (!env.SUPABASE_URL) throw new Error('Missing required environment variable: SUPABASE_URL');
  if (!env.SUPABASE_ANON_KEY) throw new Error('Missing required environment variable: SUPABASE_ANON_KEY');
}
