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

## Regression requirements

The refactor must preserve stored historic PDFs, existing draft compatibility, CP12 follow-up/reminder side effects, signatures, certificate links, public property downloads and completion/delivery flows. New coverage must prove server-side tier-one blocks, explicit landlord-address handling, adaptive omit/render behaviour, appliance overflow and template-version persistence.
