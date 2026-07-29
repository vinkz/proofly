-- `current_time` is also a PostgreSQL SQL value (timetz). Use an unambiguous
-- PL/pgSQL variable name so timestamp comparisons remain timestamptz-to-timestamptz.
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
  v_now timestamptz := statement_timestamp();
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

  if not found or current_bucket.window_started_at + make_interval(secs => p_window_seconds) <= v_now then
    insert into public.public_action_rate_limits (
      action,
      key_hash,
      window_seconds,
      window_started_at,
      hit_count,
      updated_at
    )
    values (p_action, p_key_hash, p_window_seconds, v_now, 1, v_now)
    on conflict (action, key_hash, window_seconds) do update
      set window_started_at = excluded.window_started_at,
          hit_count = 1,
          updated_at = excluded.updated_at;

    return query select true, greatest(p_limit - 1, 0), 0;
    return;
  end if;

  elapsed_seconds := greatest(
    floor(extract(epoch from (v_now - current_bucket.window_started_at)))::integer,
    0
  );

  if current_bucket.hit_count >= p_limit then
    return query
      select false, 0, greatest(p_window_seconds - elapsed_seconds, 1);
    return;
  end if;

  update public.public_action_rate_limits
  set hit_count = hit_count + 1,
      updated_at = v_now
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
