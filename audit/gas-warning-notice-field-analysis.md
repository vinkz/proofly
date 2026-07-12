# Gas Warning Notice (Unsafe Situation) — Legal Minimum Content Audit

**Date:** 2026-07-12
**Scope:** The fields in our **Gas Warning Notice** template (`src/types/gas-warning-notice.ts`, `src/server/pdf/gasWarningFieldMap.ts`, `src/server/pdf/renderGasWarningNoticePdf.ts`, `gas-warning-notice-wizard.tsx`) against actual legal / procedural requirements — the source of truth for redesigning this cert.
**Change note:** Analysis only. No code changed.
**Related audits:** [cp12-field-analysis.md](cp12-field-analysis.md) · [gas-service-field-analysis.md](gas-service-field-analysis.md)

---

## ⚠️ Headline: the notice is a GIUSP procedure, backed by real duties

Unlike the CP12 (whose minimum content is *prescribed* by statute — GSIUR 1998 Reg 36(3)), the warning notice **is not a statutory form**. It is the industry **Gas Industry Unsafe Situations Procedure (GIUSP, IGEM/G/11)** document. But it sits on top of binding duties, which fix its must-have core:

1. **GSIUR Reg 26(9)** — after examining an appliance the engineer must **notify any defect** to the responsible person.
2. **RIDDOR 2013 Reg 6(2)** — a Gas Safe registered engineer/employer **must report Immediately Dangerous (ID)** gas fittings to HSE **within 14 days**.
3. **GIUSP (IGEM/G/11)** — classify the situation (ID / AR) and take the corresponding actions (turn off with permission; cap + "Danger — Do Not Use" label for ID; notify the responsible person; notify the emergency provider if ID disconnection is refused).

**Its core is:** identify the appliance and the danger → classify ID/AR → record action taken → notify the responsible person → RIDDOR-report for ID.

## Sources

