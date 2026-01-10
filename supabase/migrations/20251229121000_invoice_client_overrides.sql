alter table if exists public.invoices
  add column if not exists client_name_override text,
  add column if not exists client_address_override text,
  add column if not exists client_email_override text,
  add column if not exists client_phone_override text;
