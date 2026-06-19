-- Makes CP12 appliance rows category-aware so a single certificate can cover
-- boilers, gas hobs/cookers, gas fires and water heaters (not just boilers).
--
-- * appliance_type is repurposed to hold the appliance CATEGORY
--   ('boiler' | 'hob_cooker' | 'gas_fire' | 'water_heater' | 'other'). Legacy rows
--   stored boiler subtypes here ('combi'/'system'/'regular'/'other'); the app's
--   resolveCp12Category() normalizes those at read time, so no data backfill is
--   required for old certificates to keep rendering.
-- * appliance_subtype is NEW and only used when appliance_type = 'boiler'
--   (combi/system/regular/other).
-- * cooker_stability is NEW and only used for gas hobs/cookers (free-standing
--   cooker stability bracket/chain check).
--
-- Both new columns are nullable text with no default so existing rows and the
-- `...appliance` spread insert in saveCp12Appliances continue to work unchanged.
alter table public.cp12_appliances
  add column if not exists appliance_subtype text,
  add column if not exists cooker_stability text;