| Ref | Source |
|-----|--------|
| **GIUSP** | IGEM/G/11 Edition 2, *Gas Industry Unsafe Situations Procedure* — [igem.org.uk](https://www.igem.org.uk/resource/igem-g-11-edition-2-gas-industry-unsafe-situations-procedure.html) (industry standard; referenced by Gas Safe Register) |
| **OC** | HSE Operational Circular **OC 440/37**, *Dangerous Gas Fittings (GIUSP)* — [hse.gov.uk/foi/internalops/ocs/400-499/440_37.htm](https://www.hse.gov.uk/foi/internalops/ocs/400-499/440_37.htm) |
| **RIDDOR** | Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013, **Reg 6(2)** + HSE guidance & report form — [hse.gov.uk/gas/supply/gas-riddor-gsmr.htm](https://www.hse.gov.uk/gas/supply/gas-riddor-gsmr.htm), [notifications.hse.gov.uk/riddorforms/DangerousGasFitting](https://notifications.hse.gov.uk/riddorforms/DangerousGasFitting) |
| **RGE** | *RIDDOR: a gas engineer's guide* — [registeredgasengineer.co.uk](https://registeredgasengineer.co.uk/riddor-a-gas-engineers-guide/) |
| **R26(9)** | GSIUR 1998, **Reg 26(9)** — [legislation.gov.uk/uksi/1998/2451/regulation/26](https://www.legislation.gov.uk/uksi/1998/2451/regulation/26) (examine + notify defects) |

### GIUSP — the unsafe-situation core (from **OC**, **GIUSP**)
- **Immediately Dangerous (ID):** an immediate danger to life or property if operated or left connected → **disconnect, cap off, label "Danger — Do Not Use"**, with the consumer's permission; if the consumer refuses, **notify the gas emergency service provider**; **RIDDOR-report to HSE within 14 days**.
- **At Risk (AR):** a recognised fault that may become dangerous → turn off **with permission**; issue a warning/advice notice. A "Danger — Do Not Use" label is **not** applied to a pure AR situation.
- Either way: **notify the responsible person** of the defect and the improvement required (**R26(9)**).
- **What is *not* RIDDOR-reportable:** situations dangerous solely due to lack of maintenance (send to HSE as a concern instead). (**RGE**)

## Classification legend
- **(1) Required** — driven by a binding duty (GSIUR Reg 26(9) / RIDDOR Reg 6(2)) or by the GIUSP procedure. Some items are required **only when ID** (noted).
- **(2) Conventional** — standard on GIUSP / industry warning-notice forms; evidences a (1) item. Not itself mandated.
- **(3) Optional / removable** — administrative or product convenience.

---

## Field-by-field table

### Party / premises / responsible person

| Field(s) | Class | Basis |
|---|---|---|
| `engineer_name`, `gas_safe_number` | **(1)** | Identifies the competent person who classified the danger; parallels the RIDDOR reporter. (**OC**, **RIDDOR**) |
| `property_address`, `postcode`, `job_address_name`, `job_address_city`, `job_postcode` | **(1)** | Location of the dangerous fitting — required on the HSE dangerous-gas-fitting report and to identify the premises. (**RIDDOR** form) |
| `customer_name`, `customer_contact`, `customer_address`, `customer_city`, `customer_postcode` (responsible person / landlord) | **(1)** | The responsible person the notice is **given to** and who must be notified of the defect. (**R26(9)**; HSE report records landlord/occupier) |
| `engineer_id_card_number`, `engineer_company`, `company_address`, `company_postcode`, `company_phone`, `job_tel`, `customer_company`, `customer_mobile` | **(2)** | Conventional contact / identity detail — omit-if-absent. |

### Appliance & the unsafe situation — the core

| Field(s) | Class | Basis |
|---|---|---|
| `appliance_type`, `make_model`, `serial_number`, `appliance_location` | **(1)** | Identify the specific dangerous fitting. (**RIDDOR** form; **GIUSP**) |
| `classification` (ID / AR), `classification_code` | **(1)** | The heart of GIUSP — the danger category drives every required action. (**GIUSP**, **OC**) |
| `unsafe_situation_description` (fault details) | **(1)** | The nature of the danger — required to notify the responsible person and to RIDDOR-report. (**R26(9)**, **RIDDOR**) |
| `gas_escape_issue`, `pipework_issue`, `ventilation_issue`, `meter_issue`, `chimney_flue_issue`, `other_issue` / `other_issue_details` | **(1)/(2)** | Defect category — the HSE report asks for the fault category (gas leak / inadequate flue / inadequate ventilation / other). Category selection **(1)**; free-text detail conventional **(2)**. (**RIDDOR** form) |
| `underlying_cause` | **(2)** | Root cause — conventional on GIUSP forms; supports the notify duty. |

### Action taken & notification

| Field(s) | Class | Basis |
|---|---|---|
| `actions_taken` | **(1)** | Record of the action taken to make safe — GIUSP core; the HSE report records action taken. (**OC**, **RIDDOR**) |
| `gas_supply_isolated`, `appliance_capped_off`, `customer_refused_isolation` | **(1)** | For **ID**: disconnect / cap with permission; if refused, notify the emergency provider — mandated by GIUSP. (**OC**, **GIUSP**) |
| `danger_do_not_use_label_fitted` | **(1) for ID / (3) for AR** | "Danger — Do Not Use" label is **required for ID** and **must not** be applied to a pure AR. Its state is part of the procedure. (**GIUSP**, **OC**) |
| `meter_or_appliance_tagged` | **(2)** | Tagging evidence — conventional. |
| `emergency_services_contacted`, `emergency_reference` | **(1) when ID isolation refused** | Notifying the gas emergency provider is required if the consumer refuses ID disconnection. (**OC**) Otherwise conventional. |
| `riddor11_1` (RIDDOR marker) / RIDDOR reference | **(1) for ID** | ID fittings **must** be reported to HSE under RIDDOR Reg 6(2) within 14 days; the notice should evidence this. (**RIDDOR**) |
| `customer_informed`, `notice_left_on_premises`, `customer_present` | **(1)** | The responsible person **must be notified** and left the notice — the statutory notify duty (**R26(9)**) and the point of the document. |
| `customer_understands_risks`, `customer_signature_url`, `customer_signed_at` | **(2)** | Acknowledgement / signature of the responsible person — strong good practice and standard on GIUSP forms, but (as with CP12) not a statutory signing requirement. Keep, optional. |

---

## 🚩 Flags for the redesign

- **F-W1 — Classification must drive the form.** ID vs AR changes what is *required* (label + RIDDOR + cap for ID; none of these for a pure AR). Make the ID/AR selection the spine, and **conditionally require** the ID-only items (label fitted, RIDDOR reference, isolation/cap) when ID is chosen.
- **F-W2 — RIDDOR report reference.** For ID, capture/record the RIDDOR submission reference — the notice evidences a legal report. Confirm `riddor11_1` / an emergency/RIDDOR reference field is surfaced when ID.
- **F-W3 — Notice date / time.** Confirm the notice carries an issue date (we have `customer_signed_at`; a dedicated notice date is worth having). Minor.
- **F-W4 — Responsible-person type.** GIUSP / HSE distinguish landlord vs occupier / owner; a "given to: landlord / tenant / owner" selector would tighten compliance. Conventional.
- **F-W5 — Not RIDDOR-reportable if purely maintenance-related.** Don't force a RIDDOR reference for AR or maintenance-only situations. (**RGE**)

## Redesign guidance
1. Adopt the CP12 house style + adaptive "render-if-captured".
2. Make **ID/AR classification the spine**; conditionally require the ID-only duties (Danger-Do-Not-Use label, cap/isolate, RIDDOR reference, emergency-provider notification if refused) and the responsible-person notification.
3. Keep the customer acknowledgement / signature optional (like CP12).
4. Reuse the CP12 tiered `field-config` + shared validator/renderer primitives.

### PDF redesign — ✅ implemented (2026-07-12)
- New programmatic renderer `src/server/pdf/renderGasWarningNoticeV2.ts` in the CP12 house style (A4, monochrome + status colour). `renderGasWarningNoticePdf` now delegates to it (the fixed AcroForm asset is retired for this cert).
- **Classification is the spine**: a full-width banner — deep red **IMMEDIATELY DANGEROUS** / amber **AT RISK** — with the ID/AR code, driving the rest of the form (F-W1).
- **ID-only sections are conditional**: the RIDDOR-report section renders only for ID (with the report/emergency reference); a pure AR shows an explicit "No 'Danger — Do Not Use' label fitted (At Risk)" note (F-W1/F-W2/F-W5).
- Adaptive render-if-captured for appliance, defect categories, action flags, and responsible-person notification; engineer signature always, responsible-person signature optional.
- Footer cites the GIUSP (IGEM/G/11) and stamps `gwn-template-v2`. Samples: `tmp/gwn-v2-at-risk.pdf`, `tmp/gwn-v2-immediately-dangerous.pdf`.

### Wizard alignment — ✅ implemented (2026-07-12)
- **Single source of truth:** new shared validator `src/lib/gwn/validation.ts` (`validateGwnForIssue`) encodes the tier-1 requirements + ID-conditional duties. The server issue gate (`certificates.ts` `validateGasWarningNoticeForIssue`) now delegates to it, so wizard and server enforce identical rules.
- **F-W2 done:** for Immediately Dangerous, issuing is now blocked unless a **RIDDOR report is recorded** (RIDDOR 11(1)/11(2) flag or an HSE/RIDDOR report reference) — enforced in the shared validator, added to the wizard checklist, and the reference input is relabelled "HSE / RIDDOR report reference (required if Immediately Dangerous)".
- The wizard already had the classification select, safety-action checkboxes (Danger label, isolation, cap, refusal), and RIDDOR 11(1)/11(2) checkboxes; those remain and are now gated consistently.
- Tests: `tests/gwn-validation.test.ts` (AR passes without RIDDOR; ID blocked without RIDDOR; ID passes once recorded; Danger-label/isolation still required; notice-left required when not present).

**Still to do:** dedicated notice date (**F-W3**, currently uses `issued_at`), a responsible-person-type "given to: landlord / tenant / owner" selector (**F-W4**, conventional), and optionally a full tiered `field-config` like CP12. Interactive wizard click-through recommended before merge.

_Analysis only — sources current as of 2026-07-12. IGEM/G/11 is a paid standard; where its exact wording matters for implementation, verify against the current edition or Gas Safe Register technical bulletins._
