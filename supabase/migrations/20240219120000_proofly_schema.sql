-- Proofly core schema migration
-- Based on CONTEXT.md architecture and src/lib/db/schema.ts definitions

-- Required extensions
create extension if not exists "pgcrypto";

-- Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type public.job_status as enum ('draft', 'active', 'awaiting_signatures', 'awaiting_report', 'completed');
  end if;
  if not exists (select 1 from pg_type where typname = 'job_item_status') then
    create type public.job_item_status as enum ('pending', 'pass', 'fail');
  end if;
  if not exists (select 1 from pg_type where typname = 'template_item_type') then
    create type public.template_item_type as enum ('toggle', 'text', 'number', 'note');
  end if;
end
$$;

-- Updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

-- Clients
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  organization text,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_clients_user_id on public.clients (user_id);

create trigger set_clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

-- Templates
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users (id) on delete cascade,
  name text not null,
  trade_type text not null,
  is_public boolean not null default false,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_templates_created_by on public.templates (created_by);

create trigger set_templates_updated_at
before update on public.templates
for each row execute function public.set_updated_at();

-- Template items (normalized builder data)
create table if not exists public.template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates (id) on delete cascade,
  label text not null,
  field_type template_item_type not null default 'toggle',
  is_required boolean not null default false,
  allow_photo boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_template_items_template_id on public.template_items (template_id);

create trigger set_template_items_updated_at
before update on public.template_items
for each row execute function public.set_updated_at();

-- Jobs
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  client_name text not null,
  address text,
  title text,
  status job_status not null default 'draft',
  template_id uuid references public.templates (id) on delete set null,
  scheduled_for timestamptz,
  technician_name text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_jobs_client_id on public.jobs (client_id);
create index if not exists idx_jobs_template_id on public.jobs (template_id);
create index if not exists idx_jobs_status on public.jobs (status);

create trigger set_jobs_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

-- Job items (a.k.a job_checklist)
create table if not exists public.job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  template_item_id uuid references public.template_items (id) on delete set null,
  label text not null,
  status job_item_status not null default 'pending',
  note text,
  photo_path text,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_job_items_job_id on public.job_items (job_id);

create trigger set_job_items_updated_at
before update on public.job_items
for each row execute function public.set_updated_at();


-- Reports
create table if not exists public.reports (
  job_id uuid primary key references public.jobs (id) on delete cascade,
  storage_path text not null,
  generated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_reports_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

-- Report deliveries
create table if not exists public.report_deliveries (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  recipient_email text not null,
  recipient_name text,
  status text not null default 'queued',
  storage_path text,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_report_deliveries_job_id on public.report_deliveries (job_id);

create trigger set_report_deliveries_updated_at
before update on public.report_deliveries
for each row execute function public.set_updated_at();

-- Ensure storage bucket for job photos exists
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

-- Storage policies for job photo uploads
drop policy if exists "Authenticated users can upload job photos" on storage.objects;
create policy "Authenticated users can upload job photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'photos'
  and auth.uid() is not null
  and name ~ '^photos/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[0-9a-fA-F-]{8,}\\.[A-Za-z0-9]+$'
);

drop policy if exists "Authenticated users can read job photos" on storage.objects;
create policy "Authenticated users can read job photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'photos'
);

drop policy if exists "Authenticated users can delete job photos" on storage.objects;
create policy "Authenticated users can delete job photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'photos'
);
