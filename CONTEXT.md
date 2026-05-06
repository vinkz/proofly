# CertNow — Updated Product Vision (V2)

## Purpose & Mission

CertNow helps **UK Gas Safe registered engineers** eliminate evening admin by completing **compliant certificates and professional invoices on site**, in one continuous flow.

We focus on the **“Sole Trader Speed”** niche: engineers who need paperwork finished **before they reach the van**.

CertNow is **not** a complex CRM.  
It is a **high-speed documentation engine**.

The current product direction is now **property-first and link-based**:
- **properties** are the long-term compliance anchors
- **jobs** are individual execution events at a property
- **job requests** are landlord-submitted requests for work
- **engineer profiles** provide reusable company/engineer identity for autofill
- the dashboard remains for **upcoming/prep work**, but should also surface pending landlord requests above scheduled jobs
- clients/landlords remain important for contact, billing, and portfolio history
- the public site is intended to live on **certnow.uk**, with Vercel preview URLs used for testing/staging

The product must preserve the current engineer-created job workflow. Public landlord request links are an acquisition and retention loop, not a replacement for engineers manually creating jobs from phone calls, WhatsApp, email, repeat clients, urgent visits, or any other real-world source.

---

## Core Product Pillars

### 1. Compliance Without Friction

CertNow turns complex CP12 legal requirements into a logical, step-by-step wizard that mirrors the real inspection process.

**The Workflow**  
**Landlord/Tenant Info → Gas Meter & Tightness → Appliance-Specific Checks → FGA Readings → Digital Sign-off**

**Safety First**
- Integrated **ID / AR / NCS** classifications
- Automatic generation of warning notices when an appliance fails
- Enforcement of compliance rules before certificate issue

---

### 2. “Dirty Hands” UI (Mobile-First)

Designed for real boiler-room conditions:
- poor lighting
- wet hands
- one-handed use

**Design Principles**
- **High-Contrast Interface**  
  Monochrome base with high-visibility *Safety Red* and *Compliance Green*
- **Fat-Finger Targets**  
  Large toggles and sliders instead of small checkboxes or dense inputs
- **The 30-Second Goal**  
  Repeat service certificates completed in under 30 seconds

---

### 3. AI as a Technical Assistant (Whisper)

AI is not a chatbot.  
It is a **data-entry accelerator**.

**Reading Capture**
> “CO 5, CO2 9.1, Ratio point triple zero four”  
→ Automatically populates the FGA table

**Voice Observations**
- Hands-free dictation for:
  - remedial work required
  - defect descriptions  
- Targets the most time-consuming typing tasks

---

### 4. Professionalism-in-a-Box

Instant generation of branded, industry-standard PDFs that are:

**Legally Robust**
- Correct landlord vs tenant address mapping
- Supports Section 21 compliance

**Evidence-Backed**
- Embedded photos:
  - boiler
  - flue
  - FGA analyser screen

---

## Property-First Core Model

### Property

The property is the long-term compliance anchor.

Used for:
- public landlord link
- compliance history
- reminders
- job requests
- future certificates
- renewal context

Each property should eventually expose a public route:

`/p/[public_token]`

This page must never require login. It should show:
- property address
- current compliance/certificate status
- latest certificate expiry date if available
- engineer name and Gas Safe number
- certificate download button if available

CTA logic:
- If there is no previous CP12/certificate history, show **Request Gas Safety Check**
- If there is previous CP12/certificate history and the certificate is due or expired, show **Request Renewal**

Both CTAs use the same landlord form with four fields maximum:
- `tenant_name`
- `tenant_phone`
- `access_notes`
- `preferred_dates`

Do not ask landlords to re-enter property address, landlord name, landlord contact, or engineer details. Those should come from property/client/engineer records where possible.

### Job

A job is one execution event at a property.

Examples:
- CP12
- boiler service
- gas warning notice
- general works
- commissioning

Jobs should connect property, landlord/client, certificate outputs, invoices, photos, signatures, and follow-up state. Existing job routes and wizard flows remain valid.

