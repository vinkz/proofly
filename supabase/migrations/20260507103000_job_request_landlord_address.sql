alter table if exists public.job_requests
  add column if not exists landlord_address_line1 text,
  add column if not exists landlord_address_line2 text,
  add column if not exists landlord_city text,
  add column if not exists landlord_postcode text;
