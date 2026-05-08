create table if not exists public.job_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid,
  source_job_id uuid references public.jobs(id) on delete set null,
  scheduled_job_id uuid references public.jobs(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  assigned_engineer_id uuid references auth.users(id) on delete set null,
  request_type text not null check (request_type in ('new_job', 'renewal')),
  source text not null default 'public_job_page',
  job_type text not null default 'cp12',
  landlord_name text,
  landlord_email text,
  landlord_phone text,
  property_address text,
  property_postcode text,
  tenant_name text,
  tenant_phone text,
  access_notes text,
  preferred_dates text,
  status text not null default 'pending' check (status in ('pending', 'scheduled', 'completed', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_requests_user_status_idx
on public.job_requests(user_id, status, created_at desc);

create index if not exists job_requests_assigned_status_idx
on public.job_requests(assigned_engineer_id, status, created_at desc);

create index if not exists job_requests_source_job_idx
on public.job_requests(source_job_id);
