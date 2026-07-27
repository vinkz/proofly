-- Email capture for the public, no-signup CP12 generator.
--
-- This table is the ONLY thing the free tool persists. Nothing about the
-- certificate itself is stored: no property, no landlord, no appliances, no
-- PDF. That boundary is deliberate — it is what separates the free tool from
-- the paid product — so resist adding certificate columns here later.
create table if not exists public.free_tool_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'free_cp12',
  created_at timestamptz not null default now()
);

-- Supports the per-email-per-day cap, which counts recent rows for an address.
create index if not exists free_tool_leads_email_created_at_idx
on public.free_tool_leads (lower(email), created_at desc);

create index if not exists free_tool_leads_created_at_idx
on public.free_tool_leads (created_at desc);

-- RLS on with no policies: unreachable via the anon and authenticated roles.
-- Only the service role (which bypasses RLS) writes here, from the download
-- route. There is no read path in the application at all.
alter table public.free_tool_leads enable row level security;
