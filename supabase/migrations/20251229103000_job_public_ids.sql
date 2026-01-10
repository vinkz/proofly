-- Job public ID chain helpers
create table if not exists public.job_code_counters (
  user_id uuid primary key references auth.users(id) on delete cascade,
  seq integer not null default 0,
  updated_at timestamptz not null default now()
);

drop trigger if exists set_job_code_counters_updated_at on public.job_code_counters;

create trigger set_job_code_counters_updated_at
before update on public.job_code_counters
for each row execute function public.set_updated_at();

create or replace function public.next_job_code(p_user_id uuid)
returns text
language plpgsql
as $$
declare
  next_seq integer;
begin
  insert into public.job_code_counters (user_id, seq)
  values (p_user_id, 1)
  on conflict (user_id)
  do update set seq = public.job_code_counters.seq + 1
  returning seq into next_seq;

  return lpad(next_seq::text, 8, '0');
end;
$$;

alter table public.jobs
  add column if not exists job_code text,
  add column if not exists client_ref text;

create unique index if not exists jobs_user_job_code_idx on public.jobs(user_id, job_code);

alter table public.certificates
  add column if not exists public_id text;

create unique index if not exists certificates_public_id_idx on public.certificates(public_id);