### Job Request

A job request is landlord-triggered demand that may become a job.

Request types:
- `new_job`
- `renewal`

Use one broad table called `job_requests`, not `renewal_requests`.

Suggested schema:

```sql
CREATE TABLE job_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties,
  user_id UUID REFERENCES auth.users,
  request_type TEXT NOT NULL, -- 'new_job' or 'renewal'
  job_type TEXT NOT NULL DEFAULT 'cp12',
  tenant_name TEXT,
  tenant_phone TEXT,
  access_notes TEXT,
  preferred_dates TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Status lifecycle:

`pending → scheduled → completed → dismissed`

When a landlord submits a public property request:
- create a `job_requests` row
- classify as `new_job` if no previous CP12/certificate history exists
- classify as `renewal` if previous CP12/certificate history exists and the certificate is due, within 60 days of expiry, or expired
- notify the engineer via Resend
- show the request on the engineer dashboard

When an engineer creates a job from a request:
- link the job to `job_requests.id`
- update request status to `scheduled`

### Engineer Profile

The engineer profile is persistent engineer/company identity.

Used to avoid repeated entry across:
- certificates
- invoices
- jobs
- public property links
- renewal/request context

Autofill should use it for:
- engineer name
- company details
- Gas Safe number
- ID card number
- phone/email where needed
- saved engineer signature when available

---

## Job Creation Entry Points

CertNow must support three job creation entry points.

### 1. Engineer Manual Job Creation

Engineers must retain the ability to create jobs manually via `/jobs/new` at all times.

This is used when an engineer receives work through:
- phone
- WhatsApp
- email
- repeat clients
- urgent visits
- any situation where no landlord request exists

The new job request system must not replace manual job creation.

### 2. Landlord New Job Request

Used when a landlord requests work for a property with no existing CertNow certificate history.

Classification:

`request_type = 'new_job'`

This is new work, not a renewal.

### 3. Landlord Renewal Request

Used when a landlord requests work for an existing property with previous CP12/certificate history, especially where a certificate is due soon, within 60 days of expiry, or already expired.

Classification:

`request_type = 'renewal'`

### Converged Job Creation

All three flows should converge into the same `/jobs/new` route:
- Manual engineer-created job = low/no prefill
- New job request = medium prefill
- Renewal request = high prefill

Prefill should come from:
- job request
- property record
- previous jobs/certificates
- landlord/client record
- engineer profile

Engineers must always be able to edit prefilled values before creating the job.

---

## MVP Feature Set (Refined)

### 🟢 Included in MVP

- **The Big Three Certificates**
  - CP12 (Landlord Gas Safety)
  - Boiler Service Record
  - General Industry Commissioning

### CP12 Wizard (2026-02 refresh)
- Sections follow the PDF order for a minimal pass: **Installer (prefilled from account) → Job address → Customer/Landlord → Appliance identity → Appliance checks → Sign**.
- Installer/company + engineer + Gas Safe + ID card values are **pulled from account settings**; the wizard never asks for them. If missing, the issue flow is blocked until the user updates their profile.
- Step 1 now supports **selecting or creating a client inline**. New client creation requires only:
  - `name`
  - `phone` optional
  - `email` optional
- When a client is selected, the wizard uses the internal `client_id` as the source of truth and prefills Step 1 from saved client data.
- If that client has previous jobs, Step 1 can also offer a **saved property** so engineers can reuse property/location details before arriving on site.
- Job address captures **Name, Address lines, City, Post Code, Tel. No. (site)** and writes to `job_address_*` + `property_postcode`.
- Customer/Landlord card captures **Name, Company, Address, Post Code, Tel. No.** and writes to `landlord_*` fields; billable customer is **removed** from CP12.
- Appliance identity captures **Location, Appliance Type, Make, Model, Flue type** (up to **5 appliances** to match the PDF table capacity).
- Appliance checks capture the inspection table values: **Operating Pressure, Heat Input, combustion readings (hi/lo), Safety device operation, Ventilation, Flue visual/performance, Appliance serviced, Appliance safe to use**, plus defect + warning notice logic.
- Upcoming jobs can now enter a **prepare-only** CP12 Step 1 flow from the dashboard. Saving Step 1 persists People & Location details and returns the engineer to the dashboard without forcing the full wizard.
- Recent mobile refinements:
  - demo-fill buttons are hidden from screenshot/user-facing flows
  - address lookup disabled/configuration errors are suppressed in visible wizard UI
  - Step 2 removes excess wrapper/header space and places `+ Appliance` inline with **Appliance 1 identity**
  - Step 3 removes the global **Measurement source** selector
  - voice capture appears only beside numerical readings, not notes/comments
  - signature canvases are touch-safe so drawing does not scroll the page
  - browser/phone back gestures in the CP12 wizard step back through wizard steps before leaving the route

- **Logic-Gate Wizard**
  - Mandatory Gas Safe compliance fields
  - Gas tightness, ventilation, flue checks enforced

- **Gas Rate Calculator**
  - Built-in kW input calculation via meter timing
  - No external calculator required

- **Photo Evidence**
  - One-tap camera capture
  - FGA printouts
  - Visual defects

- **Unified Delivery**
  - One-tap send via WhatsApp or Email
  - Certificate and Invoice sent together

- **Landlord / Agent Database**
  - Clear separation of:
    - Property address
    - Billing address
  - Supports managed landlord portfolios

- **Property Public Link Loop**
  - Each property can have a public landlord-facing link
  - Landlords can request a new CP12 or renewal without logging in
  - The request feeds the engineer dashboard and then `/jobs/new`
  - The loop turns completed certificates into future retention/acquisition touchpoints

---

### 🔴 Explicitly NOT in MVP

- Inventory or stock management
- Parts tracking (nuts, bolts, fittings)
- Complex scheduling or dispatch
- Google Calendar sync
- Offline database sync  
  *(active connection required in MVP — offline planned for V2)*

---

## The “Site-to-Done” UX Flow

1. **Prepare or Start Job**  
   From the dashboard, open an upcoming job. If prep is incomplete, choose **Prepare** to complete Step 1 ahead of the visit. Select an existing client, add a new one, and optionally reuse a saved property.

2. **The Meter**  
   Enter standing and working pressure.  
   AI assists with the tightness test result.

3. **The Appliances**  
   Add *Boiler 1*.  
   Toggle pass/fail for:
   - ventilation
   - flue
   - safety devices

4. **The FGA**  
   Dictate analyser readings.  
   Snap a photo of the analyser screen for audit evidence.

5. **The Verdict**  
   If failed, select **ID** or **AR**.  
   CertNow warns the engineer to cap the supply.

6. **The Handover**  
   Client signs on the screen.  
   One tap generates the certificate and optional invoice.

7. **Done**  
   The engineer walks to the van.  
   Admin is **100% finished**.

---

## Dashboard Direction

The dashboard is intentionally **not** a completed-jobs homepage anymore.

It focuses on:
- **Upcoming jobs**
- **Past/recent jobs**
- **Awaiting signatures**
- **Operational milestones**
- **Prep state** for upcoming jobs so engineers know whether a visit is ready to start
- **Job type visibility** so cards show labels such as CP12 or Gas Warning Notice, not only name/address
- **Pending job requests** from landlord public links, shown above upcoming jobs

Dashboard actions currently separate intent:
- `+ New Job` and `Create invoice` live in the welcome/header actions
- `View all jobs` sits with the upcoming/past jobs area

Pending request cards should be labelled by `request_type`:
- **New Job Request**
- **Renewal Request**

Each request card should show:
- property address
- landlord name and phone
- certificate expiry status if renewal
- tenant name and phone
- access notes
- preferred dates

Actions:
- **Schedule Job**
- **Dismiss**

`Schedule Job` opens `/jobs/new` pre-populated with:
- property address
- landlord/client details
- job type
- tenant details
- access notes
- request id

Completed work is still best explored from **Jobs** and the relevant **client page**, not from a heavy dashboard archive.

---

## Autofill Direction

Autofill is a core product advantage, not a convenience feature.

The app should reduce repeated data entry by merging:
- job request context
- property record
- previous jobs/certificates
- landlord/client record
- engineer profile

Autofill should populate:
- engineer company details
- Gas Safe number
- engineer signature if saved
- property address
- landlord/client details
- tenant/access notes from job request
- previous appliance data where available in future

Autofill should never silently overwrite engineer-entered values during an active form session.

---

## Follow-Up Logic

CP12 is the main compliance lifecycle anchor.

### CP12

When completed, always create a 12-month CP12 follow-up.

### Boiler Service

Boiler Service is available as an engineer-selectable flow again.

Entry behavior:
- `/jobs/new` must expose `service`
- `/wizard/create/boiler_service` normalizes to `gas_service`
- boiler service starts directly in the wizard like CP12
- the old client pre-step should not be required for the default boiler service path

Step 1 should mirror CP12 where applicable:
- service date
- job/property name
- structured job address
- address API lookup
- postcode
- site telephone
- structured client/landlord correspondence details

Boiler Service UI should only expose fields needed by the current gas-service PDF or useful operational capture. The active PDF fields are:
- engineer/company/Gas Safe details from profile
- job address block
- client/landlord address block
- boiler type, make, model, location, serial
- high and low combustion CO/CO2/ratio
- operating pressure and heat input
- safety/template yes-no checks used by the PDF
- service summary, recommendations, defects/parts comments
- next service due
- engineer and customer signatures

When completed:

If linked to CP12 on the same job:
- do not create a separate boiler service follow-up
- CP12 renewal cycle covers it

If standalone:
- create a 12-month boiler service follow-up
- add note: `Standalone service — confirm whether CP12 also required`

### Gas Warning Notice

Keep existing logic:
- triggered from unsafe CP12 appliance checks
- do not merge with boiler service follow-up logic

Known future gap:
- Standalone boiler service finding a dangerous appliance may need separate gas warning notice handling later.

---

## Invoice Flow Direction

Invoices already exist, but should be better integrated into certificate completion.

At CP12 Step 4 completion, after PDF generation, prompt:

**Create invoice for this job?**

The button should open `/invoices/new` pre-populated with:
- client name
- property address
- job date
- job type
- engineer/company details

The engineer should not need to navigate separately to invoices after completing a certificate. Existing standalone invoice routes must remain available.

---

## Auth, Domains, And Deployment

Auth is Supabase-backed and supports:
- Google OAuth
- password login
- magic link
- password reset/change
- signup/onboarding

Google OAuth redirects through `/auth/callback`. The app uses `NEXT_PUBLIC_SITE_URL` as the canonical callback origin when configured, falling back to the current browser origin in local/dev cases.

Production domain setup:
- Primary public domain: `https://certnow.uk`
- `www.certnow.uk` should redirect or resolve consistently through Vercel
- Vercel preview URLs are for test deployments

