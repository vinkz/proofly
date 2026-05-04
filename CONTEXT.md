# CertNow — Updated Product Vision (V2)

## Purpose & Mission

CertNow helps **UK Gas Safe registered engineers** eliminate evening admin by completing **compliant certificates and professional invoices on site**, in one continuous flow.

We focus on the **“Sole Trader Speed”** niche: engineers who need paperwork finished **before they reach the van**.

CertNow is **not** a complex CRM.  
It is a **high-speed documentation engine**.

The current product direction is now **client-first operationally**:
- the dashboard is for **upcoming/prep work**
- clients are the home for **history and completed work**
- jobs remain the execution record that connects clients to certificates and invoices
- the public site is now intended to live on the custom domain **certnow.uk**, with Vercel preview URLs used for testing/staging

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

Dashboard actions currently separate intent:
- `+ New Job` and `Create invoice` live in the welcome/header actions
- `View all jobs` sits with the upcoming/past jobs area

Completed work is still best explored from **Jobs** and the relevant **client page**, not from a heavy dashboard archive.

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

Guardrails now expected in the codebase:
- Secret-bearing utility modules include `import 'server-only';`
- Top-level server action files keep `'use server'` first and perform auth/ownership checks before service-role writes
- Client components should call server actions, not private utility clients
- Private env vars must never be logged, returned to the browser, or copied into `NEXT_PUBLIC_*`

Before real users, run a deliberate RLS/storage audit across:
- `profiles`
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
- Certificate wizard: `/wizard/create/[certificateType]`
- Job record/detail: `/jobs/[id]`
- Canonical document preview: `/jobs/[id]/pdf`
- Clients: `/clients`, `/clients/[id]`
- Documents: `/documents`
- Invoices: `/invoices`, `/invoices/new`, `/invoices/[invoiceId]`
- Job sheet scan: `/jobs/scan`

### Server/Data Layer
- Supabase auth/session helpers live in `src/lib/supabaseServer.ts` and `src/lib/supabaseClient.ts`
- Profile/onboarding defaults live around `src/server/profile.ts`
- Job creation/list/detail/report logic is in `src/server/jobs.ts`
- Certificate persistence/PDF orchestration is in `src/server/certificates.ts`
- Client/customer resolution is in `src/server/clients.ts` and `src/server/customer-service.ts`
- Job address persistence is in `src/server/address-service.ts`
- Job sheets live in `src/server/job-sheets.ts`

### PDF/Document Layer
- CP12 AcroForm renderer: `src/server/pdf/renderCp12Certificate.ts`
- Gas Warning Notice renderer: `src/server/pdf/renderGasWarningNoticePdf.ts`
- Boiler service/general works/job sheet renderers live under `src/lib/pdf` and `src/server/pdf`
- Generated certificates/documents upload to Supabase storage and are returned via signed URLs

### Key UX State
- CP12 is the most developed certificate flow and drives the app direction
- Dashboard is for operation/prep, not a CRM dashboard
- Clients and jobs are the long-term history surfaces
- Landing screenshots under `public/landing` are marketing assets and should stay filled/clean

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
