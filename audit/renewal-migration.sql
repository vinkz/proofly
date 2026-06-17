-- Renewal lifecycle state — tracked per property (the canonical renewal anchor).
-- `properties.next_service_due` already exists and is the due date; these add the
-- lifecycle so reminders/booking become state-driven instead of date-seeded rows.
-- Additive and idempotent. Safe to run on prod.

alter table public.properties
  add column if not exists renewal_requested_at     timestamptz,
  add column if not exists renewal_booked_at        timestamptz,
  add column if not exists renewal_booked_date      date,
  add column if not exists renewal_last_reminded_at timestamptz;

comment on column public.properties.renewal_requested_at is
  'When the engineer last sent the landlord a renewal request for the current cycle. Cleared when a new certificate is issued.';
comment on column public.properties.renewal_booked_at is
  'When the landlord booked/confirmed a renewal date (via /p). Reminder stop-condition. Cleared on new certificate issue.';
comment on column public.properties.renewal_booked_date is
  'The renewal visit date the landlord confirmed.';
comment on column public.properties.renewal_last_reminded_at is
  'Last engineer renewal nudge sent; throttles the reminder cron.';

-- Helps the daily cron scan only the properties that can still need a nudge.
create index if not exists properties_renewal_due_idx
  on public.properties (next_service_due)
  where renewal_booked_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- OPTIONAL backfill (review before running). Marks a property as already booked
-- if it has a future scheduled job, so in-flight renewals aren't re-nudged after
-- cutover. Conservative — may over-mark if a non-renewal job is scheduled. Skip
-- for a clean forward-only cutover.
--
-- update public.properties p
-- set renewal_booked_at   = coalesce(p.renewal_booked_at, now()),
--     renewal_booked_date = coalesce(p.renewal_booked_date, (j.scheduled_for at time zone 'utc')::date)
-- from public.jobs j
-- where j.property_id = p.id
--   and j.scheduled_for is not null
--   and j.scheduled_for::date > current_date
--   and j.status in ('active','prepared')
--   and p.renewal_booked_at is null;