Required Supabase redirect URLs should include:
- `https://certnow.uk/auth/callback`
- `https://www.certnow.uk/auth/callback`
- any stable Vercel/staging callback URL used for testing

When `NEXT_PUBLIC_SITE_URL` changes, redeploy/restart because it is included in the client bundle.

---

## Security Posture

The app handles legally significant certificates, client details, addresses, signatures, and invoices. Treat security boundaries as part of the product, not a later cleanup item.

Current sensitive server areas:
- OpenAI report/voice helpers use `OPENAI_API_KEY`
- Supabase service-role helpers use `SUPABASE_SERVICE_ROLE_KEY`
- PDF generation can read private storage assets such as signatures and photos
- Certificate/invoice generation writes legally meaningful records
- Public property links expose a deliberately unauthenticated surface and must only return landlord-safe property/compliance/certificate fields

Guardrails now expected in the codebase:
- Secret-bearing utility modules include `import 'server-only';`
- Top-level server action files keep `'use server'` first and perform auth/ownership checks before service-role writes
- Client components should call server actions, not private utility clients
- Private env vars must never be logged, returned to the browser, or copied into `NEXT_PUBLIC_*`
- Public tokens must be random, unguessable, and scoped to one property

Before real users, run a deliberate RLS/storage audit across:
- `profiles`
- `properties`
- `job_requests`
- `clients`
- `jobs`
- `job_fields`
- `certificates`
- `invoices`
- `documents` / `reports`
- Supabase storage buckets for certificates, reports, signatures, and job photos

