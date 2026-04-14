alter table public.profiles
  add column if not exists bank_name text,
  add column if not exists bank_account_name text,
  add column if not exists bank_sort_code text,
  add column if not exists bank_account_number text;
