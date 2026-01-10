-- Add invoice PDF path + storage bucket
alter table if exists public.invoices
  add column if not exists pdf_path text;

insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;