---

## Major Moving Parts

### Frontend Routes
- Landing page: `/`
- Auth: `/login`, `/signup/step1`, `/signup/step2`, reset/password routes, `/auth/callback`
- Operational home: `/dashboard`
- Job creation: `/jobs/new`
- Public property link: `/p/[public_token]` (planned; no login)
- Certificate wizard: `/wizard/create/[certificateType]`
- Job record/detail: `/jobs/[id]`
- Canonical document preview: `/jobs/[id]/pdf`
- Clients: `/clients`, `/clients/[id]`
- Documents: `/documents`
- Invoices: `/invoices`, `/invoices/new`, `/invoices/[invoiceId]`

### Server/Data Layer
- Supabase auth/session helpers live in `src/lib/supabaseServer.ts` and `src/lib/supabaseClient.ts`
- Profile/onboarding defaults live around `src/server/profile.ts`
- Job creation/list/detail/report logic is in `src/server/jobs.ts`
- Certificate persistence/PDF orchestration is in `src/server/certificates.ts`
- Client/customer resolution is in `src/server/clients.ts` and `src/server/customer-service.ts`
- Job address persistence is in `src/server/address-service.ts`
- Property records and `job_requests` are the planned persistence layer for public links, request classification, renewal/new-job intake, and property-first compliance history.
- Job context generation should merge request, property, prior certificate/job, client/landlord, and engineer profile context before `/jobs/new` or certificate wizards consume it.

