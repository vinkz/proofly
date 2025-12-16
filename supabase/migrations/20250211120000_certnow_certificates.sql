-- CertNow certificate workflow tables
-- Adds certificate type metadata to jobs and creates supporting tables for photos, field values, and generated PDFs.

alter table public.jobs
add column if not exists certificate_type text;

create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  user_id uuid references auth.users(id),
  category text not null,
  file_url text not null,
  created_at timestamptz default now()
);

create table if not exists public.job_fields (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  user_id uuid references auth.users(id),
  field_key text not null,
  value text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (job_id, field_key)
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  user_id uuid references auth.users(id),
  pdf_url text,
  status text default 'draft',
  sent_at timestamptz,
  created_at timestamptz default now(),
  unique (job_id)
);
