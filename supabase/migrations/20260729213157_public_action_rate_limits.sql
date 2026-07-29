-- Durable, server-only rate-limit buckets for unauthenticated actions that can
-- send email or create database records. No raw IP address, email address or
-- public token is stored: the application submits an HMAC digest.
create table if not exists public.public_action_rate_limits (
  action text not null check (char_length(action) between 1 and 64),
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  window_seconds integer not null check (window_seconds between 1 and 604800),
  window_started_at timestamptz not null default now(),
  hit_count integer not null default 0 check (hit_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (action, key_hash, window_seconds)
);

alter table public.public_action_rate_limits enable row level security;

revoke all on table public.public_action_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.public_action_rate_limits to service_role;

create or replace function public.consume_public_action_rate_limit(
  p_action text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_bucket public.public_action_rate_limits%rowtype;
  current_time timestamptz := statement_timestamp();
  elapsed_seconds integer;
begin
  if char_length(p_action) not between 1 and 64
     or p_key_hash !~ '^[a-f0-9]{64}$'
     or p_limit not between 1 and 1000
     or p_window_seconds not between 1 and 604800 then
    raise exception 'Invalid public action rate-limit parameters';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_action || ':' || p_key_hash || ':' || p_window_seconds::text, 0));

  select *
  into current_bucket
  from public.public_action_rate_limits
  where action = p_action
    and key_hash = p_key_hash
    and window_seconds = p_window_seconds;

  if not found or current_bucket.window_started_at + make_interval(secs => p_window_seconds) <= current_time then
    insert into public.public_action_rate_limits (
      action,
      key_hash,
      window_seconds,
      window_started_at,
      hit_count,
      updated_at
    )
    values (p_action, p_key_hash, p_window_seconds, current_time, 1, current_time)
    on conflict (action, key_hash, window_seconds) do update
      set window_started_at = excluded.window_started_at,
          hit_count = 1,
          updated_at = excluded.updated_at;

    return query select true, greatest(p_limit - 1, 0), 0;
    return;
  end if;

  elapsed_seconds := greatest(
    floor(extract(epoch from (current_time - current_bucket.window_started_at)))::integer,
    0
  );

  if current_bucket.hit_count >= p_limit then
    return query
      select false, 0, greatest(p_window_seconds - elapsed_seconds, 1);
    return;
  end if;

  update public.public_action_rate_limits
  set hit_count = hit_count + 1,
      updated_at = current_time
  where action = p_action
    and key_hash = p_key_hash
    and window_seconds = p_window_seconds;

  return query
    select true, greatest(p_limit - current_bucket.hit_count - 1, 0), 0;
end;
$$;

revoke all on function public.consume_public_action_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_public_action_rate_limit(text, text, integer, integer)
  to service_role;

-- Only one open renewal request may exist for a property or legacy source job.
-- The server inserts the request before creating/updating the follow-up job, so
-- these constraints make repeat submissions idempotent before side effects run.
create unique index if not exists job_requests_one_open_renewal_per_property_idx
  on public.job_requests (property_id)
  where request_type = 'renewal'
    and status in ('pending', 'scheduled')
    and property_id is not null;

create unique index if not exists job_requests_one_open_renewal_per_source_job_idx
  on public.job_requests (source_job_id)
  where request_type = 'renewal'
    and status in ('pending', 'scheduled')
    and source_job_id is not null;
