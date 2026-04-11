alter table if exists public.cp12_appliances
  add column if not exists safety_classification text,
  add column if not exists defect_notes text,
  add column if not exists actions_taken text,
  add column if not exists actions_required text,
  add column if not exists warning_notice_issued boolean,
  add column if not exists appliance_disconnected boolean,
  add column if not exists danger_do_not_use_attached boolean;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cp12_appliances_safety_classification_check'
  ) then
    alter table public.cp12_appliances
      add constraint cp12_appliances_safety_classification_check
      check (
        safety_classification is null
        or safety_classification in ('safe', 'ncs', 'ar', 'id')
      );
  end if;
end
$$;
