# CertNow UX screenshots — index

Captured live on production (certnow.uk) on 2026-06-11, engineer account **Alex Jones /
Jones Gas Services** (test). The Chrome tool in this environment renders screenshots **inline in
the Claude Code session** but cannot persist PNG/JPEG files to disk, so the image binaries are in
the session transcript, not in this folder. This index records what was captured, the exact URL,
and the UX-relevant notes for each — pair it with `../FABLE-UX-BRIEF.md` when briefing Fable.

Viewport note: captures render at ~1257px wide. The **dashboard and settings** show the **mobile
single-column layout with a bottom tab bar** (Dashboard/Properties/Clients/Jobs/Invoices); the
**new-job and wizard** screens show the **desktop left-sidebar layout**. That the primary nav
pattern differs by route is itself worth Fable's attention.

| # | Surface | URL | Theme | Key UX notes |
|---|---------|-----|-------|--------------|
| 01 | Dashboard | `/dashboard` | light | Mobile bottom-nav. "Welcome back / Alex", inbound-request card (David Walsh, 15 June 2026 — date now formatted), "Create first certificate" setup checklist. Eyebrow labels ("WELCOME BACK", "GET STARTED WITH CERTNOW") are uppercase. |
| 02 | New job / path select | `/jobs/new` | light | Desktop sidebar. Job-type segmented control (Landlord safety check / Service / Safety check + service) + three path cards (Fill myself / Ask landlord / Existing landlord). |
| 03 | CP12 wizard — Step 2 (appliance identity) | `/wizard/create/cp12?jobId=43868c02…&startStep=2` | light | Appliance-type chips (Combi selected green, others outlined — C3 fix holding). Sentence-case labels (Make/Model/Location/Serial). "Not synced — saved on this device" amber banner present. |
| 04 | CP12 wizard — Step 3 (appliance checks) | (Back from Step 4) | light | Sub-tabs Inspection/Readings/Safety/Property all green-dotted. Yes/No toggle pills now show clear outlines unselected, green when selected. |
| 05 | CP12 wizard — Step 4 (signatures & PDF) | (resume) | light | **Most important surface.** Amber "Not synced" banner; green "All required items complete"; "Regulation 26(9) confirmed" checked; signature canvas. **Primary CTA reads "Sync first" and is gated even though all required items are complete** — see finding below. |
| 06 | Settings | `/settings` | dark | Two-column profile (Full name/DOB, Profession/Engineer name, Gas Safe/ID card) with per-section "Saved" badges. Rendered in dark theme. Engineer-name field empty (placeholder "As on certificates"). |
| 07 | Property vault (landlord-facing) | `/p/bd1c361ff6874a9aab86e60408bb0c0a` | light | Titled **"Sam White"** (tenant name, not address/owner). **"No cert date" badge** despite an issued Boiler Service Record below + CP12 + boiler in service history. Engineer card, "Book next service" form. |
| 08 | Job page (landlord-facing) | `/j/04f88ab151eb4efba4738549576f8848` | light | Titled by **address** "22 Oak Street, London" (correct). Green **"Certificate current — Next inspection 7 Jun 2027"** (disagrees with /p/ "No cert date"). **"ENGINEER VIEW" (Raise invoice/Open job) card visible** — showing because the session is authenticated; needs incognito check to confirm it's hidden from landlords. |
| 09 | Public request form | `/request/cn-654321` | light | "Request a gas safety visit — …Alex Jones will be in touch. No account needed." 3-step wizard, Step 1 shows engineer read-only. Sentence case throughout. |

## Live findings observed during this capture pass
- **"Sync first" reproduces on a restored/resumed CP12 draft (screen 05).** Loading the
  already-issued test job `43868c02` in a fresh browser session lands on Step 4 with "All required
  items complete" green and Reg 26(9) ticked, yet the issue CTA is gated and labelled "Sync first".
  The earlier deadlock fix removed signature fields from the dirty-snapshot, but a restored draft
  still surfaces this state — `hasUnsyncedChanges` is true on load and nothing re-syncs it. Worth
  confirming whether a real engineer resuming a draft (or reopening after losing signal) can hit a
  dead end, vs. this being an artifact of reopening an already-issued job. Either way it's the exact
  confusing state Fable should redesign (the "Not synced" banner + "Sync first" CTA wording/logic).
- **/p/ vs /j/ status still disagree** (screens 07/08) and **/p/ still titled by tenant name** —
  both previously logged, confirmed still live.
