# CP12 Production Field Analysis and Refactor Record

**Date:** 2026-07-11
**Scope:** the production CP12 issue path, not legacy renderers.

## Correction to the original audit

The first audit examined `src/lib/pdf/cp12-template.ts`. That file had no callers and was not part of certificate issuance. It has been retired as part of this refactor.

The production renderer is `renderCp12CertificatePdf` in `src/server/pdf/renderCp12Certificate.ts`. It now delegates to the adaptive v2 renderer. The canonical final issue path is:

```text
CertificateWizard
  → generateCertificatePdf({ certificateType: 'cp12' })
  → generateCp12CertificateForJob
  → validateCp12ForIssue
  → renderCp12CertificatePdf
  → certificate storage, record, status, reminders and follow-up side effects
```

Before this refactor, `renderCp12CertificatePdf` filled the fixed AcroForm asset at `src/assets/templates/cp12-template.pdf`. A fixed AcroForm cannot remove its printed boxes or reflow the remaining layout, so the v2 output is fully programmatic and conditionally composes only the sections that have content.

## Verified current state

- The canonical issue path already has a server-side final-issue validator. It is not wizard-only.
- Validation is duplicated and inconsistent between the wizard checklist, the wizard validator, and the server validator.
- `reg_26_9_confirmed` is recorded and validated but is not represented in the production renderer field map.
- Defects, remedial work, and notes are collapsed into the current comment/defect surfaces.
- Before this refactor, the canonical issuer did not persist `certificates.template_version`, despite the column existing. The unused legacy action was the only path that wrote `cp12-template-v1`.
- Boiler service and gas warning notice PDFs use separate renderer modules and separate AcroForm assets. They do not share CP12 layout logic.

## Legal minimum content reference

The landlord gas-safety record must contain the matters in Gas Safety (Installation and Use) Regulations 1998, Regulation 36(3)(a)–(i): check date, premises address, landlord/agent name and address, appliance/flue description and location, defects, remedial action, Regulation 26(9) confirmation, engineer name and signature, and Gas Safe registration number.

The refactor distinguishes these tier-one issue blockers from conventional detail (for example readings, CO alarms, next inspection date, business contact fields and customer acknowledgement) and optional notes.

## Refactor implementation status

### Phase 1 — shared field policy

- ✅ `src/lib/cp12/field-config.ts` defines the tier, wizard behaviour and PDF behaviour for CP12 fields.
- ✅ `validateCp12TierOne()` is shared by the wizard and the canonical server issue path.

### Phase 2 — authoritative validation and missing data

- ✅ Landlord correspondence address remains an explicit field and cannot be inferred from the property address.
- ✅ Appliance-level Regulation 26(9) confirmation and optional flue location are captured and included in the v2 render model; migration `20260711110000_cp12_v2_appliance_compliance_fields.sql` adds their persistence columns.

### Phase 3 — programmatic adaptive v2 PDF

- ✅ New CP12 PDFs use `cp12-template-v2`, a programmatic adaptive renderer.
- ✅ It always states defects, remedial action and Regulation 26(9) confirmation, using “None identified” / “None required” when applicable.
- ✅ Conventional sections such as business details, CO-alarm results and tightness checks are omitted when absent instead of leaving blank fixed-layout boxes.
- ✅ The PDF footer includes a stable record reference; the canonical issue path persists and logs the renderer version.

### Phase 4 — wizard restructuring

- ✅ The wizard preserves address lookup, request-prefill paths and voice readings while adding the appliance-level declaration and flue-location capture needed by the tiered model.
- ✅ The issue checklist is now tier-aligned: only Tier-1 items block issue; Tier-2 (business details, appliance readings/checks) are non-blocking and omitted from the certificate when blank; defect + remedial action block only when an appliance is At Risk / Immediately Dangerous.
- ✅ Customer / received-by signature is optional across the wizard, `validateCp12ForIssue` and the `validateCp12TierOne` default; only the engineer signature is mandatory. Regression tests cover both.
- ✅ Tier-3 comments are collapsed by default.
- ✅ v2 PDF redesigned to the CertNow house style (monochrome + status badges), restoring the readings the from-scratch v2 had dropped (combustion, ventilation, flue condition/termination, spillage, servicing) as render-if-captured.
- ✅ Live DB migration applied 2026-07-11: `cp12_appliances.flue_location` (text) and `reg_26_9_confirmed` (boolean) now exist on project `qjxsudknqhtwhipwkfpq`.

## Recommendations (deferred — documented, not yet implemented)

### R-A — Company/engineer logo on the certificate

The engineer's uploaded logo (`profiles.logo_url`, set in Settings/onboarding). The v2 renderer already accepts `companyLogoBytes` and draws it in the header when present; the wrapper `renderCp12CertificatePdf` forwards it. The missing link is the **caller**: `src/server/certificates.ts` (and `generateCp12FromJob.ts` if revived) does not fetch the profile logo and pass `companyLogoBytes`.

**Recommended wiring:** in the CP12 issue path in `certificates.ts`, resolve `profile.logo_url` → download bytes (mirror the invoice renderer's logo handling / Supabase storage fetch) → pass `companyLogoBytes` into `renderCp12CertificatePdf`. Guard failures silently (a missing/oversized logo must never block issue). Low risk, no schema change. Recommend doing this as a small standalone change.

### R-B — Physical card reorder

The Phase-4 change tier-aligned the **gate logic** (what blocks issue), which is the high-value, low-risk part; the physical order of the wizard cards is unchanged (engineer → appliance details → appliance checks tabs → comments → signatures), and that order already reads reasonably.

**Recommendation: do not do a full DOM reorder now** — it is high-risk (3.4k-line component; touches Path A/C prefill, address lookup, voice readings anchors, the checklist `action()` `setStep` targets) for low incremental benefit now that the gate enforces tiers. If pursued later, prefer *labelling over moving*: mark the Tier-2 tabs/sections as “optional” inline (e.g. “Readings (optional)”) and, within the “Appliance checks” tabs, order the Tier-1 field (Reg 26(9) confirm) before the optional readings. Reserve any card-level DOM reordering for a dedicated PR with full click-through QA.

### R-C — Contextual remedial prompts

Today, a note box appears when a check fails / CO alarm = No. Record-level defect + remedial flow through `defects.defect_description` / `defects.remedial_action` (Tier-1, rendered on the PDF); per-appliance capture uses `defect_notes` / `actions_taken` / `actions_required`.

**Recommendation:** keep the mechanism, and make two things explicit: (1) route contextual failed-check notes into the **defect/remedial** fields (Tier-1, always rendered), never into the now-collapsed Tier-3 `comments`; (2) when an appliance is marked At Risk / Immediately Dangerous, require its defect + remedial fields (the checklist already blocks on this) and keep the existing automatic warning-notice follow-up job wiring. Suggest a short follow-up task to audit that every contextual prompt writes to a Tier-1 defect/remedial field rather than `comments`.

## Regression requirements

The refactor must preserve stored historic PDFs, existing draft compatibility, CP12 follow-up/reminder side effects, signatures, certificate links, public property downloads and completion/delivery flows. New coverage must prove server-side tier-one blocks, explicit landlord-address handling, adaptive omit/render behaviour, appliance overflow and template-version persistence.
