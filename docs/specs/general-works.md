# General Works – Specification

This spec is authoritative for UI, validation, and PDF rendering.

## Purpose
- Universal job report / works completion report (non-legal) for repairs, callouts, installs, maintenance.
- Scope: any trade; not a compliance certificate.

## Fields (job_fields)
### Step 1 — Job basics
- `property_address` (required for issue)
- `postcode` (optional)
- `work_date` (required for issue)
- `customer_name` (optional)
- `engineer_name` (required for issue)
- `company_name` (optional)
- `customer_email` (optional)
- `customer_phone` (optional)

### Step 2 — Evidence capture
- `work_summary` (short, required for issue)
- `work_completed` (multiline, required for issue)
- `parts_used` (optional)
- `defects_found` (yes/no, optional)
- `defects_details` (required if defects_found = yes)
- `recommendations` (optional, preferred)

### Step 3 — Review & totals
- `invoice_amount` (optional)
- `payment_status` (optional)
- `follow_up_required` (yes/no, optional)
- `follow_up_date` (optional)
- `work_completed_preview` (display only, no storage)

### Step 4 — Signatures
- `engineer_signature` (required for issue)
- `customer_signature` (required for issue)

## Photo categories (job_photos)
- `site`
- `before`
- `after`
- `issue_defect`
- `parts`
- `receipt_invoice` (optional)

## Validation Rules (final issue)
- Required: `property_address`, `work_date`, `engineer_name`, `work_summary`, `work_completed`, `engineer_signature`, `customer_signature`.
- Conditional: if `defects_found` = yes → `defects_details` required.
- Draft saves do not enforce these rules.

## PDF Sections
- Header: “General Works Report” + CertNow branding + issued timestamp.
- Property/Customer block (address, postcode, customer, contacts).
- Engineer/Company block.
- Work summary (short).
- Work completed (multiline).
- Parts used (if provided).
- Defects / issues (if provided).
- Recommendations (if provided).
- Invoice / payment / follow-up (if provided).
- Photos section: list available photo categories; show placeholders when none.
- Signatures (engineer + customer) and issued timestamp.
- Preview mode: light outlines / “Not provided” placeholders, no heavy fills.

## Wizard Steps
1) Job basics (property, date, engineer, optional customer/company/contact).
2) Evidence capture (fields above + photo cards with photo/voice/text actions).
3) Review & totals (invoice, payment, follow-up).
4) Signatures + Preview/Generate PDF.
