-- Invoices may now be standalone (not tied to a job). The invoices RLS policy is already
-- keyed on user_id (see 20260326123000_rls_core_tables.sql), so no policy change is needed —
-- only drop the NOT NULL constraint on job_id. Guarded so it is a no-op if already nullable
-- or if the column/table does not exist yet.
do $$
begin
  if to_regclass('public.invoices') is null then
    return;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invoices'
      and column_name = 'job_id'
      and is_nullable = 'NO'
  ) then
    execute 'alter table public.invoices alter column job_id drop not null';
  end if;
end;
$$;
