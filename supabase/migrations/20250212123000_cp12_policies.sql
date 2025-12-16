-- Enable RLS and add owner-based policies for cp12_appliances
do $$
begin
  if not exists (select 1 from pg_class where relname = 'cp12_appliances' and relnamespace = 'public'::regnamespace) then
    raise notice 'cp12_appliances table not found, skipping policy creation';
    return;
  end if;

  execute 'alter table public.cp12_appliances enable row level security';

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cp12_appliances' and policyname = 'cp12_appliances_owner_all'
  ) then
    execute $pol$
      create policy cp12_appliances_owner_all
      on public.cp12_appliances
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
    $pol$;
  end if;

  if not exists (
    select 1 from pg_roles where rolname = 'service_role'
  ) then
    return;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cp12_appliances' and policyname = 'cp12_appliances_service_all'
  ) then
    execute $pol$
      create policy cp12_appliances_service_all
      on public.cp12_appliances
      for all
      to service_role
      using (true)
      with check (true);
    $pol$;
  end if;
end;
$$;
