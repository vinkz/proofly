# CertNow — UI/UX design-improvement brief (for Fable)

You are a senior product designer auditing **CertNow**, a production web app (certnow.uk) used by
self-employed UK gas engineers to issue legally-required gas safety certificates (CP12 / Landlord
Gas Safety Record), boiler service records, gas warning notices, and general-works records — then
deliver them to landlords/tenants and chase annual renewals.

## Who uses it, and where
- **Primary user:** a solo gas engineer, on a **phone**, **on site**, often **one-handed**, sometimes
  with **gloves**, frequently on **poor signal** (the app is an offline-first PWA — work is saved to
  the device and synced later). Speed and "can I tap this without thinking" matter more than polish.
- **Secondary users (read-only, on their own phones):** landlords and tenants who receive a public
  link to view/download a certificate (`/p/` property vault, `/j/` job page) and a public
  "request a visit" form. These people are non-technical and must never see app/engineer chrome.

## What the product does (the spine)
1. **Onboarding** (3 steps): identity → profession/trade + Gas Safe reg → company details. Sets up
   a personal "request a visit" link and a 14-day trial.
2. **New job** → choose certificate type → choose a path: fill it myself / ask the landlord to fill
   details / pick an existing landlord+property.
3. **The wizard** (the heart of the app): a multi-step certificate form. CP12 is the richest:
   - Step 1: job address & client
   - Step 2: appliance identity (type/make/model/location/serial)
   - Step 3: inspection + combustion readings (high/low fire FGA) + safety checks + property checks,
     with a safety-classification engine (Safe / NCS / At-Risk / Immediately-Dangerous) that gates
     "safe to use" and reveals defect fields
   - Step 4: signatures (engineer + customer, drawn on canvas) → issue → PDF
4. **PDF generation** at issue time (server renders the official certificate PDF).
5. **Delivery**: email and/or WhatsApp to landlord/tenant/both; issues a permanent public link.
6. **Renewals**: ~4 weeks before a certificate expires, the engineer is reminded to send the
   landlord a renewal request.

## Design system already in place (respect it — refine, don't reinvent)
- Tokenised colours in `src/app/globals.css`. Primary/action green `--color-action #1a7a52`; dark CTA
  `--color-cta #111`; semantic amber/red/blue with `-bg` variants; text primary/secondary/tertiary
  (`#111 / #555 / #8a8a8a`); border primary/secondary/tertiary. Full **dark mode** + `[data-theme]`.
- A "design-system" token set coexists with a **legacy** token set ("kept for non-overhauled pages")
  — visual inconsistency between overhauled and legacy screens is a known debt.
- Rounded cards, generous radius (`--radius: 0.875rem`), soft elevated shadows.
- **House rules:** sentence case everywhere (no ALL CAPS labels); the CertNow logo SVG + wordmark
  font are FROZEN — do not restyle the logo or propose new logo typography.

## Known pain points to weigh in your audit (from live QA on production)
- **Wizard state legibility:** an offline "Not synced — saved on this device" banner reads like an
  error to engineers even when everything is fine. Sync/issue affordances have been a recurring
  source of "why is this button disabled" confusion.
- **Toggle/pill controls** had an invisible unselected state (fixed) — re-examine whether
  selected/unselected/disabled states are now unambiguous at a glance, on a sunny phone screen.
- **Completion validation** (Step 4 "what's still missing") uses an amber checklist with "Go" links.
  Is it scannable? Does it tell the engineer the fastest path to done?
- **Multi-group readings** (high-fire vs low-fire FGA) — a completion dot once turned green with only
  one group filled. Progress indicators across accordions/sub-tabs need to be trustworthy.
- **Degraded-state copy:** address autocomplete can be unavailable (3rd-party balance) — the neutral
  "enter manually" fallback should feel intentional, not broken.
- **Public landlord pages** (`/p/`, `/j/`): a property is sometimes titled by the tenant's name and a
  compliance badge can disagree with the job page. Landlord-facing trust/clarity is the goal here.
- **Legacy vs overhauled** screens differ visually; flag the worst offenders.

## What we want from you
For each major surface — **onboarding, new-job/path selection, the CP12 wizard (all 4 steps),
delivery, the public `/p/` & `/j/` pages, dashboard, settings** — deliver:
1. A **heuristic critique** prioritised by impact for the on-site, one-handed, low-signal engineer
   (and separately for the non-technical landlord on the public pages).
2. **Specific, buildable recommendations** referencing the existing tokens/components, not a redesign
   from scratch. Concrete before/after where it helps.
3. A **mobile-first interaction pass**: tap-target sizing, thumb reach, step/sub-tab navigation,
   how progress + "what's left" is communicated, and how offline/sync state should read.
4. A **states & feedback pass**: empty, loading, error, offline, success, disabled — especially for
   the wizard's save/sync/issue buttons and the completion checklist.
5. **Accessibility:** contrast (several low-contrast eyebrow labels were flagged), focus order,
   hit areas, and form semantics for one-handed phone use.
6. A **prioritised punch-list** (P1 blocks trust/usability at launch → P3 polish), each item small
   enough to implement independently.

Constraints: stay within the existing green/dark-CTA token system and sentence-case rule; do not
touch the logo; favour incremental, shippable changes over a ground-up restyle.