### PDF/Document Layer
- CP12 AcroForm renderer: `src/server/pdf/renderCp12Certificate.ts`
- Gas Warning Notice renderer: `src/server/pdf/renderGasWarningNoticePdf.ts`
- Boiler service/general works renderers live under `src/lib/pdf` and `src/server/pdf`
- Generated certificates/documents upload to Supabase storage and are returned via signed URLs

### Key UX State
- CP12 is the most developed certificate flow and drives the app direction
- Dashboard is for operation/prep/request triage, not a CRM dashboard
- Properties are the long-term compliance history surface; clients/landlords remain contact and billing surfaces
- Jobs are execution events that connect property, client/landlord, certificate, invoice, and follow-up context
- Landing screenshots under `public/landing` are marketing assets and should stay filled/clean

---

## Compatibility Guardrails

The new property/request/autofill direction must be additive.

Preserve compatibility with:
- existing CP12 wizard behavior
- current `/jobs/new` manual engineer workflow
- current Supabase job/client/job_fields/certificate persistence
- certificate PDF generation pipeline
- existing invoice routes
- existing follow-up system
- current dashboard prepare/start behavior

Success criteria for future implementation:
- manual engineer job creation still works without a request
- first-time landlord job requests create `new_job` requests
- renewal landlord requests create `renewal` requests
- public property links show compliance status without login
- property-first compliance history becomes the source of renewal truth
- engineer-side autofill reduces repeated typing
- duplicate follow-ups are avoided
- CP12 remains the main compliance lifecycle anchor
- boiler service follow-ups are linked correctly to CP12 where relevant
- landlord links create acquisition/retention loops without taking control away from engineers

---

## Visual & Technical Direction

- **UI**
  - Mobile-first, high-contrast, low-friction workflow screens
  - Deep greys/whites with restrained action colours
  - Large touch targets and reduced visual noise on wizard steps

- **Data Structure**
  - Relational model:
    - Landlord (payer)
    - Tenant (property)

- **Primary CTA**
  - Persistent **“Next Step”** button
  - Bottom-anchored for one-thumb navigation
