# Gas Service Record & Gas Warning Notice — Legal Minimum Content Audit

**Date:** 2026-07-12
**Scope:** Compares the fields in our **Gas/Boiler Service Record** and **Gas Warning Notice** templates against the actual legal / standards requirements, so we can redesign both to the new CP12 house style without dropping anything required.
**Change note:** Analysis only. No code changed.

---

## ⚠️ Headline: neither document has a statutory content list like CP12

The CP12 is unusual: its minimum content is **prescribed by statute** (Gas Safety (Installation and Use) Regulations 1998, Reg 36(3)). **Neither of these two documents is.** That means we have far more design freedom — but there are still binding duties and strong industry standards that dictate a "must-have" core. Get these right and the rest is convention.

| Document | Is the *document* legally mandated? | What actually governs its content |
|---|---|---|
| **Gas/Boiler Service Record** | **No.** Annual servicing is a warranty / best-practice matter for owner-occupiers, not a legal duty. (A landlord's annual *safety check* is a legal duty — but that is the CP12, not a "service".) | Manufacturer instructions + **Benchmark** (HHIC) for warranty; **Building Regulations** for *commissioning* a new appliance; **GSIUR Reg 26(9)** safety examination whenever gas work is done. |
| **Gas Warning Notice** | **No** — the notice itself is a procedural document, not a statutory form. | **IGEM/G/11 – Gas Industry Unsafe Situations Procedure (GIUSP)**; **GSIUR Reg 26(9)** (examine + notify defects to the responsible person); **RIDDOR 2013 Reg 6(2)** (report Immediately Dangerous fittings to HSE). |

## Sources

| Ref | Source |
|-----|--------|
| **GIUSP** | IGEM/G/11 Edition 2, *Gas Industry Unsafe Situations Procedure* — [igem.org.uk](https://www.igem.org.uk/resource/igem-g-11-edition-2-gas-industry-unsafe-situations-procedure.html) (industry standard, referenced by Gas Safe Register) |
| **OC** | HSE Operational Circular **OC 440/37**, *Dangerous Gas Fittings (Gas Industry Unsafe Situations Procedure)* — [hse.gov.uk/foi/internalops/ocs/400-499/440_37.htm](https://www.hse.gov.uk/foi/internalops/ocs/400-499/440_37.htm) |
| **RIDDOR** | Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013, **Reg 6(2)** + HSE guidance & report form — [hse.gov.uk/gas/supply/gas-riddor-gsmr.htm](https://www.hse.gov.uk/gas/supply/gas-riddor-gsmr.htm), [notifications.hse.gov.uk/riddorforms/DangerousGasFitting](https://notifications.hse.gov.uk/riddorforms/DangerousGasFitting) |
| **R26(9)** | Gas Safety (Installation and Use) Regulations 1998, **Reg 26(9)** — [legislation.gov.uk/uksi/1998/2451/regulation/26](https://www.legislation.gov.uk/uksi/1998/2451/regulation/26) |
| **BM** | HHIC **Benchmark** Commissioning & Service Interval Record scheme — [hhic.org.uk](https://www.hhic.org.uk/) |

### Reg 26(9)(a)–(d) — the safety examination required on *any* gas work (verbatim)
(a) "the effectiveness of any flue" · (b) "the supply of combustion air" · (c) "its operating pressure or heat input or, where necessary, both" · (d) "its operation so as to ensure its safe functioning". Reg 26(9) also requires the person to **notify any defect** to the responsible person / owner / gas supplier.

### GIUSP — the unsafe-situation core (from **OC**, **GIUSP**)
- **Immediately Dangerous (ID):** an immediate danger to life or property if operated or left connected → **disconnect, cap off, label "Danger — Do Not Use"**, with the consumer's permission; if the consumer refuses, notify the gas emergency service provider; **RIDDOR-report to HSE within 14 days**.
- **At Risk (AR):** a recognised fault that may become dangerous → turn off **with permission**; a warning/advice notice is issued. (A "Danger — Do Not Use" label is *not* applied to a pure AR situation.)
- Either way: **notify the responsible person** of the defect and the action/improvement required (GSIUR Reg 26(9)).

### Classification legend
- **(1) Required** — mandated by a binding duty (GSIUR / RIDDOR) **or** by the GIUSP procedure / Building-Regs commissioning. For these two documents "required" means procedural/duty-driven, not a Reg-36-style content list.
- **(2) Conventional** — standard on Benchmark / GIUSP industry forms; evidences a (1) item or supports warranty. Not itself mandated.
- **(3) Optional / removable** — administrative or product convenience.

---

# 1) Gas / Boiler Service Record

**Bottom line:** there is **no legally-prescribed content**. The only hard obligations are (a) whoever does the gas work must be Gas Safe registered and competent, and (b) after working on the appliance they must carry out the **Reg 26(9)** safety examination and notify any defect. For a *new* appliance, **commissioning** (with combustion readings) is required for Building-Regs compliance and Benchmark warranty. Everything else on a service record is Benchmark/manufacturer convention — valuable, but we can shape it freely.

### Party / header fields

| Field(s) | Class | Basis |
|---|---|---|
| `engineer_name`, `gas_safe_number` | **(1)** | Only a Gas Safe registered engineer may do the work (GSIUR Reg 3); the record must identify who did it — accountability. |
| `property_address`, `postcode`, `service_date` | **(1)** | Identify the appliance worked on and when — needed for the Reg 26(9) examination record and Benchmark. |
| `boiler_make`, `boiler_model`, `boiler_type`, `serial_number`, `boiler_location` | **(1)** | Identify the specific appliance examined (Reg 26(9) is "in respect of" the appliance). **BM** |
| `company_name`, `company_address` | **(2)** | Business identity — conventional; not mandated. Omit-if-absent, matching CP12. |
| `customer_name`, `customer_company`, `customer_city`, `customer_postcode`, `customer_phone` | **(2)** | Customer/contact block — conventional. |
| `gas_type`, `mount_type`, `flue_type` | **(2)** | Appliance descriptors — conventional/Benchmark. |

### Safety examination results (Reg 26(9)) — the closest thing to "required"

| Field(s) | Class | Basis |
|---|---|---|
| `appliance_flueing_safe`, `service_flue_checked` | **(1)** | Reg 26(9)(a) "effectiveness of any flue" (**R26(9)**) |
| `appliance_ventilation_safe`, `service_ventilation_checked` | **(1)** | Reg 26(9)(b) "supply of combustion air" (**R26(9)**) |
| `operating_pressure_mbar`, `inlet_pressure_mbar`, `heat_input`, `burner_pressure_gas_rate_correct` | **(1)** | Reg 26(9)(c) "operating pressure or heat input" (**R26(9)**) |
| `appliance_safe`, `appliance_operating_correctly`, `boiler_working_correctly`, `emission_combustion_test` | **(1)** | Reg 26(9)(d) "operation so as to ensure its safe functioning" (**R26(9)**) |
| `co_ppm`, `high_combustion_co_ppm`, `high_combustion_ratio`, `low_combustion_co_ppm`, `low_combustion_ratio`, `flue_gas_temp_c` | **(2)** | Combustion analysis. **Mandatory to record at commissioning** (Benchmark); conventional at routine service. **BM** |
| `tightness_test_carried_out` | **(2)** | Gas tightness/soundness — good practice on service; not a prescribed service-record item. |

### Benchmark / manufacturer service tasks (warranty best-practice)

| Field(s) | Class | Basis |
|---|---|---|
| `service_visual_inspection`, `service_burner_cleaned`, `service_heat_exchanger_cleaned`, `service_condensate_trap_checked`, `service_seals_checked`, `service_filters_cleaned`, `service_controls_checked`, `service_leaks_checked`, `appliance_controls_checked`, `appliance_conforms_standards` | **(2)** | Benchmark/manufacturer service tasks — required for *warranty*, not by law. **BM** |
| `system_pressure_bar`, `cylinder_condition_checked`, `programmer_controls_working`, `warm_air_grills_working`, `all_functional_parts_available` | **(2)/(3)** | System/ancillary checks — conventional to optional depending on appliance. |
| `co_alarm_fitted` | **(2)** | CO alarm presence (Smoke & CO Alarm regs are a separate landlord duty). Conventional. |

### 🚩 Flags for the service record
- **F-S1 — Nothing here is a hard legal blocker except engineer identity + the Reg 26(9) results.** So for validation we should require only: engineer name + Gas Safe number, appliance identity, and the Reg 26(9) safety outcomes; everything else is optional/omit-if-empty (mirror the CP12 adaptive approach).
- **F-S2 — No "next service due" / Benchmark service-interval field.** Benchmark records leave a service-interval date with the householder; consider adding one (auto +12 months) — conventional, not required.
- **F-S3 — Commissioning vs service.** If this template is ever used to *commission* a new appliance, combustion readings become **mandatory** (Benchmark/Building Regs). Worth a mode flag later; not required for a routine service.

---

# 2) Gas Warning Notice (Unsafe Situation)

**Bottom line:** the notice is a **GIUSP** procedural document, backed by real duties: GSIUR Reg 26(9) (examine + **notify** the responsible person of defects) and **RIDDOR Reg 6(2)** (report **Immediately Dangerous** fittings to HSE within 14 days). Its "must-have" core is: identify the appliance and the danger, classify it (ID/AR), record the action taken (turn-off/permission, cap/label for ID), and notify the responsible person — plus the RIDDOR report for ID.

### Party / premises / responsible person

| Field(s) | Class | Basis |
|---|---|---|
| `engineer_name`, `gas_safe_number` | **(1)** | Identifies the competent person who classified the danger; parallels the RIDDOR reporter. (**OC**, **RIDDOR**) |
| `property_address`, `postcode`, `job_address_name`, `job_address_city`, `job_postcode` | **(1)** | Location of the dangerous fitting — required on the HSE dangerous-gas-fitting report and to identify the premises. (**RIDDOR** form) |
| `customer_name`, `customer_contact`, `customer_address`, `customer_city`, `customer_postcode` (responsible person / landlord) | **(1)** | The responsible person the notice is **given to** and who must be notified of the defect (GSIUR Reg 26(9); HSE report records landlord/occupier). |
| `engineer_id_card_number`, `engineer_company`, `company_address`, `company_postcode`, `company_phone`, `job_tel`, `customer_company`, `customer_mobile` | **(2)** | Conventional contact/identity detail — omit-if-absent. |

### Appliance & the unsafe situation — the core

| Field(s) | Class | Basis |
|---|---|---|
| `appliance_type`, `make_model`, `serial_number`, `appliance_location` | **(1)** | Identify the specific dangerous fitting (**RIDDOR** form; **GIUSP**). |
| `classification` (ID / AR), `classification_code` | **(1)** | The heart of GIUSP — the danger category drives every required action. (**GIUSP**, **OC**) |
| `unsafe_situation_description` (fault details) | **(1)** | The nature of the danger — required to notify the responsible person and to RIDDOR-report. (**R26(9)**, **RIDDOR**) |
| `gas_escape_issue`, `pipework_issue`, `ventilation_issue`, `meter_issue`, `chimney_flue_issue`, `other_issue`/`other_issue_details` | **(1)/(2)** | Defect category — the HSE report asks for the fault category (gas leak / inadequate flue / inadequate ventilation / other). Category selection **(1)**; free-text detail conventional **(2)**. (**RIDDOR** form) |
| `underlying_cause` | **(2)** | Root cause — conventional on GIUSP forms; supports the notify duty. |

### Action taken & notification

| Field(s) | Class | Basis |
|---|---|---|
| `actions_taken` | **(1)** | Record of the action taken to make safe — GIUSP core; HSE report records action taken. (**OC**, **RIDDOR**) |
| `gas_supply_isolated`, `appliance_capped_off`, `customer_refused_isolation` | **(1)** | For **ID**: disconnect/cap with permission; if refused, notify emergency provider — mandated by GIUSP. (**OC**, **GIUSP**) |
| `danger_do_not_use_label_fitted` | **(1) for ID / (3) for AR** | "Danger — Do Not Use" label is **required for ID**, and **must not** be applied to a pure AR. Its state is part of the procedure. (**GIUSP**, **OC**) |
| `meter_or_appliance_tagged` | **(2)** | Tagging evidence — conventional. |
| `emergency_services_contacted`, `emergency_reference` | **(1) when ID isolation refused** | Notifying the gas emergency provider is required if the consumer refuses ID disconnection. (**OC**) Otherwise conventional. |
| `riddor11_1` (RIDDOR marker) / RIDDOR reference | **(1) for ID** | ID fittings **must** be reported to HSE under RIDDOR Reg 6(2) within 14 days; the notice should evidence this. (**RIDDOR**) |
| `customer_informed`, `notice_left_on_premises`, `customer_present` | **(1)** | The responsible person **must be notified** and left the notice — the statutory notify duty (**R26(9)**) and the point of the document. |
| `customer_understands_risks`, `customer_signature_url`, `customer_signed_at` | **(2)** | Acknowledgement / signature of the responsible person — strong good practice and standard on GIUSP forms, but (as with CP12) not a statutory signing requirement. Keep, optional. |

### 🚩 Flags for the warning notice
- **F-W1 — Classification must drive the form.** ID vs AR changes what is *required* (label + RIDDOR + cap for ID; not for AR). The redesign should make the ID/AR selection the spine and conditionally require the ID-only items (label fitted, RIDDOR reference, isolation/cap) when ID is chosen.
- **F-W2 — RIDDOR report reference.** For ID we should capture/record the RIDDOR submission reference (the notice evidences a legal report). Confirm `riddor11_1` / an emergency/RIDDOR reference field is surfaced when ID.
- **F-W3 — Notice date / time.** Confirm the notice carries an issue date (we have `customer_signed_at`; a dedicated notice date is worth having). Minor.
- **F-W4 — Responsible-person type.** GIUSP/HSE distinguish landlord vs occupier/owner as the responsible person; a simple "given to: landlord / tenant / owner" selector would tighten compliance. Conventional.

---

## What this means for the redesign (next step, not done here)

1. **Both documents can adopt the CP12 house style and the adaptive "render-if-captured" approach** — neither has a fixed statutory content list, so omitting unperformed sections is fine.
2. **Service record** — enforce only: engineer name + Gas Safe number, appliance identity, and the **Reg 26(9)** safety outcomes. Treat Benchmark service tasks + combustion as conventional (render-if-done). Consider a "next service due" and a commissioning mode (combustion mandatory).
3. **Warning notice** — make **ID/AR classification the spine**; conditionally require the ID-only duties (Danger-Do-Not-Use label, cap/isolate, **RIDDOR** reference, emergency-provider notification if refused) and the **responsible-person notification**. Keep the customer acknowledgement/signature optional (like CP12).
4. Reuse the CP12 tiered `field-config` pattern and the shared validator/renderer primitives so all three documents stay consistent.

_Analysis only — sources current as of 2026-07-12. IGEM/G/11 is a paid standard; where its exact wording matters for implementation, verify against the current edition or Gas Safe Register technical bulletins._
