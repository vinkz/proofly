-- Evidence attachments (PDFs, screenshots)
create table if not exists public.job_files (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  appliance_id uuid null references public.cp12_appliances(id) on delete set null,
  kind text not null check (kind in ('fga_report','fga_screenshot','other')),
  file_name text not null,
  mime_type text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists job_files_job_id_idx on public.job_files(job_id);
create index if not exists job_files_appliance_id_idx on public.job_files(appliance_id);


-- Structured readings (from pasted text / later CSV import / manual)
create table if not exists public.fga_readings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  appliance_id uuid null references public.cp12_appliances(id) on delete set null,
  reading_set text not null check (reading_set in ('high','low')),
  source text not null check (source in ('pasted_text','csv_import','manual')),
  captured_at timestamptz not null default now(),
  raw_text text null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists fga_readings_job_id_idx on public.fga_readings(job_id);
create index if not exists fga_readings_appliance_id_idx on public.fga_readings(appliance_id);
create index if not exists fga_readings_job_appliance_idx on public.fga_readings(job_id, appliance_id);


-- RLS
alter table public.job_files enable row level security;
alter table public.fga_readings enable row level security;


-- Policies: allow only if the referenced job belongs to auth.uid() via jobs.user_id

-- job_files
drop policy if exists "job_files_select_own" on public.job_files;
create policy "job_files_select_own"
on public.job_files
for select
using (
  exists (
    select 1 from public.jobs j
    where j.id = job_files.job_id
      and j.user_id = auth.uid()
  )
);

drop policy if exists "job_files_insert_own" on public.job_files;
create policy "job_files_insert_own"
on public.job_files
for insert
with check (
  exists (
    select 1 from public.jobs j
    where j.id = job_files.job_id
      and j.user_id = auth.uid()
  )
);

drop policy if exists "job_files_delete_own" on public.job_files;
create policy "job_files_delete_own"
on public.job_files
for delete
using (
  exists (
    select 1 from public.jobs j
    where j.id = job_files.job_id
      and j.user_id = auth.uid()
  )
);


-- fga_readings
drop policy if exists "fga_readings_select_own" on public.fga_readings;
create policy "fga_readings_select_own"
on public.fga_readings
for select
using (
  exists (
    select 1 from public.jobs j
    where j.id = fga_readings.job_id
      and j.user_id = auth.uid()
  )
);

drop policy if exists "fga_readings_insert_own" on public.fga_readings;
create policy "fga_readings_insert_own"
on public.fga_readings
for insert
with check (
  exists (
    select 1 from public.jobs j
    where j.id = fga_readings.job_id
      and j.user_id = auth.uid()
  )
);

drop policy if exists "fga_readings_delete_own" on public.fga_readings;
create policy "fga_readings_delete_own"
on public.fga_readings
for delete
using (
  exists (
    select 1 from public.jobs j
    where j.id = fga_readings.job_id
      and j.user_id = auth.uid()
  )
);
