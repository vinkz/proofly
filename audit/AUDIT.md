# Claude Code + Chrome — Complete pre-launch flow audit
# Goal: verify every user flow works end to end before first real engineer.
# Combines functional testing, email verification, and UX feedback.

---

## Setup before starting

Read these files first:
- AGENTS.md (full product context)
- src/lib/resend.ts (email sending utility)
- src/app/(auth)/ (auth pages)
- src/app/(app)/dashboard/ (dashboard)
- src/app/(app)/wizard/ (CP12 and boiler service wizards)

Have these ready:
- certnow.uk open and accessible
- A fresh test engineer account (or ability to create one)
- Mailpit running locally (mailpit &) OR use a real inbox you can check
- Two test email addresses:
  Engineer: certnow-engineer-test@mailinator.com
  Landlord: certnow-landlord-test@mailinator.com (Mailinator — public, no account)

Open three tabs before starting:
- Tab 1: certnow.uk (engineer)
- Tab 2: mailinator.com (landlord inbox)
- Tab 3: certnow.uk in incognito (landlord/public view)

---

## PART 1 — ENGINEER ONBOARDING

### Flow 1A — Signup and welcome email
Navigate to certnow.uk/signup. Check:
- "14-day free trial · No card required · Cancel anytime" visible
- Three benefit bullets visible above Google button
- "Already have an account?" appears ONCE only
- No ALL CAPS field labels (should be "Email" not "EMAIL")
- Screenshot: audit/01-signup.png

Create account certnow-engineer-test@mailinator.com / TestEngineer123!
After creation — check Mailinator for certnow-engineer-test:
- Welcome email within 60s; Subject "Welcome to CertNow — your 14-day trial has started"
- Engineer first name in body (not "undefined"/"there")
- Trial end date formatted "14 June 2026" not "2026-06-14"
- "Go to dashboard →" CTA works; white header; no raw error/template vars
- Screenshot: audit/02-welcome-email.png

### Flow 1B — Onboarding wizard
Step 1 — About you: "Full name"/"Date of birth" labels (not caps); Profession dropdown; progress bar; "Save for later" works. Screenshot 03.
  Fill: Alex Jones / 15/03/1985 / Gas Engineer → Save and continue
Step 2 — Your business: "Company name"/"Address line 1"/"Town / city" labels (not caps). Screenshot 04.
  Fill: Jones Gas Services / 42 Victoria Road / Manchester / M1 2AB / 07800123456
Step 3 — Engineer details: "Gas Safe registration number"/"Engineer ID card number" labels; 6-digit/7-digit validation. Screenshot 05.
  Fill: Gas Safe 654321 / ID card 7654321 → Finish setup
After onboarding: lands on dashboard; "Welcome back, Alex" (title-cased, not lowercase); no localhost URLs; personal request link shows certnow.uk not localhost; onboarding checklist card. Screenshot 06.

---

## PART 2 — THREE JOB CREATION PATHS

### Flow 2A — Path A (existing client, existing property)
Requires a prior delivered job; if none, do 2B first and return.
"+ New job" → cert type chips (Landlord safety check, Service, Both); emoji icons. Screenshot 07.
"Landlord safety check" → "Existing landlord": client search; existing client; saved properties; selecting property pre-fills Step 1; proceed to Step 2 without editing; ≤3 taps to Step 2. Screenshots 08, 09.
UX: client list searchable? property cards show next service due? compliance badge per property? "Ask landlord" escape hatch?

### Flow 2B — Path B (engineer fills manually)
"+ New job" → "Landlord safety check" → "Fill details myself":
Step 1: labels sentence case; address lookup works or NEUTRAL message (not red "Address lookup failed (402)"); "Copy landlord details" shortcut on job address; inspection date accepts input; Save and continue → Step 2. Screenshot 10.
  Fill: Landlord Sarah Green / 07900234567 / certnow-landlord-test@mailinator.com / 15 Park Lane, London, E1 4RT / Tenant Tom Green / inspection date today
Job shows "prepared" on dashboard. Screenshot 11.

### Flow 2C — Path C (ask landlord to fill details)
"+ New job" → "Landlord safety check" → "Ask landlord":
- System sends email automatically; status → "awaiting landlord"; "Fill in myself" escape hatch. Screenshot 12.
Check Mailinator certnow-landlord-test:
- Prefill request email <60s; Subject "[Engineer name] needs your property details"; prefill link https://certnow.uk/prefill/...; white header; Reply-To engineer. Screenshot 13.
Click prefill link (incognito): opens without login; correct form; fill+submit; success. Screenshots 14, 15.
Back on dashboard: "Landlord details submitted" notification email; status awaiting → prepared; "Start" CTA. Screenshot 16.

