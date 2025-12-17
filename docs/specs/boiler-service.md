# Boiler Service – Specification

This spec is authoritative for UI, validation, and PDF rendering.

## Purpose
- Boiler Service Record for domestic boilers.
- Captures site details, engineer credentials, appliance specifics, service actions, readings, findings, and signatures.

## Fields (job_fields)
### Step 1 — Job & Engineer
- `customer_name`
- `property_address` (required for issue)
- `postcode` (optional)
- `service_date` (required for issue)
- `engineer_name` (required for issue)
- `gas_safe_number` (required for issue)
- `company_name` (optional)
- `company_address` (optional)

### Step 2 — Boiler details & evidence
- `boiler_make` (required for issue)
- `boiler_model` (required for issue)
- `boiler_type` (select: combi/system/regular/other)
- `boiler_location` (required for issue)
- `serial_number` (optional)
- `gas_type` (select: natural gas/LPG)
- `mount_type` (select: wall/floor)
- `flue_type` (select: room sealed/open flue/balanced/other)
- Evidence capture categories (job_photos): `boiler`, `serial_label`, `flue`, `before_after`, `issue_defect`

### Step 3 — Service actions, readings, findings
- Service toggles (yes/no):
  - `service_visual_inspection`
  - `service_burner_cleaned`
  - `service_heat_exchanger_cleaned`
  - `service_condensate_trap_checked`
  - `service_seals_checked`
  - `service_filters_cleaned`
  - `service_flue_checked`
  - `service_ventilation_checked`
  - `service_controls_checked`
  - `service_leaks_checked`
- Readings (optional):
  - `operating_pressure_mbar`
  - `inlet_pressure_mbar`
  - `co_ppm`
  - `co2_percent`
  - `flue_gas_temp_c`
  - `system_pressure_bar`
- Findings:
  - `service_summary` (required for issue)
  - `recommendations` (required for issue)
  - `defects_found` (yes/no)
  - `defects_details` (required if defects_found = yes)
  - `parts_used` (optional)
  - `next_service_due` (optional)

### Step 4 — Signatures
- `engineer_signature` (required for issue)
- `customer_signature` (required for issue)

## Validation Rules (final issue)
- Required: `property_address`, `service_date`, `engineer_name`, `gas_safe_number`, `boiler_make`, `boiler_model`, `boiler_location`, `service_summary`, `recommendations`, `engineer_signature`, `customer_signature`.
- Conditional: if `defects_found` = yes → `defects_details` required.
- Draft saves are allowed without these fields.

## PDF Sections
- Header: “Boiler Service Record” + CertNow brand + issued timestamp.
- Property/Customer details.
- Engineer & company details.
- Boiler details (make/model/type/location/serial/fuel/mount/flue).
- Service actions checklist (two-column ticks/Yes-No).
- Readings table (only render rows that have values).
- Findings & recommendations (summary, recommendations, parts, next due, defects).
- Signatures (engineer + customer) and issued timestamp.
- Preview mode shows light grey outlined boxes when values are missing.

## Dropdown / Option Values
- `boiler_type`: Combi, System, Regular, Other.
- `mount_type`: Wall, Floor.
- `gas_type`: Natural gas, LPG.
- `flue_type`: Room sealed, Open flue, Balanced, Other.
- Evidence photo categories: `boiler`, `serial_label`, `flue`, `before_after`, `issue_defect`.
