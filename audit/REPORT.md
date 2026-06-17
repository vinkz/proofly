# CertNow Pre-Launch Audit Report

**Date:** 2026-06-07
**Environment:** Production — https://certnow.uk
**Account:** Fresh test engineer `certnow-engineer-test@mailinator.com` (engineer **Alex Jones**, **Jones Gas Services**, Manchester)
**Status:** ⏸️ **PAUSED FOR FIXES** after Parts 1–3 (a critical blocker prevents completing a CP12, which gates several later parts).
**Screenshots:** captured inline in the Claude Code session and referenced by step below. The Chrome tool could not write PNG files to disk, so `audit/NN-*.png` files do not exist; the images live in the session transcript.

---

## Summary

- **Parts run:** 1 (full), 2 (Path B only), 3 (full wizard walk).
- **Parts not run (paused):** 2 Paths A/C/D, 4 (GWN), 5 (Boiler), 6 (Delivery), 7 (Settings), 8 (Renewal), 9 (Landlord public pages), 10 (Billing), 11 (Email design audit).
- **Result:** Not launch-ready. One **critical blocker** stops the core action (issuing a CP12). Two more **critical** issues (broken address lookup, systemic invisible toggle buttons) and several high/medium issues found.

---

## Critical failures (must fix before launch)

### C1 — A CP12 certificate cannot be completed / issued
Step 4 ("Signatures & PDF") permanently lists **"Appliance #1: identity + readings complete — Add checks in Appliance checks"** as a required missing item, leaving the Complete CTA disabled.
Reproduced after filling everything: type Combi; Make Vaillant; Model "ecoTEC plus 832"; Location Kitchen; Serial 123456; operating pressure 20.6; heat input 24.2; high-fire CO 5 / CO₂ 9.2; low-fire CO 4 / CO₂ 8.8; all Safety + Property items Pass; safe-to-use Yes; classification Safe. All four Step-3 sub-tab dots green.
**Leading hypothesis:** the persistent **"Not synced — changes are saved on this device"** banner indicates wizard input stays in unsynced local state, while the Step-4 completion validator reads server-persisted state — so completion can never be satisfied. Confirm what the wizard validator / `getJobCompletionState` reads vs. where wizard edits are stored, and whether the sync ever fires.
**Impact:** blocks issuing CP12s → also blocks Part 4 (GWN), Part 6 (delivery), Part 8 (renewal), and Path A (needs a delivered job).

### C2 — Address lookup broken in production (Ideal Postcodes 402)
Typing any address returns **"Address lookup failed (402). Key balance depleted."** The Ideal Postcodes key has no balance, so autocomplete is non-functional site-wide.
- On **onboarding Step 2** the raw red error (with a developer doc URL) is shown to the user — unprofessional and confusing.
- On **`/jobs/new` Step 1** it degrades correctly to a neutral grey "Address lookup unavailable — enter manually".
**Fix:** top up / replace the Ideal Postcodes key; and make onboarding use the same neutral fallback as `/jobs/new`.

