-- Allow multiple certificate records per job, scoped by cert_type.
alter table public.certificates
  add column if not exists cert_type text;

alter table public.certificates
  drop constraint if exists certificates_job_id_key;

drop index if exists certificates_job_id_idx;

create unique index if not exists certificates_job_id_cert_type_idx
on public.certificates(job_id, cert_type)
where job_id is not null and cert_type is not null;