### Flow 2D — Path D (landlord initiates via personal link)
Copy personal request link (certnow.uk/request/cn-XXXXXX). Open incognito:
- opens (not 404/localhost); shows engineer name "Alex Jones"; doesn't ask landlord to find engineer; 3-step wizard. Screenshot 17.
  Fill: David Walsh / 07700900123 / certnow-landlord-test@mailinator.com / 8 Queen Street, Birmingham, B1 2JQ / Annual gas safety check / next week
Submit → success. Screenshot 18.
Dashboard: new request in "Inbound requests"; "Schedule job" CTA; shows landlord/property/work type; tap → /jobs/new prepopulated. Screenshot 19.
Mailinator engineer notification: "New job request from David Walsh"; full property address; name title-cased; no ISO dates; CTA to certnow.uk. Screenshot 20.
Mailinator landlord confirmation: "Your gas safety request has been submitted"; engineer name in body; Reply-To engineer. Screenshot 21.

---

## PART 3 — CP12 WIZARD FLOW
Start from a "prepared" job; tap "Start".
Step 1: labels sentence case; no ALL CAPS. Screenshot 22.
Step 2 — Appliance details: "Appliance type" label; Combi/System/Regular/Other chips visible; selecting shows GREEN selected (#0a3d26 bg, #5DCAA5 text) not just white; Make/Location dropdowns; "+ Appliance". Screenshots 23 (unselected), 24 (Combi selected).
  Fill: Combi, Vaillant, Kitchen, Serial 123456 → Next
Step 3 — sub-tabs Inspection/Readings/Safety/Property:
- Inspection: "Landlord's appliance"/"Appliance inspected" labels; Yes/No tappable; Yes→GREEN, No→RED (#3d0a0a/#F09595); "Next →" advances to Readings tab NOT Step 4. Screenshots 25, 26.
- Readings: hint "Speak readings in order..." ONCE at top, not under every Speak button; "Operating pressure" label; units (mbar, kW) BESIDE inputs; CO ppm / CO₂ % labels (not "CO PPM"/"HIGH CO2"); "Speak high" on same line as eyebrow. Screenshot 27. Fill CO ppm 5, CO₂ 9.2.
- Safety: "Safety devices correct operation"/"Ventilation satisfactory" labels; Pass/Fail pairs; Pass→GREEN Fail→RED; "Appliance safe to use" Yes/No; classification Safe/NCS/At risk/ID; At risk→AMBER (#3d2a00/#EF9F27); "Next →" → Property. Screenshot 28.
- Property (last): "Emergency control accessible"; "CO alarm fitted"/"CO alarm tested"; footer "Save & Continue →" GREEN (#1a7a52) not dark "Next →"; only tab whose footer advances the step. Screenshot 29.
Step 4 — Summary & signatures: "Summary & recommendations"; service summary; customer + engineer signature canvases; saved signature pre-fills; "Draw signature" label; "Complete" green CTA. Screenshot 30.
Completion screen: redirects to /jobs/[id]/complete (NOT PDF viewer); REQUIRED section CP12 row green tick + "Done"; OPTIONAL Invoice "Draft needed" amber (non-blocking); "Ready to send" + "Send to landlord →". Screenshot 31.

---

## PART 4 — GAS WARNING NOTICE FLOW
Create a CP12 job with an unsafe appliance: Step 3 Safety → "Appliance safe to use" NO; classification "ID".
Completion screen: GWN row under REQUIRED ("Gas Warning Notice — Required"); blocks Send CTA; "Issue warning notice" button. Screenshot 32.
"Issue warning notice": GWN wizard; appliance/property/landlord pre-filled. Screenshot 33.
Issue GWN: redirects back to /jobs/[id]/complete; GWN row "Done"; Send active; follow-up job on dashboard. Screenshot 34.
Dashboard follow-up: new draft job; linked to same client/property; defect description pre-filled. Screenshot 35.
Original job: GWN in documents; marked final/immutable; no edit button. Screenshot 36.

---

## PART 5 — BOILER SERVICE FLOW
New job → "Boiler service".
Step 1: sentence case labels.
Step 2 accordions: "High / Low combustion readings" accordion; counter "0/6"; "Safety Checks" "0/10"; counters update. Screenshots 37 (collapsed), 38 (FGA). FGA: "CO ppm"/"CO₂ %" labels (not caps); Speak buttons on same line; units outside inputs. Safety Checks: Yes/No (not caps); Yes→GREEN No→RED. Screenshot 39.
Step 3 date format: "Next service due" shows "21 May 2027" not ISO.
Step 4: "Complete: Service summary" green CTA; validation card amber (not brown); "N required items missing" amber (#EF9F27); each missing item "Go" link green. Screenshot 40.
Completion: Boiler service record row green tick + "Done". Screenshot 41.

---

## PART 6 — DELIVERY AND PDF SENDING
From completion screen → "Send to landlord →".
Delivery screen: PDF preview (collapsed); recipient toggle Landlord/Tenant/Both; Invoice "Draft — not included yet" (honest); Email primary; WhatsApp deep link secondary; single dark full-width Send. Screenshot 42.
Set landlord email certnow-landlord-test@mailinator.com → Send.
After: status "Delivered"; success shown. Screenshot 43.
Mailinator (landlord): delivery email <60s; Subject "Gas Safety Certificate — [address]"; address in subject; PDF attached; /j/ link; Reply-To engineer; "Sent on behalf of Alex Jones" footer; white header; no ISO dates; name title-cased. Screenshot 44.
Click /j/ link (incognito): opens without login; property address; cert type; Download works; engineer name + Gas Safe number; next inspection date formatted; no internal UUIDs. Screenshot 45.
Send to tenant separately; tenant receives same cert.

---

## PART 7 — SETTINGS AND PROFILE
/settings visual: two-column Full name + DOB; Gas Safe + ID card; Sort code + Account number; Town/city + Postcode; Standard rates three-column CP12/Boiler/Both; per-section Save; signature thumbnail if saved; theme picker Light/Dark/System; Plan & billing (X of 10). Screenshot 46.
Data: sort code "20-02-02" not "200202"; postcode "SW11 2AY" not "SW112AY"; name title-cased; no ALL CAPS labels. Screenshot 47.

---

## PART 8 — RENEWAL REMINDER LOOP  (PROD DB WRITE — GET USER APPROVAL FIRST)
In Supabase: set the delivered property's next_service_due to yesterday:
  UPDATE properties SET next_service_due = NOW() - INTERVAL '1 day' WHERE address_line1 = '15 Park Lane' LIMIT 1;
Trigger cron: visit https://certnow.uk/api/cron/reminders (or curl).
Mailinator (landlord) <60s: "Gas safety renewal due soon"; property address in subject; /p/ link; "Request renewal" CTA; white header; sentence case; no ISO dates. Screenshot 48.
Click /p/ link (incognito): opens without login; compliance status red/overdue; "Request renewal"; last certificate date; engineer name+contact. Screenshot 49.
Submit renewal (4 fields): Sophie Green / 07800111222 / Key with neighbour / Next Monday → success. Screenshot 50.
Dashboard: renewal request in inbound; tagged "Renewal". Screenshot 51.

---

## PART 9 — LANDLORD SIDE (NO ACCOUNT)  (all incognito, no login)
9A /p/[token]: opens without login; no /login redirect; property address; compliance badge; cert download; service history; engineer details; "Request renewal" if due. Screenshot 52.
9B /j/[token]: opens without login; cert visible+downloadable; next inspection readable; NO "Engineer actions" card; no internal UUIDs. Screenshot 53.
9C /prefill/[jobId]?token=: opens without login; correct form; submits; clear success; token works once (resubmit rejected). Screenshot 54.

---

## PART 10 — STRIPE FREE TIER GATE
/billing or /settings → Plan & billing: current month usage "X of 10 certificates used"; free tier messaging; Subscribe CTA correct pricing (£8.99/month or £79/year). Screenshot 55.
If at/near 10: issue one more cert: blocked before PDF generation; upgrade modal/clear message (not generic toast); modal "Monthly limit reached"; "Upgrade now" → /billing; historical certs still accessible. Screenshot 56.

---

## PART 11 — FINAL EMAIL DESIGN AUDIT
For each email in Mailinator: white header with "certnow" wordmark (not black); no ALL CAPS section headers; names title-cased; dates "14 June 2026" not ISO; no "undefined"/"[object Object]"; no raw API errors/stack traces; footer "Sent on behalf of [Engineer]" on landlord emails; "CertNow · certnow.uk" on engineer emails; Reply-To engineer on landlord emails; CTAs link to certnow.uk (not localhost); PDF attachments on delivery email.
Emails: 1 Welcome (engineer); 2 Prefill request (landlord); 3 Prefill completed (engineer); 4 Job request notification (engineer); 5 Landlord request confirmation (landlord); 6 Certificate delivery (landlord); 7 Renewal reminder (landlord).

---

## FINAL REPORT → audit/REPORT.md
Summary (total/passed/failed/skipped); Critical failures (block launch); UX issues; Email issues; Design inconsistencies; Screenshots index; Flows confirmed working; Recommended fixes prioritised (P1 blocks launch / P2 before launch / P3 after launch).

## UX/empty/error/mobile observations to note while navigating
- Taps dashboard→wizard Step 2 via Path A (target 3); completion/delivery load speed; PDF preview lag.
- Clarity of "prepared" status; completion vs delivery screen; invoice-not-ready not blocking; /p/ purpose.
- Error states: missing required Step 1 field; expired prefill link; Ideal Postcodes unavailable (neutral message).
- Empty states: /clients, /properties, brand-new dashboard.
- Mobile: 44px tap targets; Safety tab scroll; signature canvas overflow; text truncation.
Report each: Screen / Observation / Severity (Critical/High/Low) / Suggested fix.
