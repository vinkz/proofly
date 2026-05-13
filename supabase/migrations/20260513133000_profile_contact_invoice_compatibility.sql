alter table if exists public.profiles
  add column if not exists company_email text,
  add column if not exists bank_name text,
  add column if not exists bank_account_name text,
  add column if not exists bank_sort_code text,
  add column if not exists bank_account_number text;

comment on column public.profiles.company_email is
  'Business email used for engineer request matching and landlord-facing notification emails.';
