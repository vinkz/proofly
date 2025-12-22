# Gas Warning Notice (CP14-style)

## Purpose
- Issued when an appliance, flue, or pipework is classified as At Risk (AR) or Immediately Dangerous (ID) under the Gas Industry Unsafe Situations Procedure.
- Records the unsafe condition, actions taken, and that the responsible person has been informed and (ideally) signed.

## When used
- During CP12 / landlord gas safety checks.
- During boiler services / breakdown visits.
- Standalone callouts where no other certificate is issued.

## Sections and fields

### 1) Job / property
- `job_id` (FK, internal)
- `property_address` (string, required)
- `postcode` (string, optional but strongly recommended)
- `customer_name` (string, required)
- `customer_contact` (string, optional phone/email)

### 2) Appliance / location
- `appliance_location` (string, required)
- `appliance_type` (string, required, free text or dropdown)
- `make_model` (string, optional)
- `gas_supply_isolated` (boolean)
- `appliance_capped_off` (boolean)
- `customer_refused_isolation` (boolean)

### 3) Classification
- `classification` (enum, required): `IMMEDIATELY_DANGEROUS`, `AT_RISK`
- `classification_code` (string, optional free text code, e.g. ID / AR / NCS)
- `unsafe_situation_description` (multiline string, required)
- `underlying_cause` (multiline string, optional)

### 4) Actions taken
- `actions_taken` (multiline string, required – brief description of work done / isolation / advice)
- `emergency_services_contacted` (boolean)
- `emergency_reference` (string, optional)
- `danger_do_not_use_label_fitted` (boolean, required)
- `meter_or_appliance_tagged` (boolean, optional)

### 5) Customer acknowledgement
- `customer_informed` (boolean, required)
- `customer_understands_risks` (boolean, optional)
- `customer_signature_url` (string, optional – Supabase URL)
- `customer_signed_at` (datetime, optional)

### 6) Engineer details
- `engineer_name` (string, required)
- `engineer_company` (string, required)
- `gas_safe_number` (string, required)
- `engineer_id_card_number` (string, optional)
- `engineer_signature_url` (string, optional – Supabase URL)
- `issued_at` (datetime, required)
- `record_id` (string, required – generated UUID/short ID)

## Validation rules (issue only)
- `property_address`, `customer_name`, `appliance_location`, `appliance_type`, `classification`,
  `unsafe_situation_description`, `actions_taken`, `engineer_name`, `gas_safe_number`, `issued_at`,
  `record_id`: required.
- `danger_do_not_use_label_fitted` must be `true` when classification is `IMMEDIATELY_DANGEROUS`.
- If classification is `IMMEDIATELY_DANGEROUS` and `gas_supply_isolated` is `false`,
  `customer_refused_isolation` must be `true`.
- `customer_informed` must be `true` for issue.

## Linking to jobs / certificates
- `gas_warning_notice` has a foreign key to `jobs.id`.
- Optional link to a parent certificate (`cp12_id` or `boiler_service_id`) if issued from within another flow.
