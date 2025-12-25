do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_type') then
    create type public.job_type as enum ('general');
  end if;
end
$$;

alter table public.jobs
  add column if not exists job_type public.job_type not null default 'general';

create table if not exists public.job_records (
  job_id uuid primary key references public.jobs (id) on delete cascade,
  record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_job_records_updated_at
before update on public.job_records
for each row execute function public.set_updated_at();

alter table public.job_records enable row level security;

drop policy if exists job_records_owner_all on public.job_records;
create policy job_records_owner_all
on public.job_records
for all
to authenticated
using (
  exists (
    select 1
    from public.jobs
    where jobs.id = job_records.job_id
      and jobs.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.jobs
    where jobs.id = job_records.job_id
      and jobs.user_id = auth.uid()
  )
);
