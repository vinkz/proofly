-- CP12 appliance entries per job
create table if not exists public.cp12_appliances (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  user_id uuid references auth.users(id),
  appliance_type text,
  location text,
  make_model text,
  operating_pressure text,
  heat_input text,
  flue_type text,
  ventilation_provision text,
  ventilation_satisfactory text,
  flue_condition text,
  stability_test text,
  gas_tightness_test text,
  co_reading_ppm text,
  safety_rating text,
  classification_code text,
  created_at timestamptz default now()
);

create index if not exists cp12_appliances_job_id_idx on public.cp12_appliances(job_id);
