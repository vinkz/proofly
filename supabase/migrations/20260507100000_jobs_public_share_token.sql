alter table if exists public.jobs
  add column if not exists public_token text;

update public.jobs
set public_token = replace(gen_random_uuid()::text, '-', '')
where public_token is null;

alter table if exists public.jobs
  alter column public_token set default replace(gen_random_uuid()::text, '-', ''),
  alter column public_token set not null;

create unique index if not exists jobs_public_token_idx
on public.jobs(public_token);
