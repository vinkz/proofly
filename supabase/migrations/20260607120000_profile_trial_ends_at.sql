-- Adds profiles.trial_ends_at so the welcome email can show an exact trial-end
-- date (it falls back to "in 14 days" when the column is absent). New rows get a
-- 14-day default; existing rows are backfilled to 14 days after creation.
alter table public.profiles
  add column if not exists trial_ends_at timestamptz
  default (now() + interval '14 days');

update public.profiles
set trial_ends_at = created_at + interval '14 days'
where trial_ends_at is null;
