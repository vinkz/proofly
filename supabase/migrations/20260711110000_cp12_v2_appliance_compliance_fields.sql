-- CP12 v2 keeps the record-level declaration while retaining an auditable
-- confirmation for every appliance/flue checked. Both columns remain nullable
-- so historic issued certificates and in-progress drafts stay readable.
alter table public.cp12_appliances
  add column if not exists flue_location text,
  add column if not exists reg_26_9_confirmed boolean;
