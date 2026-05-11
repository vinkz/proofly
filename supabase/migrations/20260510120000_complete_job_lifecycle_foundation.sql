create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  public_token text not null default replace(gen_random_uuid()::text, '-', ''),
  name text,
  address_line1 text,
  address_line2 text,
  town text,
  postcode text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists properties_public_token_idx
on public.properties(public_token);

create index if not exists properties_user_postcode_idx
on public.properties(user_id, postcode);

create index if not exists properties_client_idx
on public.properties(client_id);

alter table if exists public.properties enable row level security;

drop policy if exists properties_owner_all on public.properties;
create policy properties_owner_all
on public.properties
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table if exists public.jobs
  add column if not exists property_id uuid references public.properties(id) on delete set null,
  add column if not exists job_request_id uuid references public.job_requests(id) on delete set null,
  add column if not exists data_collection_status text not null default 'complete'
    check (data_collection_status in ('complete', 'awaiting_landlord_input', 'submitted')),
  add column if not exists landlord_input_requested_at timestamptz,
  add column if not exists landlord_input_submitted_at timestamptz,
  add column if not exists handover_sent_at timestamptz;

create index if not exists jobs_property_idx
on public.jobs(property_id);

create index if not exists jobs_job_request_idx
on public.jobs(job_request_id);

create index if not exists jobs_data_collection_status_idx
on public.jobs(user_id, data_collection_status);

alter table if exists public.job_requests
  add column if not exists missing_fields jsonb not null default '[]'::jsonb,
  add column if not exists submitted_at timestamptz;

create index if not exists job_requests_property_status_idx
on public.job_requests(property_id, status, created_at desc);

alter table if exists public.invoices
  add column if not exists payment_link_url text,
  add column if not exists payment_status text not null default 'not_configured'
    check (payment_status in ('not_configured', 'pending', 'paid', 'failed', 'cancelled')),
  add column if not exists sent_at timestamptz,
  add column if not exists public_visible boolean not null default true;

create index if not exists invoices_job_public_visible_idx
on public.invoices(job_id, public_visible);

alter table if exists public.profiles
  add column if not exists standard_rates jsonb not null default '{}'::jsonb;

