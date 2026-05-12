-- Minimum lifecycle support for the first bidirectional job milestone.
-- This migration is intentionally additive: legacy job statuses remain valid
-- until the current dashboard/wizard code is migrated onto the new lifecycle.

alter type public.job_status add value if not exists 'awaiting_landlord';
alter type public.job_status add value if not exists 'prepared';
alter type public.job_status add value if not exists 'in_progress';
alter type public.job_status add value if not exists 'issued';
alter type public.job_status add value if not exists 'delivered';

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'job_entry_point'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.job_entry_point as enum (
      'landlord_request',
      'engineer_created',
      'engineer_link'
    );
  end if;
end
$$;

alter table if exists public.jobs
  add column if not exists pending_engineer_email text,
  add column if not exists claim_token uuid,
  add column if not exists claim_token_expires_at timestamptz,
  add column if not exists prefill_token uuid,
  add column if not exists prefill_token_expires_at timestamptz,
  add column if not exists entry_point public.job_entry_point not null default 'engineer_created',
  add column if not exists cert_types text[] not null default '{}'::text[];

update public.jobs
set cert_types = case
  when lower(coalesce(job_type::text, certificate_type, '')) in ('boiler_service', 'gas_service') then array['boiler_service']
  when lower(coalesce(job_type::text, certificate_type, '')) in ('cp12', 'gas_safety', 'gas_safety_certificate') then array['cp12']
  else cert_types
end
where cert_types = '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_cert_types_allowed'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_cert_types_allowed
      check (cert_types <@ array['cp12', 'boiler_service']::text[]);
  end if;
end
$$;

create unique index if not exists jobs_claim_token_idx
on public.jobs(claim_token)
where claim_token is not null;

create unique index if not exists jobs_prefill_token_idx
on public.jobs(prefill_token)
where prefill_token is not null;

create index if not exists jobs_entry_point_created_idx
on public.jobs(entry_point, created_at desc);

create index if not exists jobs_user_status_created_idx
on public.jobs(user_id, status, created_at desc);

create index if not exists jobs_cert_types_idx
on public.jobs using gin(cert_types);

comment on column public.jobs.prefill_token is
  'Scoped token for engineer-owned landlord pre-fill links. Validate server-side; do not expose jobs through public RLS.';

comment on column public.jobs.claim_token is
  'Reserved for owned job claim flows. Unregistered-engineer landlord requests should use job_requests.claim_token until the engineer signs up.';

alter table if exists public.job_requests
  add column if not exists pending_engineer_email text,
  add column if not exists claim_token uuid,
  add column if not exists claim_token_expires_at timestamptz,
  add column if not exists claimed_at timestamptz,
  add column if not exists entry_point public.job_entry_point not null default 'landlord_request',
  add column if not exists cert_types text[] not null default '{}'::text[];

update public.job_requests
set pending_engineer_email = coalesce(pending_engineer_email, engineer_email)
where pending_engineer_email is null
  and engineer_email is not null;

update public.job_requests
set cert_types = case
  when lower(coalesce(job_type, '')) in ('boiler_service', 'gas_service') then array['boiler_service']
  when lower(coalesce(job_type, '')) in ('both', 'cp12_boiler_service', 'cp12+boiler_service') then array['cp12', 'boiler_service']
  when lower(coalesce(job_type, '')) in ('cp12', 'gas_safety', 'gas_safety_certificate') then array['cp12']
  else cert_types
end
where cert_types = '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_requests_cert_types_allowed'
      and conrelid = 'public.job_requests'::regclass
  ) then
    alter table public.job_requests
      add constraint job_requests_cert_types_allowed
      check (cert_types <@ array['cp12', 'boiler_service']::text[]);
  end if;
end
$$;

create unique index if not exists job_requests_claim_token_idx
on public.job_requests(claim_token)
where claim_token is not null;

create index if not exists job_requests_pending_engineer_email_idx
on public.job_requests(lower(pending_engineer_email))
where pending_engineer_email is not null;

create index if not exists job_requests_entry_point_status_idx
on public.job_requests(entry_point, status, created_at desc);

create index if not exists job_requests_cert_types_idx
on public.job_requests using gin(cert_types);

comment on column public.job_requests.claim_token is
  'Canonical token for unregistered-engineer request claiming. Public routes must validate this server-side; no public jobs RLS policy should be created for this.';

alter table if exists public.profiles
  add column if not exists request_link_slug text,
  add column if not exists default_rate numeric(10, 2);

update public.profiles
set request_link_slug = 'cn-' || replace(id::text, '-', '')
where request_link_slug is null
  or btrim(request_link_slug) = '';

alter table if exists public.profiles
  alter column request_link_slug set default ('cn-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));

create unique index if not exists profiles_request_link_slug_idx
on public.profiles(lower(request_link_slug))
where request_link_slug is not null;

comment on column public.profiles.request_link_slug is
  'Permanent engineer personal request link slug for /request/[slug]. Not a secret; it scopes requests to the engineer.';

comment on column public.profiles.default_rate is
  'Simple invoice-rate fallback. Prefer profiles.standard_rates for CP12, boiler service, and combo pricing.';
