alter table if exists public.cp12_appliances
  add column if not exists appliance_inspected text,
  add column if not exists landlords_appliance text;
