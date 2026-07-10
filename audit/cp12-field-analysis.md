# CP12 Template Field Analysis — Legal Minimum Content Audit

**Date:** 2026-07-10
**Scope:** Compares every field rendered by our CP12 (Landlord Gas Safety Record) PDF template against the legally mandated minimum content for a landlord's gas safety record.
**Change note:** Analysis only. No code was modified.

## What was audited

The audited template is the one actually rendered to the customer: the programmatic layout in **`src/lib/pdf/cp12-template.ts`** (`CP12_TEMPLATE_COORDS` + `renderCp12TemplatePdf` / `drawCp12StaticLayout`). Note that the static asset `src/assets/templates/cp12-template.pdf` is **not** loaded by the renderer — `renderCp12TemplatePdf` builds a fresh `PDFDocument` and draws the layout itself, so the code file is the source of truth for what appears on the issued record.

## Legal sources (authoritative)

| Ref | Source | Requirement |
|-----|--------|-------------|
| **S1** | Gas Safety (Installation and Use) Regulations 1998, **Regulation 36(3)(a)–(i)** — [legislation.gov.uk/uksi/1998/2451/regulation/36](https://www.legislation.gov.uk/uksi/1998/2451/regulation/36) | Statutory list of information the landlord's gas safety record **must** include |
| **S2** | Gas Safety (Installation and Use) Regulations 1998, **Regulation 26(9)(a)–(d)** — [legislation.gov.uk/uksi/1998/2451/regulation/26](https://www.legislation.gov.uk/uksi/1998/2451/regulation/26) | The safety-check matters that Reg 36(3)(g) requires the record to confirm were examined |
| **H** | HSE, *Gas safety records / Landlords* — [hse.gov.uk/gas/landlords/gassaferecord.htm](https://www.hse.gov.uk/gas/landlords/gassaferecord.htm) | HSE's plain-English statement of the same mandatory content, plus explicit statements of what is **not** required |

### Reg 36(3) — the mandatory record content (verbatim)

The record **must** include:

- **(a)** "the date on which the appliance or flue was checked"
- **(b)** "the address of the premises at which the appliance or flue is installed"
- **(c)** "the name and address of the landlord of the premises (or, where appropriate, his agent)"
- **(d)** "a description of and the location of each appliance or flue checked"
- **(e)** "any defect identified"
- **(f)** "any remedial action taken"
- **(g)** confirmation that the check included the matters referred to in **Reg 26(9)(a)–(d)** (HSE: *"confirmation that the safety check has included an examination of the matters referred to in paragraphs (a) to (d) of regulation 26(9)"*)
- **(h)** "the name and signature of the individual carrying out the check"
- **(i)** "the registration number with which that individual, or his employer, is registered" (i.e. Gas Safe registration number)

### Reg 26(9)(a)–(d) — the matters that (g) confirms (verbatim)

- **(a)** "the effectiveness of any flue"
- **(b)** "the supply of combustion air"
- **(c)** "its operating pressure or heat input or, where necessary, both"
- **(d)** "its operation so as to ensure its safe functioning"

### HSE — explicitly **not** legally required

- **Landlord / tenant signature:** *"You do not have to sign the record but your name and address or that of your letting agent must be included on the record."* (Source **H**) — only the **engineer's** name + signature is mandatory (Reg 36(3)(h)).
- **Next inspection date:** not listed by HSE or Reg 36(3) as mandatory content (Source **H**).
- **Recording numeric readings** (operating pressure value, heat input value, CO/CO₂): the statute mandates only **confirmation** that the 26(9) checks were carried out (Reg 36(3)(g)); the actual figures are industry convention, not statutory minimum.

## Classification legend

- **(1) Legally required minimum content** — mandated by Reg 36(3) / 26(9) or HSE guidance.
- **(2) Conventional** — not the statutory minimum, but standard on industry CP12 forms (CORGI/Gas Safe/LGSR layouts). Frequently supports/evidences a (1) item.
- **(3) Optional / removable** — neither mandated nor conventionally essential; administrative or product convenience.

---

## Field-by-field table

### Header / party fields (`CP12_TEMPLATE_COORDS.fields`)

| Template field | Class | Basis & citation |
|---|---|---|
| `property_address` | **(1)** | Reg 36(3)(b) "address of the premises at which the appliance or flue is installed" (**S1**, **H**) |
| `postcode` | **(1)** | Component of the premises address, Reg 36(3)(b) (**S1**) |
| `inspection_date` | **(1)** | Reg 36(3)(a) "the date on which the appliance or flue was checked" (**S1**, **H**) |
| `landlord_name` | **(1)** | Reg 36(3)(c) "the name … of the landlord (or … his agent)" (**S1**, **H**) |
| `landlord_address` (rendered as "Correspondence Address") | **(1)** | Reg 36(3)(c) "the … address of the landlord (or … his agent)" (**S1**, **H**). ⚠️ See risk R1 below re: fallback to property address |
| `engineer_name` | **(1)** | Reg 36(3)(h) "the name … of the individual carrying out the check" (**S1**, **H**) |
| `gas_safe_number` | **(1)** | Reg 36(3)(i) "the registration number with which that individual, or his employer, is registered" (**S1**, **H**) |
| `company_name` | **(2)** | Employer/business name. Reg 36(3)(i) allows registration to be the individual **or** employer; naming the registered business is conventional and supports (i), but the statute names the *number*, not the company name |
| `issued_at` (date issued) | **(2)** | Date of issue is conventional admin metadata; distinct from Reg 36(3)(a) check date (which is separately captured). Not statutory minimum |
| `record_id` | **(3)** | Internal reference/serial. No statutory basis; administrative convenience |
| `next_inspection_due` | **(2)** | **Not legally required** (**H** — HSE does not list it; Reg 36(3) omits it). Near-universal on industry CP12 forms as a service reminder |
| `warning_notice_issued` | **(2)** | Not a discrete Reg 36(3) item; evidences (e)/(f) where a defect led to a Warning/Danger notice under the Gas Industry Unsafe Situations Procedure. Standard on Gas Safe LGSR forms |

### Free-text blocks (`CP12_TEMPLATE_COORDS.textBlocks`)

| Template field | Class | Basis & citation |
|---|---|---|
| `defects` (`defect_description`) | **(1)** | Reg 36(3)(e) "any defect identified" (**S1**, **H**) |
| `remedial_action` | **(1)** | Reg 36(3)(f) "any remedial action taken" (**S1**, **H**) |
| `comments` | **(3)** | General notes. No statutory basis; optional. (Common on forms, but removable without affecting compliance) |

### Check boxes (`CP12_TEMPLATE_COORDS.checks`)

| Template field | Class | Basis & citation |
|---|---|---|
| `reg_26_9_confirmed` | **(1)** | Reg 36(3)(g) confirmation the check included Reg 26(9)(a)–(d) (**S1**, **S2**, **H**). This is the single field that satisfies the statutory (g) confirmation |
| `gas_tightness` | **(2)** | Gas installation tightness/soundness test. Good practice and standard on CP12 forms, but **not** part of the Reg 36 landlord record minimum (Reg 36 covers appliances & flues; a full installation tightness test is broader) |
| `co_alarm_fitted` | **(2)** | CO alarm presence stems from the *Smoke and Carbon Monoxide Alarm (England) Regulations 2015* (a separate landlord duty), **not** from Reg 36. Conventional on modern forms |
| `co_alarm_tested` | **(2)** | Same basis as `co_alarm_fitted`; conventional, not Reg 36 minimum |

### Signatures (`CP12_TEMPLATE_COORDS.signatures`)

| Template field | Class | Basis & citation |
|---|---|---|
| `engineer` signature | **(1)** | Reg 36(3)(h) "the name **and signature** of the individual carrying out the check" (**S1**) |
| `customer` / client signature | **(2)/(3)** | **Not required** — HSE: *"You do not have to sign the record"* (**H**). Conventional for acknowledgement; removable without affecting legal validity |

### Appliance table columns (`CP12_TEMPLATE_COORDS.table.columns`)

| Column | Class | Basis & citation |
|---|---|---|
| `index` | **(3)** | Row number / layout aid. No statutory basis |
| `location` | **(1)** | Reg 36(3)(d) "the … location of each appliance or flue checked" (**S1**, **H**) |
| `appliance_type` (description) | **(1)** | Reg 36(3)(d) "a description of … each appliance or flue checked" (**S1**, **H**) |
| `make_model` | **(2)** | Enriches the Reg 36(3)(d) description; make/model is the conventional way to describe an appliance but not the bare statutory minimum |
| `flue_type` | **(2)** | Supports the Reg 36(3)(d) description of the flue and evidences Reg 26(9)(a); conventional detail |
| `operating_pressure` | **(2)** | Records the result of the Reg 26(9)(c) check. Statute mandates only *confirmation* (36(3)(g)); recording the value is industry convention |
| `heat_input` | **(2)** | Result of Reg 26(9)(c). Conventional (see `operating_pressure`) |
| `flue_condition` | **(2)** | Result of Reg 26(9)(a) "effectiveness of any flue". Conventional; the mandated element is the (g) confirmation |
| `ventilation` | **(2)** | Result of Reg 26(9)(b) "supply of combustion air". Conventional; mandated element is the (g) confirmation |
| `combustion` (CO / CO₂ / ratio) | **(2)** | Combustion-performance result (Reg 26(9)(c) alternative). Conventional; not statutory minimum |
| `safety` (rating / classification code) | **(2)** | Safe / At Risk / Immediately Dangerous classification per the Gas Industry Unsafe Situations Procedure; evidences 36(3)(e) and 26(9)(d). Standard on all CP12 forms, not a named Reg 36(3) item |

---

## Coverage summary vs. Reg 36(3)(a)–(i)

| Statutory item | Covered by template field(s) | Status |
|---|---|---|
| (a) date checked | `inspection_date` | ✅ Present |
| (b) premises address | `property_address` + `postcode` | ✅ Present |
| (c) landlord/agent name & address | `landlord_name` + `landlord_address` | ✅ Present (⚠️ see R1) |
| (d) description & location of each appliance/flue | table `appliance_type` + `location` | ✅ Present (⚠️ see R3) |
| (e) any defect identified | `defects` block | ✅ Present |
| (f) any remedial action taken | `remedial_action` block | ✅ Present |
| (g) confirmation of Reg 26(9)(a)–(d) | `reg_26_9_confirmed` check | ✅ Present (⚠️ see R2) |
| (h) name & signature of engineer | `engineer_name` + `engineer` signature | ✅ Present |
| (i) Gas Safe registration number | `gas_safe_number` | ✅ Present |

**Headline finding: every one of the nine statutory record items in Reg 36(3)(a)–(i) has a corresponding field in the template. Nothing legally mandated is categorically absent.**

## ⚠️ Flags — compliance risks worth addressing (not hard gaps)

Although no required *field* is missing, the following weaken confidence that the *rendered* record will always satisfy the statute. These are data-population / granularity risks in `renderCp12TemplatePdf`, surfaced here for awareness (no code changed):

- **R1 — Landlord address can silently fall back to the property address.** `writeField('landlord_address', toText(fieldMap.landlord_address ?? fieldMap.address))` (`cp12-template.ts:380`). If `landlord_address` is unset, the "Correspondence Address" box is filled with the **property** address, which does not satisfy Reg 36(3)(c)'s requirement for the *landlord's/agent's* address (Source **S1**, **H**). The same pattern affects `landlord_name ?? customer_name` (line 379) and `company_name ?? customer_name` (line 383) — the mandated landlord identity could be populated with a different party.
- **R2 — The Reg 26(9) confirmation is a single global checkbox, not per-appliance.** Reg 36(3) applies "in respect of each appliance or flue" (Source **S1**). `reg_26_9_confirmed` is one flag for the whole record, whereas the table supports up to 6 appliances. Legally defensible if every listed appliance was in fact checked, but it does not evidence the confirmation *per appliance*.
- **R3 — Flue location is not separately captured.** Reg 36(3)(d) requires description **and location** of "each appliance **or flue**" (Source **S1**). The table has `flue_type` but no dedicated flue location column; flue location is implicit in the appliance `location`. Usually acceptable, but not explicit.

## Removable without compliance impact

Fields classified **(3)** — `record_id`, `comments`, table `index`, and the optional client/customer signature — can be removed or hidden without affecting legal validity of the record. `next_inspection_due` and the CO-alarm / gas-tightness checks are **(2)** conventional: safe to keep (expected by users and letting agents) but not legally mandated by Reg 36.
