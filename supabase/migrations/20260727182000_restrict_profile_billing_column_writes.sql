-- Finding 2 from the GS-2026-1874-5 disclosure: any user could grant themselves
-- a paid plan by PATCHing their own profiles row.
--
--   PATCH /rest/v1/profiles?id=eq.<own id>
--   {"plan_tier":"pro","subscription_status":"active",
--    "trial_ends_at":"2035-01-01T00:00:00Z","stripe_customer_id":"cus_anything"}
--
-- RLS cannot restrict *columns* -- `profiles_owner_all` correctly limits a user
-- to their own row, but says nothing about which fields they may set. The
-- billing columns were writable because `authenticated` holds a TABLE-level
-- UPDATE/INSERT grant, which covers every column.
--
-- Note for anyone extending this: a column-level REVOKE alone is a silent no-op
-- while the table-level grant remains. The table-level privilege has to be
-- revoked first, then re-granted column by column.
--
-- All legitimate billing writes already run through the service role (the
-- Stripe webhook, billing.ts, signup-wizard.ts), which is unaffected by these
-- grants. Only src/server/profile.ts writes profiles with the user's own JWT,
-- and it never touches billing fields. Because the row is now writable only by
-- the service role, reading entitlement from plan_tier is trustworthy again --
-- it can only have come from a verified Stripe event.

revoke update, insert on public.profiles from authenticated, anon;

-- Every column except the billing/entitlement set. `id` stays writable so
-- PostgREST upserts still work; RLS `with check (id = auth.uid())` already
-- prevents pointing a row at another user.
grant update (
  id, company_name, trade_type, logo_url, created_at, trade_types, certifications,
  onboarding_complete, date_of_birth, profession, full_name, gas_safe_number,
  default_engineer_name, default_engineer_id, company_address, company_postcode,
  company_phone, engineer_phone, company_address_line2, company_town, standard_rates,
  request_link_slug, default_rate, company_email, bank_name, bank_account_name,
  bank_sort_code, bank_account_number, saved_signature_url
) on public.profiles to authenticated;

grant insert (
  id, company_name, trade_type, logo_url, created_at, trade_types, certifications,
  onboarding_complete, date_of_birth, profession, full_name, gas_safe_number,
  default_engineer_name, default_engineer_id, company_address, company_postcode,
  company_phone, engineer_phone, company_address_line2, company_town, standard_rates,
  request_link_slug, default_rate, company_email, bank_name, bank_account_name,
  bank_sort_code, bank_account_number, saved_signature_url
) on public.profiles to authenticated;

-- Withheld from `authenticated` and `anon`:
--   plan_tier, subscription_status, subscription_interval, subscription_period_end,
--   stripe_customer_id, stripe_subscription_id, trial_ends_at
--
-- anon has no RLS policy on profiles at all, so its write grants were dead
-- weight; leaving them revoked rather than re-granting.
