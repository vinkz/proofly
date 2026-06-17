# CertNow pre-launch audit — HANDOVER

Continue the audit in `audit/AUDIT.md` (the original checklist). Findings log is `audit/REPORT.md` — keep appending there. This file is the live state + next steps.

## Environment / session
- Target: **production https://certnow.uk** (user's explicit choice).
- Logged in as test engineer **Alex Jones** / `certnow-engineer-test@mailinator.com` (pwd `TestEngineer123!`). The HUMAN must do any login/signup — the agent must not enter credentials or create accounts.
- Side-effect policy: forms + emails to **Mailinator** test inboxes are PRE-APPROVED. **STOP and ask the user before Part 8's production DB UPDATE + cron trigger.**
- Browser: Claude-in-Chrome MCP. Main app tab is the certnow.uk tab; a Mailinator tab is open at `https://www.mailinator.com/v4/public/inboxes.jsp?to=certnow-engineer-test`. There are also unrelated LinkedIn tabs — ignore them.
- Screenshots: the Chrome tool's `save_to_disk` does NOT write retrievable files. Screenshots are inline only; reference them by step in REPORT.md. Do not promise `audit/NN-*.png` files.

## Test data created
- CP12 job (BLOCKED, see below): jobId `a561c327-...` and a second `8688d3d3-c403-42f5-bfe8-6735ecacd067`. Landlord Sarah Green, tenant Tom Green, 15 Park Lane, London, E1 4RT, landlord email `certnow-landlord-test@mailinator.com`.
- **Boiler service job (ISSUED, usable): jobId `62ea7a9b-4c6d-463b-b279-ad15a5ed8a42`** — "Boiler Service for Mike Brown", 22 Oak Street, London. Tenant Sam White. Now at `/jobs/62ea7a9b-4c6d-463b-b279-ad15a5ed8a42/complete`, status Issued, "Ready to send".

## CRITICAL BLOCKER (still open) — CP12 cannot be issued
- Saving CP12 Step-3 appliance checks → red toast "Could not save CP12 checks"; network `POST https://certnow.uk/wizard/create/cp12?jobId=...&startStep=2` returns **HTTP 500** (RSC render error; digest omitted client-side). Checks never persist → Step 4 keeps "Appliance #1: identity + readings complete" missing → no CP12 can be issued.
- **The boiler-service save works fine ("Saved checks" toast)** → the 500 is SPECIFIC to the CP12 checks save server action. Look in server logs/Sentry for that digest.
- This blocks Part 4 (GWN), Part 6 via CP12, Part 2 Path A, and the Part-8 renewal that expects a delivered CP12 property.

## Fixed since round 1 (verified)
ALL-CAPS labels → sentence case on /jobs/new + CP12 wizard (NOT the boiler wizard Step 1 — still ALL CAPS). Invisible-unselected toggle buttons → fixed everywhere. Readings eyebrow contrast → fixed.

## Still-open findings (see REPORT.md for full list)
- Ideal Postcodes 402 "key balance depleted" — address lookup dead in prod; onboarding shows the RAW RED 402 (jobs/new shows neutral grey; boiler wizard shows it in RED — inconsistent).
- Welcome email never arrived in Mailinator (Resend prod config unverified — the delivery email in Part 6 will confirm whether Resend works at all).
- Boiler wizard Step 1 labels ALL CAPS (SERVICE DATE / TENANT NAME / ADDRESS LOOKUP / LINE 1).
- "Copy landlord details" overwrites Tenant name with landlord name.
- Dashboard inbound-request card: lowercase names + ISO date (2026-05-31).
- Signature canvas clears after save with no persistent "saved" thumbnail (minor confusion).

## DONE
Part 1 (signup+onboarding), Part 2 Path B, Part 3 (CP12 walk → blocker), Part 5 (boiler, ISSUED), Part 7 (Settings — clean PASS), Part 10 billing-info (0 of 10, £8.99/mo).

## NEXT STEPS (recommended order, using the issued boiler job to bypass the CP12 blocker)
1. **Part 6 — Delivery**: from `/jobs/62ea7a9b.../complete`, click "Send to landlord/Ready to send" → deliver screen. Set recipient email to `certnow-landlord-test@mailinator.com`, send. Verify: delivery screen layout, status→Delivered, then CHECK MAILINATOR `certnow-landlord-test` for the delivery email (subject has property address, PDF attached, /j/ or /p/ link, Reply-To = engineer, white header, no ISO dates, title-cased names). **This also answers whether Resend works in prod.**
2. **Part 9 — Landlord public pages** (incognito tab, no login): open the `/j/[token]` link from the email and the `/p/[token]` vault. Check no-login access, downloadable cert, no internal UUIDs, no engineer-only UI, correct date formatting.
3. **Part 2 Paths C/D** (Ask landlord / personal request link): tests the prefill + request emails (more Resend coverage). Personal link should be `certnow.uk/request/cn-...` not localhost.
4. **Part 8 — Renewal**: REQUIRES the Part-8 production DB UPDATE + `/api/cron/reminders` trigger — **STOP and get explicit user approval first.** (Originally keyed to a CP12 property; may need to point at the boiler/property row instead.)
5. **Part 4 / Part 2 Path A / full Part 3** — BLOCKED until the CP12 save-500 is fixed. Re-run CP12 after the fix.
6. **Part 11** — compile the email design audit from whatever emails actually arrived.

## How to drive the browser (Claude-in-Chrome)
Use `browser_batch` with `computer` actions. `read_page filter:interactive` to get refs for toggle buttons (they go stale after re-render — re-read). Native comboboxes ("Select or type") are finicky: type then click a DIFFERENT field to commit; do NOT press Escape (it clears). datetime-local: type day/month/year segments then ArrowRight before the time, or the year field eats extra digits.
