do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reports'
      and column_name = 'kind'
  ) then
    alter table public.reports
      add column kind text;
  end if;
end
$$;

alter table public.reports
  drop constraint if exists reports_kind_check;

alter table public.reports
  add constraint reports_kind_check
  check (
    kind is null
    or kind in ('cp12', 'boiler_service', 'warning_notice', 'general_works', 'job_sheet', 'breakdown', 'commissioning')
  );

create index if not exists idx_reports_kind on public.reports (kind);
