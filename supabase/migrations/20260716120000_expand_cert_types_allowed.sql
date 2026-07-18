-- The jobs / job_requests cert_types check constraint was created allowing only
-- 'cp12' and 'boiler_service'. Since then the app also creates jobs with other
-- certificate types as cert_types — notably 'gas_warning_notice' (the CP12 ->
-- Gas Warning Notice follow-up in ensureGasWarningNoticeJob) and 'general_works'
-- — which violated jobs_cert_types_allowed at insert time.
--
-- Widen the allowed set to every certificate type the app can persist. Widening a
-- check constraint cannot reject existing rows (they were all valid under the
-- stricter set), so this is safe to apply to a populated table.

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'jobs_cert_types_allowed' and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs drop constraint jobs_cert_types_allowed;
  end if;

  alter table public.jobs
    add constraint jobs_cert_types_allowed
    check (cert_types <@ array[
      'cp12', 'boiler_service', 'gas_service', 'general_works',
      'gas_warning_notice', 'breakdown', 'commissioning'
    ]::text[]);
end
$$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'job_requests_cert_types_allowed' and conrelid = 'public.job_requests'::regclass
  ) then
    alter table public.job_requests drop constraint job_requests_cert_types_allowed;
  end if;

  alter table public.job_requests
    add constraint job_requests_cert_types_allowed
    check (cert_types <@ array[
      'cp12', 'boiler_service', 'gas_service', 'general_works',
      'gas_warning_notice', 'breakdown', 'commissioning'
    ]::text[]);
end
$$;
