-- CP12 appliances: data-plate GC number, and the two flue tests that actually apply.
--
-- Background. The certificate previously carried one vague "flue performance
-- test" for every flued appliance, and printed the gas tightness answer under a
-- "Spillage test" heading. Those are three different things:
--
--   * flue integrity test — room-sealed / balanced-flue appliances. Analyser at
--     the air-inlet sampling point at maximum and minimum rate, proving
--     combustion products are not leaking internally back into the air supply.
--   * flue flow test + spillage test — open-flued appliances. Proving the
--     chimney draws, the spillage test using a smoke match at the draught
--     diverter with doors and windows shut.
--
-- A room-sealed appliance never gets a spillage test and an open-flued one never
-- gets an integrity test, so which columns apply is decided by flue_type — see
-- FLUE_KIND_FIELDS in src/lib/cp12/applianceConfig.ts.
--
-- flue_performance_test is kept as the flue *flow* result rather than renamed,
-- so existing rows are not rewritten. Values captured on room-sealed appliances
-- before this change were recorded under the old ambiguous label; the renderer
-- gates on applicability, so they no longer print.
--
-- All columns are nullable free text with no default. None of these is required
-- by Regulation 36(3), and validateCp12TierOne does not check them — an engineer
-- can still issue a certificate without filling any of them in.

alter table public.cp12_appliances
  add column if not exists gc_number text,
  add column if not exists flue_integrity_test text,
  add column if not exists flue_integrity_co2_high text,
  add column if not exists flue_integrity_co2_low text,
  add column if not exists spillage_test text;

comment on column public.cp12_appliances.gc_number is
  'Gas Council number from the appliance data plate, e.g. 47-311-92. Free text, never inferred from make/model: not every appliance has one, and where one exists it identifies a model variant rather than a model.';
comment on column public.cp12_appliances.flue_integrity_test is
  'Flue integrity test result. Room-sealed / balanced-flue appliances only.';
comment on column public.cp12_appliances.flue_integrity_co2_high is
  'Air-inlet CO2 % at maximum rate. Optional evidence for the flue integrity test.';
comment on column public.cp12_appliances.flue_integrity_co2_low is
  'Air-inlet CO2 % at minimum rate. Optional evidence for the flue integrity test.';
comment on column public.cp12_appliances.spillage_test is
  'Spillage test result. Open-flued appliances only.';
comment on column public.cp12_appliances.flue_performance_test is
  'Flue flow test result. Open-flued appliances only. Rows predating the 2026-07-31 split may hold a value captured under the older ambiguous "flue performance test" label, including on room-sealed appliances, where it no longer prints.';
