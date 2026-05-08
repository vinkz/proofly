alter table if exists public.job_requests
  add column if not exists engineer_name text,
  add column if not exists engineer_company text,
  add column if not exists engineer_email text,
  add column if not exists engineer_phone text,
  add column if not exists engineer_gas_safe_number text,
  add column if not exists landlord_confirmation_status text,
  add column if not exists engineer_notification_status text;
