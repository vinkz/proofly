alter table if exists public.jobs
  add column if not exists parent_job_id uuid references public.jobs(id) on delete set null,
  add column if not exists source_appliance_id uuid references public.cp12_appliances(id) on delete set null,
  add column if not exists source_appliance_key text;

create unique index if not exists jobs_cp12_gas_warning_source_appliance_idx
on public.jobs(parent_job_id, source_appliance_id)
where certificate_type = 'gas_warning_notice'
  and parent_job_id is not null
  and source_appliance_id is not null;

create unique index if not exists jobs_cp12_gas_warning_source_appliance_key_idx
on public.jobs(parent_job_id, source_appliance_key)
where certificate_type = 'gas_warning_notice'
  and parent_job_id is not null
  and source_appliance_key is not null;
