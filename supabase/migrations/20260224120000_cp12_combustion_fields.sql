-- Add dedicated combustion readings and notes to CP12 appliances
alter table if exists public.cp12_appliances
  add column if not exists high_co_ppm text,
  add column if not exists high_co2 text,
  add column if not exists high_ratio text,
  add column if not exists low_co_ppm text,
  add column if not exists low_co2 text,
  add column if not exists low_ratio text,
  add column if not exists combustion_notes text;
