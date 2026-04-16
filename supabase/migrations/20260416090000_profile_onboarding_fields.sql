alter table if exists public.profiles
  add column if not exists full_name text,
  add column if not exists date_of_birth text,
  add column if not exists profession text,
  add column if not exists company_name text,
  add column if not exists company_address text,
  add column if not exists company_address_line2 text,
  add column if not exists company_town text,
  add column if not exists company_postcode text,
  add column if not exists company_phone text,
  add column if not exists default_engineer_name text,
  add column if not exists default_engineer_id text,
  add column if not exists gas_safe_number text,
  add column if not exists onboarding_complete boolean default false;
