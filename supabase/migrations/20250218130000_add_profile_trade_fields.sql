-- Add trade_types and certifications to profiles, and general flag to templates

-- Profiles: ensure columns exist (create table if missing for local dev)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'trade_types'
    ) then
      alter table public.profiles add column trade_types text[] not null default '{}'::text[];
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'certifications'
    ) then
      alter table public.profiles add column certifications text[] not null default '{}'::text[];
    end if;
  else
    create table public.profiles (
      id uuid primary key references auth.users (id) on delete cascade,
      trade_types text[] not null default '{}'::text[],
      certifications text[] not null default '{}'::text[],
      created_at timestamptz not null default timezone('utc', now()),
      updated_at timestamptz not null default timezone('utc', now())
    );
    create trigger set_profiles_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();
  end if;
end
$$;

-- Templates: add is_general flag for cross-trade workflows
alter table if exists public.templates
  add column if not exists is_general boolean not null default false;
