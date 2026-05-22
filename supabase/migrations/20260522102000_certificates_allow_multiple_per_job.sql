-- Ensure a job can store multiple final documents, one per certificate type.
-- Older environments may still have the original unique(job_id) constraint
-- from 20250211120000_certnow_certificates.sql, which blocks CP12 + GWN on
-- the same job and makes the completion checklist keep showing GWN required.

alter table public.certificates
  add column if not exists cert_type text;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join unnest(c.conkey) with ordinality cols(attnum, ordinality) on true
    join pg_attribute a on a.attrelid = t.oid and a.attnum = cols.attnum
    where n.nspname = 'public'
      and t.relname = 'certificates'
      and c.contype = 'u'
      and a.attname = 'job_id'
      and array_length(c.conkey, 1) = 1
  loop
    execute format('alter table public.certificates drop constraint if exists %I', constraint_name);
  end loop;
end $$;

drop index if exists public.certificates_job_id_idx;
drop index if exists public.certificates_job_id_key;

do $$
declare
  index_name text;
begin
  for index_name in
    select i.relname
    from pg_index x
    join pg_class i on i.oid = x.indexrelid
    join pg_class t on t.oid = x.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = t.oid and a.attnum = x.indkey[0]
    where n.nspname = 'public'
      and t.relname = 'certificates'
      and x.indisunique
      and not x.indisprimary
      and x.indnkeyatts = 1
      and a.attname = 'job_id'
  loop
    execute format('drop index if exists public.%I', index_name);
  end loop;
end $$;

create unique index if not exists certificates_job_id_cert_type_idx
on public.certificates(job_id, cert_type)
where job_id is not null and cert_type is not null;
