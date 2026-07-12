# Gas / Boiler Service Record — Legal Minimum Content Audit

**Date:** 2026-07-12
**Scope:** The fields in our **Gas / Boiler Service Record** template (`src/types/boiler-service.ts`, `src/server/pdf/renderGasServicePdf.ts`, `src/lib/pdf/gas-service-template.ts`, `boiler-service-wizard.tsx`) against actual legal / standards requirements — the source of truth for redesigning this cert.
**Change note:** Analysis only. No code changed.
**Related audits:** [cp12-field-analysis.md](cp12-field-analysis.md) · [gas-warning-notice-field-analysis.md](gas-warning-notice-field-analysis.md)

---

## ⚠️ Headline: a service record has no statutory content list

Unlike the CP12 (whose minimum content is *prescribed* by statute — GSIUR 1998 Reg 36(3)), a boiler/gas service record is **not a legally-mandated document**. A routine annual **service is not a legal requirement** for owner-occupiers — it is a **warranty / best-practice** matter. (A landlord's annual gas *safety check* is a legal duty, but that is the CP12, not a "service".)

The only binding obligations that touch a service are:
1. The work must be carried out by a **Gas Safe registered, competent person** (GSIUR Reg 3).
2. After working on the appliance, the engineer must carry out the **Reg 26(9)** safety examination and **notify any defect** to the responsible person.
3. **Commissioning a new appliance** additionally requires a checklist with **combustion readings** for **Building Regulations** compliance and Benchmark warranty validation.

Everything else on a service record is **Benchmark / manufacturer convention** — valuable for warranty and best practice, but shape-able freely.

## Sources

| Ref | Source |
|-----|--------|
| **R26(9)** | Gas Safety (Installation and Use) Regulations 1998, **Reg 26(9)** — [legislation.gov.uk/uksi/1998/2451/regulation/26](https://www.legislation.gov.uk/uksi/1998/2451/regulation/26) — the safety examination required after any gas work |
| **R3** | GSIUR 1998, **Reg 3** (competence / Gas Safe registration) — [legislation.gov.uk/uksi/1998/2451/regulation/3](https://www.legislation.gov.uk/uksi/1998/2451/regulation/3) |
| **BM** | HHIC **Benchmark** Commissioning & Service Interval Record scheme — [hhic.org.uk](https://www.hhic.org.uk/) (industry-standard service/commissioning record; combustion readings mandatory at commissioning; warranty condition) |
| **BR** | Building Regulations (Approved Document J / Part L) — commissioning of a new heat-producing appliance |
| **GSR** | Gas Safe Register — servicing guidance — [gassaferegister.co.uk](https://www.gassaferegister.co.uk/) |

### Reg 26(9)(a)–(d) — the safety examination on any gas work (verbatim)
(a) "the effectiveness of any flue" · (b) "the supply of combustion air" · (c) "its operating pressure or heat input or, where necessary, both" · (d) "its operation so as to ensure its safe functioning". Reg 26(9) also requires the person to **notify any defect** to the responsible person / owner / gas supplier. *(If an unsafe situation is found, the [Gas Warning Notice](gas-warning-notice-field-analysis.md) procedure applies.)*

## Classification legend
- **(1) Required** — driven by a binding duty (GSIUR Reg 3 / Reg 26(9)) or by Building-Regs commissioning. Not a Reg-36-style content list.
- **(2) Conventional** — standard on Benchmark / manufacturer service records; evidences a (1) item or supports warranty. Not itself mandated.
- **(3) Optional / removable** — administrative or product convenience.

---

## Field-by-field table

### Party / header fields

| Field(s) | Class | Basis |
|---|---|---|
| `engineer_name`, `gas_safe_number` | **(1)** | Only a Gas Safe registered engineer may do the work (**R3**); the record must identify who did it — accountability. |
| `property_address`, `postcode`, `service_date` | **(1)** | Identify the appliance worked on and when — needed for the Reg 26(9) record and Benchmark. **BM** |
| `boiler_make`, `boiler_model`, `boiler_type`, `serial_number`, `boiler_location` | **(1)** | Identify the specific appliance examined (Reg 26(9) is "in respect of" the appliance). **BM** |
| `company_name`, `company_address` | **(2)** | Business identity — conventional; not mandated. Omit-if-absent (mirror CP12). |
| `customer_name`, `customer_company`, `customer_city`, `customer_postcode`, `customer_phone` | **(2)** | Customer / contact block — conventional. |
| `gas_type`, `mount_type`, `flue_type` | **(2)** | Appliance descriptors — conventional / Benchmark. |

### Safety examination results (Reg 26(9)) — the closest thing to "required"

| Field(s) | Class | Basis |
|---|---|---|
| `appliance_flueing_safe`, `service_flue_checked` | **(1)** | Reg 26(9)(a) "effectiveness of any flue" (**R26(9)**) |
| `appliance_ventilation_safe`, `service_ventilation_checked` | **(1)** | Reg 26(9)(b) "supply of combustion air" (**R26(9)**) |
| `operating_pressure_mbar`, `inlet_pressure_mbar`, `heat_input`, `burner_pressure_gas_rate_correct` | **(1)** | Reg 26(9)(c) "operating pressure or heat input" (**R26(9)**) |
| `appliance_safe`, `appliance_operating_correctly`, `boiler_working_correctly`, `emission_combustion_test` | **(1)** | Reg 26(9)(d) "operation so as to ensure its safe functioning" (**R26(9)**) |
| `co_ppm`, `high_combustion_co_ppm`, `high_combustion_ratio`, `low_combustion_co_ppm`, `low_combustion_ratio`, `flue_gas_temp_c` | **(2)** | Combustion analysis. **Mandatory to record at commissioning** (Benchmark / Building Regs); conventional at routine service. **BM**, **BR** |
| `tightness_test_carried_out` | **(2)** | Gas tightness / soundness — good practice on service; not a prescribed service-record item. |

### Benchmark / manufacturer service tasks (warranty best-practice)

| Field(s) | Class | Basis |
|---|---|---|
| `service_visual_inspection`, `service_burner_cleaned`, `service_heat_exchanger_cleaned`, `service_condensate_trap_checked`, `service_seals_checked`, `service_filters_cleaned`, `service_controls_checked`, `service_leaks_checked`, `appliance_controls_checked`, `appliance_conforms_standards` | **(2)** | Benchmark / manufacturer service tasks — required for *warranty*, not by law. **BM** |
| `system_pressure_bar`, `cylinder_condition_checked`, `programmer_controls_working`, `warm_air_grills_working`, `all_functional_parts_available` | **(2)/(3)** | System / ancillary checks — conventional to optional depending on appliance. |
| `co_alarm_fitted` | **(2)** | CO alarm presence (Smoke & CO Alarm regs are a separate landlord duty). Conventional. |

---

## 🚩 Flags for the redesign

- **F-S1 — Only engineer identity + the Reg 26(9) results are hard requirements.** Validation should require: engineer name + Gas Safe number, appliance identity, and the Reg 26(9) safety outcomes (flueing / ventilation / pressure-heat-input / safe functioning). Everything else is optional / omit-if-empty — mirror the CP12 adaptive approach.
- **F-S2 — No "next service due" field.** Benchmark records leave a service-interval date with the householder; consider adding one (auto +12 months). Conventional, not required.
- **F-S3 — Commissioning vs service.** If this template is ever used to *commission* a new appliance, combustion readings become **mandatory** (Benchmark / Building Regs). Worth a mode flag; not required for a routine service.
- **F-S4 — Unsafe situation found during a service** → the [Gas Warning Notice](gas-warning-notice-field-analysis.md) procedure (GIUSP) applies; the service record itself does not carry those duties.

## Redesign guidance (next step — not done here)
1. Adopt the CP12 house style + adaptive "render-if-captured" (no statutory content list, so omitting unperformed sections is fine).
2. Enforce only: engineer name + Gas Safe number, appliance identity, Reg 26(9) outcomes.
3. Treat Benchmark tasks + combustion as conventional (render-if-done); add "next service due"; consider a commissioning mode (combustion mandatory).
4. Reuse the CP12 tiered `field-config` + shared validator/renderer primitives.

_Analysis only — sources current as of 2026-07-12._