### C3 — Toggle buttons invisible until selected (systemic)
Across the entire CP12 wizard, pill toggles render with **no border/background in their unselected state**, so they're invisible against the white card. Affects: appliance-type chips (Combi/System/Regular/Other), Inspection Yes/No, Safety Pass/Fail, "Appliance safe to use", condition classification, Property Pass/Fail, CO-alarm toggles.
Selected states are correct (green #0a3d26/#5DCAA5, red #3d0a0a/#F09595, amber). The defect is purely the **default/unselected** styling. An engineer cannot see options they haven't chosen yet.
**Fix:** give unselected toggles a visible border/background token.

---

## High-priority issues

- **H1 — Welcome email not received.** After signup + onboarding the Mailinator inbox stayed empty well past 60s. Expected "Welcome to CertNow — your 14-day trial has started". Could not be diagnosed against other emails (paused). Verify Resend is configured in prod and that the welcome trigger fires.
- **H2 — ALL CAPS field labels** on `/jobs/new` Step 1 and throughout the CP12 wizard: NAME, COMPANY, ADDRESS LINE 1/2, CITY / TOWN, POSTCODE, TEL. NO., EMAIL, INSPECTION DATE, TENANT NAME, SITE TELEPHONE, MAKE, MODEL, LOCATION, SERIAL NUMBER, APPLIANCE 1 FLUE TYPE. Violates the "sentence case, no ALL CAPS" rule. The onboarding wizard is correctly sentence case, so these screens are inconsistent.
- **H3 — Misleading Readings completion indicator.** The Readings sub-tab shows a green "complete" dot when only the high-fire FGA group is filled; a separate low-fire group remains empty with no pointer. Contributes to the C1 confusion.

---

## Medium / Low issues

- **M1 — `/jobs/new` first-load crash (intermittent).** First direct navigation right after onboarding returned an **unstyled serif error page** ("Something went wrong"); console showed a Server Components render error; "Try again" didn't recover. Reaching it via the dashboard button worked, and later direct loads worked — looks like a transient cold-start RSC error. Two concerns: it hit a brand-new engineer's first attempt, and the error boundary is off-design-system (serif, no styling).
- **M2 — "Copy landlord details" overwrites Tenant name.** On the job-address step it set TENANT NAME = the landlord's name ("Sarah Green"), wiping the entered tenant ("Tom Green"). It correctly copies the address. Tenant ≠ landlord — data loss + semantic error.
- **L1 — "Speak in order…" hint repeated** under every Speak button (Speak pressure, Speak high, Speak low) instead of once at the top.
- **L2 — Near-invisible eyebrow labels** ("HIGH FIRE READINGS" / "LOW FIRE READINGS") render at very low contrast.
- **L3 — No visible unit labels** (mbar/kW) beside Operating pressure / Heat input.
- **L4 — Dashboard data formatting** (seen on the pre-existing "Craig" account): inbound-request card shows lowercase names ("kelvin hospodarz") and ISO dates ("2026-05-31") instead of title case / "31 May 2026".
- **L5 — Signup autofills a stale email** (`darzcommerce@gmail.com`) from a prior session, which could confuse a real new user.
- **L6 — "Not synced" banner** persists on a live online session and reads like an error/offline state to an engineer (and may be the surface of C1).

---

## Flows confirmed working

- **Signup page (Flow 1A):** trial copy, three benefit bullets, single "Already have an account?", sentence-case field labels.
- **Onboarding wizard (Flow 1B):** all 3 steps, sentence-case labels, progress bar, profession dropdown, 6/7-digit hints, "Progress saved" toasts, lands on dashboard with correctly title-cased greeting ("Alex"). (Welcome email aside — H1.)
- **New job screen:** job-type chips + 3 path cards with emoji icons.
- **Path B (Fill myself):** creates a prepared job and drops straight into CP12 Step 2 (`startStep=2`); neutral address fallback; working "Copy landlord details" for the address (but see M2).
- **CP12 wizard mechanics (where visible):** sub-tab footer navigation is correct (Next moves between sub-tabs on Step 3; only Property's green "Save & Continue" advances the wizard step); selected toggle colours (green/red/amber) are correct; classification guard logic (At Risk/ID auto-sets safe-to-use=No and reveals defect fields; Safe/NCS vs AR/ID conditional on safe-to-use) works; Step-4 validation card pattern (amber + green "Go" links, sentence-case "Draw signature", signature canvases) is correct.

---

## Recommended fixes before launch (prioritised)

**Priority 1 — Blocks launch**
1. C1 — Make CP12 completion possible (investigate Not-synced vs. server-read validation; ensure wizard edits persist before Step-4 validates).
2. C2 — Restore Ideal Postcodes key; use the neutral fallback everywhere (fix onboarding's raw red 402).
3. C3 — Make unselected toggle buttons visible.

**Priority 2 — Should fix before launch**
4. H1 — Confirm/repair welcome email (and verify Resend prod config overall).
5. H2 — Sentence-case all `/jobs/new` + wizard field labels.
6. H3 — Don't mark Readings complete until both FGA groups are filled; surface the low-fire group.
7. M2 — Fix "Copy landlord details" so it doesn't clobber Tenant name.
8. M1 — Style the error boundary; investigate the first-load RSC error.

**Priority 3 — Fix after launch**
9. L1–L6 — Hint duplication, eyebrow contrast, unit labels, dashboard name/date formatting, stale signup autofill, "Not synced" wording.

---

## RE-RUN AFTER FIXES (round 2) — 2026-06-07

Fresh CP12 job (jobId 8688d3d3…) on the Alex account.

**Confirmed FIXED ✅**
- ALL CAPS labels → sentence case everywhere checked (new-job screen, `/jobs/new` Step 1 + job address, CP12 Step 2 Make/Model/Location/Serial/Flue type).
- Invisible-unselected toggle buttons → FIXED (appliance chips, Yes/No, Pass/Fail, classification, CO alarms all show outlines unselected).
- Near-invisible readings eyebrow → FIXED ("High/Low combustion reading" now clearly legible).

**STILL BROKEN 🔴 C1 — CP12 cannot be saved/completed (root cause now pinned)**
- "Save & Continue" on Step 3 → red toast "Could not save CP12 checks — … Server Components render … digest …".
- Network: `POST https://certnow.uk/wizard/create/cp12?jobId=…&startStep=2` → **HTTP 500**. The CP12-checks save server action throws server-side; checks never persist ("Not synced" banner is the symptom), so Step 4 stays blocked and no certificate can be issued. Blocks Parts 4/6/8/Path A.
- ACTION: pull the digest for this 500 from server logs/Sentry on the CP12 save action. Round-1 fixes were cosmetic and didn't touch this path.

**Still present (minor):** "Speak in order…" hint repeats under each Speak button; "Not synced" banner throughout (symptom of the 500).

---

## Part 7 — Settings — PASS ✅ (round 2)
- Two-column layouts: Full name + DOB; Profession + Engineer name; Gas Safe reg + ID card; Town/city + Postcode; Sort code + Account number; New + Confirm password. Standard rates three-column (CP12/Boiler/Both). Per-section "Saved" badges.
- Formatting: sort code "20-02-02" (dashed), name title-cased "Alex Jones", DOB "15/03/1985", no ALL CAPS labels.
- Theme picker Light/Dark/System present. Saved signature card present (no signature yet).
- Plan & billing: "Free plan", "You've used 0 of 10 free certificates in June 2026", "View plans — from £8.99/month", "Cancel anytime. No commitment." (satisfies Part 10 billing-info checks; limit-reached gate untestable — no cert can be issued).
- Onboarding company data persisted here correctly (Jones Gas Services / 42 Victoria Road / Manchester / M1 2AB) — confirms onboarding save worked despite the 402.
- Minor: "Account name" invoice field shows the engineer email — looks like browser autofill, not an app value.

## Part 5 — Boiler service (round 2; jobId 62ea7a9b…)

**KEY: boiler save WORKS — the 500 is CP12-specific 🔎**
- Advancing Step 3 → Step 4 showed green "Saved checks" toast (no 500). So the CP12 checks-save 500 is specific to the CP12 save server action, not the wizard framework. Narrows the bug significantly.

**PASS ✅**
- Step 2 appliance-type chips visible; identity labels sentence case (Appliance type/Make/Model/Location/Serial number).
- Step 3 "High / Low combustion readings" accordion with live counter (0/6 → 3/6 as filled). "Safety checks" accordion counter (0/10 → 3/10). CO ppm / CO₂ % / Ratio labels correct.
- Safety checks Yes/No buttons visible; Yes → green.
- Step 4 "Next service due" formatted "7 June 2027" (not ISO) ✓. Amber validation card "… required items missing" with green "Go" links ✓.

**FINDING — Boiler wizard Step 1 still ALL CAPS (High, missed by the label fix)**
- The boiler wizard's own Step 1 "Job Address & Client" uses ALL CAPS labels: SERVICE DATE, TENANT NAME, ADDRESS LOOKUP / LINE 1, ADDRESS LINE 2. The sentence-case fix reached `/jobs/new` and CP12 but not this step.

**FINDING — Address fallback message RED in boiler wizard (Medium, inconsistent)**
- Boiler wizard Step 1 shows "Address lookup is temporarily unavailable" in RED, vs. the neutral grey "Address lookup unavailable — enter manually" on `/jobs/new`. Inconsistent treatment of the same condition.

## Part 5 boiler — COMPLETED end-to-end ✅
- "Generate Boiler Service" → status Issued; redirected to `/jobs/62ea7a9b…/complete`. Completion screen: REQUIRED "Boiler Service Record · Done" (PDF stored Jun 7 2026, Edit/Open), OPTIONAL "Invoice · Draft needed" (non-blocking), "Ready to send". Signatures (engineer+customer) drawn & saved. Confirms the whole wizard→issue→completion chain works for boiler. Use this job for Part 6/9 testing.

## 🔴→🟢 CP12 save 500 — ROOT CAUSE FOUND & FIXED (code, pending deploy)
- Failing call: `saveCp12Appliances` in `src/server/certificates.ts` inserts each appliance into `public.cp12_appliances`.
- Prod has a CHECK constraint `cp12_appliances_safety_classification_check`: `safety_classification IS NULL OR IN ('safe','ncs','ar','id')`. Verified on prod: `'' ` is NOT allowed; `null` is.
- The wizard/Zod default for `safety_classification` is `''` (also the reset value after a safe-to-use toggle, and the normalizer returns `''` for anything unrecognised). Inserting `''` violates the CHECK → PostgREST error → server action throws → `POST /wizard/create/cp12` 500 → "Could not save CP12 checks". Boiler service has no such column, which is why it always saved fine.
- All other appliance columns exist on prod (no schema drift); only the empty-string-vs-CHECK was the issue.
- FIX applied: in `saveCp12Appliances`, coerce `safety_classification: appliance.safety_classification ? … : null` before insert. ESLint clean. `generateCp12FromJob` only reads the table, so no duplicate.
- VERIFICATION PENDING: code change is local; certnow.uk runs the deployed build, so this must be committed/merged to main + deployed before the live CP12 save can be re-tested end-to-end.

## Part 6 — Delivery (boiler job) — PASS ✅ (round 2, 2026-06-08)
- /jobs/62ea7a9b…/deliver: heading "22 Oak Street, London"; "Certificates included: Boiler Service Record + Preview ✓"; Invoice "Not created — not included" (honest placeholder ✓); recipient toggle Landlord/Tenant/Both ✓; "Send by email" primary + "Share via WhatsApp" secondary ✓; permanent /j/ link shown pre-send.
- Sent to certnow-landlord-test@mailinator.com → "Sent" confirmation; on send the job was promoted to a property and the permanent link became /p/bd1c361ff6874a9aab86e60408bb0c0a (property vault) ✓.
- **Delivery email ARRIVED in Mailinator** (From "CertNow", Subject "Gas Safety Certificate — …", instantly). ⇒ **Resend works in production.** So the missing Part-1 welcome email is a welcome-specific gap, NOT a global email outage. Re-prioritise H1 accordingly.
- NOT verified: full delivery-email design (white header / PDF attachment / Reply-To engineer / "Sent on behalf of" / no-ISO / title-case) — opening the message in Mailinator was permission-denied twice this session. Needs a manual open or retry.

## Part 9 public links available
- /p/bd1c361ff6874a9aab86e60408bb0c0a (property vault) and /j/04f88ab151eb4efba4738549576f8848 (job page) for the boiler job — to be checked logged-out (incognito).

## Delivery email design — verified ✅ (Part 6 / Part 11)
- From `general@certnow.uk` (CertNow-controlled sender, per policy). Sending IP 54.240.3.15 (SES).
- Subject "Gas Safety Certificate — 22 Oak Street, London" (address in subject ✓).
- White header with "certnow" wordmark (not black ✓). Body: "Your gas safety certificate is ready / Alex Jones from Jones Gas Services has completed a gas safety inspection at 22 Oak Street, London" — names title-cased, no undefined/template vars.
- CTA "View and download certificate →" → https://certnow.uk/p/bd1c361ff6874a9aab86e60408bb0c0a (production /p/ vault, NOT localhost ✓). Footer link certnow.uk.
- NOT verifiable on public Mailinator: PDF attachment ("Public Mailinator does not allow attachments"); Reply-To header (Mailinator RAW renders "[object Object]"); "Sent on behalf of [Engineer]" footer line + full body date formatting (inner-iframe scroll). Use a real inbox/private Mailinator to confirm these three.

## Part 2 Path A — existing landlord/property — PASS (selection/prefill) ✅ (round 2)
- /jobs/new → Landlord safety check → Existing landlord: "Who is this for?" with Landlord + Property native dropdowns and "+ New landlord"/"+ New property" escapes.
- Selected Mike Brown → property list populated → selecting "Sam White - 22 Oak Street… · No due date" → "Continue to details" → Step 1 PREFILLED (Name "Mike Brown", Address line 1 "22 Oak Street"), sentence-case labels. Prefill works.
- FINDINGS:
  - Clients/properties are NATIVE DROPDOWNS, not a searchable list / cards. Audit expected searchable client list + property cards with next-service-due + red/amber/green compliance badge — instead due state is a TEXT suffix ("· No due date" / "· Legacy"), no colour badge.
  - Property labelled by TENANT name ("Sam White - 22 Oak Street…") not address/owner — same root as the /p/ vault titling bug.
  - DUPLICATE property entries for the same address (one "· No due date", one "· Legacy") — likely the delivery promotion created a property row alongside a legacy job_fields-derived one. Dedupe needed.
  - Flow routes through Step 1 (prefilled) then job-address sub-step before wizard Step 2 — not the "≤3 taps straight to Step 2" target (acceptable here since the saved property came from a boiler job, so no prior CP12 appliance identity to carry forward).

## Part 2 Path D — personal request link — PASS ✅ (round 2)
- Personal link = https://certnow.uk/request/cn-654321 (production, slug cn-<gasSafe>, NOT localhost ✓). Exposed via /jobs/new → Ask landlord.
- Public page (opened in a 2nd tab; note: session still engineer-authenticated): "Request a gas safety visit", "…Alex Jones will be in touch", "No account needed"; 3-step wizard; Step 1 shows engineer read-only (no "find your engineer" step) ✓. Sentence-case labels throughout.
- Submitted David Walsh / certnow-landlord-test@mailinator.com / 07700900123 / 8 Queen Street, Birmingham, B1 2JQ / Annual gas safety check / 15 Jun 2026.
- Success: "Request sent — confirmation email sent to you; engineer contact also emailed" + "Share on WhatsApp" / "Open request link" (WhatsApp share in success state ✓).
- Dashboard: "Inbound requests (1)" card "8 Queen Street, Birmingham, B1 2JQ" (full address ✓), David Walsh, "Tenant · Janet Walsh", "New job" tag, Schedule job / Dismiss.
- FINDINGS: preferred date on the card renders ISO "2026-06-15" (not "15 June 2026"); names show as typed (no title-case normalization — same root as the lowercase "kelvin hospodarz" card).
- FINDING (repeat of engineer-side bug): the public form's "Copy details" puts the form-filler's NAME into the Tenant name field (got "David WalshJanet Walsh"); and "Address lookup is temporarily unavailable" shows in RED here too.
- Engineer notification email — VERIFIED ✅: from general@certnow.uk; white "certnow" header; "New job request — David Walsh has submitted a job request and named you as their engineer" (title-cased); Property "8 Queen Street, Birmingham, B1 2JQ" (FULL address, not just postcode ✓); CTA "Open request in CertNow →" → https://certnow.uk/jobs/new?requestId=02148e2b-… (production, not localhost ✓).
- Landlord confirmation email (Path D) — sent, not opened this session.

## WELCOME EMAIL — root cause confirmed (was H1)
- The engineer inbox (certnow-engineer-test) received the Path-D engineer NOTIFICATION email but STILL has NO welcome email. Combined with delivery email working ⇒ Resend/SES works in prod for both engineer- and landlord-facing mail. The Part-1 welcome email is specifically NOT being sent/wired (check the signup/onboarding completion path for the missing welcome-email call). Downgrade from "Resend broken" to "welcome email not triggered".

## Part 9 — Public landlord pages (round 2; logged-in session caveat)
NOTE: this browser session is authenticated as the engineer, so "no-login redirect" and "engineer-UI hidden from landlord" can't be fully proven here — need an incognito window. Content/format/UUID checks done logged-in:
- /p/ vault: loads; CertNow + "Property vault"; Certificates "Boiler Service Record · Issued 7 Jun 2026" + Download; Engineer card (company/name/Gas Safe/phone); Service history; "Book next service" 4-field form. No internal UUIDs. PASS on content.
  - FINDING: property titled by TENANT name "Sam White" instead of the address/owner.
  - FINDING: compliance badge "No cert date" despite an issued boiler record.
- /j/ page: loads; titled by ADDRESS "22 Oak Street, London" (correct); "● Certificate current — Next inspection 7 Jun 2027"; engineer card; Download; Service history. No internal UUIDs. PASS on content.
  - FINDING (Medium): /p/ vs /j/ DISAGREE on status for the same job — /j/ "Certificate current (7 Jun 2027)" vs /p/ "No cert date".
  - "ENGINEER VIEW" card (Raise invoice / Open job) shows — expected while authenticated; MUST be re-checked in incognito to confirm it's hidden from landlords (Part 9B key check) — UNVERIFIED this session.
- Download buttons present on both; not clicked (file download needs user go-ahead).

## CP12 save-500 FIX — VERIFIED (2026-06-09, prod deploy e80dcfe)
Re-ran a full CP12 (jobId 43868c02-57e8-43ab-a1d6-bb7c68110af1, landlord Mike Brown / Sam White, 22 Oak Street): Step 2 appliance + Step 3 Inspection/Readings/Safety/Property all Pass, Appliance safe-to-use = Yes, classification = Safe. Clicked the Property-tab "Save & Continue" — the exact action that previously HTTP-500'd.
- RESULT: advanced to Step 4 "Signatures & PDF", green "Complete: Appliance #1: identity + readings complete" badge, NO "Could not save CP12 checks" toast.
- DB PROOF: `cp12_appliances` row d267852c persisted with `safety_classification='safe'` (the exact value that used to violate the CHECK and 500), all Pass values + readings. `jobs.data_collection_status='complete'`.
- The constraint-violation 500 is GONE. Fix confirmed at the DB level.

## 🔴 NEW LAUNCH BLOCKER (CRITICAL) — Issue button permanently stuck on "Sync first" — FIXED
After the checks save cleanly and the required Step-4 signature is drawn, the issue button stays disabled, labelled **"Sync first"**, and the CP12 can never be issued.

ROOT CAUSE (client-side, NOT the 503): `hasUnsyncedChanges` (from `useWizardDraft`) is a pure JSON-snapshot diff over `cp12DraftSyncState`. That object **included the four signature fields** (`engineerSignature/…Path`, `customerSignature/…Path`). The issue button is gated `disabled = … || hasUnsyncedChanges`.
- Reaching Step 4 via "Save & Continue" calls `markSynced()` → flag clears → button briefly reads "Preparing…" (proving the flag was false there).
- Drawing the REQUIRED engineer/customer signature on Step 4 mutates those state fields → snapshot differs → `hasUnsyncedChanges` flips back to true.
- The signature-save path only uploads to storage + sets local state; it NEVER calls a background-sync action + `markSynced()`. So nothing re-clears the flag → permanent deadlock.
- Signatures are not part of the background sync actions (`saveCp12JobInfo`/`saveJobFields`/`saveCp12Appliances` never send them — they upload to storage on draw and are written to the job at issue time via `generateCertificatePdf`), so including them in the dirty-detector was a pure false positive.

FIX (committed): removed the four signature fields from the sync-dirty snapshot in BOTH wizards that have a custom `*DraftSyncState`:
- `certificate-wizard.tsx` (CP12) `cp12DraftSyncState`
- `boiler-service-wizard.tsx` `boilerServiceDraftSyncState` (identical latent bug; its `markSynced` overrides spread the memo so they stay symmetric)
The earlier "HTTP 503 / Server-Action body limit" hypothesis was a RED HERRING — those 503s were sporadic Vercel cold-start blips; the real blocker is the snapshot deadlock above and is deterministic (reproduces on a clean reload too: a restored draft whose signature state can't be re-synced shows "Sync first" immediately).

VERIFY AFTER DEPLOY: fill a CP12 → Step 4 → draw both signatures → button must read "Send to landlord" (enabled), not "Sync first" → issue succeeds (`jobs.status`→issued, `engineer_signature_path` populated). Then GWN (Part 4) and Part-8 renewal unblock.

## ✅ "Sync first" deadlock fix — VERIFIED LIVE (commit 616b6c8, deploy 07760ef READY)
Re-tested CP12 job 43868c02 on the live deploy: reached Step 4, drew a fresh engineer + customer signature, and the issue button stayed **"Send to landlord" / "Issue CP12" (enabled)** — it did NOT revert to "Sync first". Ticking "Regulation 26(9) confirmed" flipped it to "Issue CP12". Checks-save POSTs now return 200. The snapshot deadlock is gone. (Confirmed root cause: signature fields were in the sync-dirty snapshot; drawing the required Step-4 signature re-dirtied it with no re-sync.)

## 🔴🔴 NEW CRITICAL LAUNCH BLOCKER — certificate public_id collides ACROSS USERS (multi-tenant)
Clicking **Issue CP12** fails with HTTP 500. Function logs (Vercel) showed a 500; Supabase Postgres logs give the exact cause:
`duplicate key value violates unique constraint "certificates_public_id_idx"`.

ROOT CAUSE: `buildCertificatePublicId(jobCode, type)` (src/server/id-chain.ts) returns `"{jobCode}-{TOKEN}-{seq}"`, e.g. `00000005-CP12-01`. `jobCode` is **per-user sequential** (every user starts at 00000001), but `certificates.public_id` has a **GLOBAL** unique index (`certificates_public_id_idx`). So the public_id is identical for user A's job #5 CP12 and user B's job #5 CP12.
- PROVEN: job `be82439e` (user e0091442, "John Smith", Jan 2026) already owns certificate `00000005-CP12-01`. My test job `43868c02` (user a9f06274, "Mike Brown", job_code also `00000005`) computes the SAME `00000005-CP12-01` → collision → 500. Two jobs, two different users, same job_code 00000005 (correct — job_code is per-user) but the cert index is global (wrong).
- `findCertificateRecord` looks up by (job_id, cert_type) so it finds nothing for this job → takes the INSERT path → global-index 23505. The CP12 path (`saveCertificateRecord`) has NO 23505 fallback (unlike the GWN path at certificates.ts:3455-3476).

IMPACT (severe): at launch, the 2nd+ user to issue any given (job-number, cert-type) combination CANNOT issue — they get a 500. Since every user's job numbering starts at 00000001, collisions begin almost immediately across the user base. Effectively issuance is broken for all but whichever user issued each (job#, type) first. Blocks Part 3 completion and every cert type that builds public_id this way (boiler/GWN/etc.).

RECOMMENDED FIX (needs a PROD SCHEMA MIGRATION → get explicit approval before applying):
1. Primary: make the uniqueness per-tenant — replace the global `certificates_public_id_idx` with a UNIQUE index on `(user_id, public_id)`. public_id is a per-user cert number by design (it embeds the per-user job code), so the global index is the defect. Backfill `certificates.user_id` from `jobs.user_id` first (the existing John Smith row has user_id NULL).
   - CAVEAT to check: confirm public_id is NOT used as a global lookup key (e.g. a public /verify/{public_id} URL). /p/ and /j/ use `public_token`, so public_id appears display-only — but verify before migrating.
2. Defense-in-depth (code): give the CP12/boiler/general-works insert paths the same 23505 fallback the GWN path already has, and/or bump `seq` on collision.

Until fixed, NO CP12 can be issued by a non-first user. The deadlock fix above is necessary but not sufficient — issuance is still blocked by this.

## ✅ QUICK CODE WINS — implemented 2026-06-10 (uncommitted; tsc + eslint clean)
Batch of low-risk launch-relevant fixes from the findings list:
1. **H2 — Boiler wizard ALL CAPS labels → sentence case.** Removed the `uppercase` class from all 14 field labels in `boiler-service-wizard.tsx` (matches the already-fixed CP12/`/jobs/new` style; text was already sentence-case). The dark-panel "FGA readings" eyebrow is intentionally left.
2. **Address fallback no longer alarming red.** Added a `formatAddressError` normaliser + switched the message colour from `--color-red` to `--color-text-tertiary` in BOTH the boiler wizard (job + customer address) and the public `request-job-client.tsx` form — now shows the neutral "Address lookup unavailable — enter manually" like `/jobs/new`, instead of the raw Ideal Postcodes 402 in red.
3. **M2 — "Copy details" no longer clobbers Tenant name.** Removed `setTenantName(landlordName)` from `copyLandlordDetailsToProperty` in the public form (it now copies only the address + phone). The engineer CP12 wizard no longer has a landlord-copy button, and the boiler `copyJobAddressToCustomerAddress` only copies address fields — both clean.
4. **Dashboard inbound-request card formatting.** `dashboard/page.tsx`: landlord/tenant names now run through `toTitleCase` (fixes "kelvin hospodarz" → "Kelvin Hospodarz"); a lone ISO `preferredDates` (e.g. `2026-06-15`) renders as "15 June 2026" via new `formatPreferredDates` (ranges / "Flexible" pass through).
5. **L1 / L3 — already resolved in current code (no change needed).** The "Speak in order…" hint now appears once per readings group (not under each button); Operating pressure / Heat input use `UnitNumberInput` with `unit="mbar"` / `unit="kW"`.

STILL OPEN from the findings list (need tracing/decisions, not quick wins): property titled by tenant name (#4), `/p/` vs `/j/` status disagreement + "No cert date" badge (#5), duplicate property rows per address (#6), welcome email not wired (H1/#9), `/jobs/new` first-load RSC crash + error-boundary styling (M1/#10), Ideal Postcodes key top-up (ops, C2/#11). Untested parts: 4 (GWN), 8 (renewal — needs approval), 9B (incognito), 10 (limit gate), 11 (PDF attach/Reply-To via real inbox).

## HANDOVER
See `audit/HANDOVER.md` for live state, the issued boiler job to drive Parts 6/9, the CP12 500 repro, and ordered next steps.

## Not yet audited (resume after fixes)
Part 2 Paths A/C/D · Part 4 GWN · Part 5 Boiler service · Part 6 Delivery/PDF · Part 7 Settings · Part 8 Renewal reminder · Part 9 Landlord public pages (/p/, /j/, /prefill) · Part 10 Stripe free-tier gate · Part 11 full email design audit.
