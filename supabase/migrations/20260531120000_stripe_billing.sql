alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists subscription_status text
    default 'free'
    check (subscription_status in (
      'free', 'active', 'past_due', 'canceled', 'incomplete'
    )),
  add column if not exists subscription_interval text
    check (subscription_interval in ('month', 'year') or subscription_interval is null),
  add column if not exists subscription_period_end timestamptz,
  add column if not exists stripe_subscription_id text;

create table if not exists public.certificate_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  certificate_type text not null,
  issued_at timestamptz not null default now(),
  billing_month text not null
);

create index if not exists idx_cert_usage_user_month
  on public.certificate_usage(user_id, billing_month);

create index if not exists idx_cert_usage_user_job_type
  on public.certificate_usage(user_id, job_id, certificate_type);

alter table public.certificate_usage enable row level security;

drop policy if exists "Users can view own certificate usage"
  on public.certificate_usage;

create policy "Users can view own certificate usage"
  on public.certificate_usage
  for select
  using (auth.uid() = user_id);
