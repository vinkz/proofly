# CertNow – Grand Vision & MVP UX

## Purpose & Mission

Empower solo and small‑team tradespeople to achieve compliance, deliver professional reports, and eliminate paperwork using lightweight, mobile‑first, AI‑powered tools. CertNow transforms on‑site reporting into a fast, defensible digital workflow that builds trust with clients, landlords, and regulators while saving hours of admin every week.

---

## Product Concept

CertNow is a micro‑SaaS platform purpose‑built for independent plumbers, gas engineers, and small contractors who face recurring compliance and documentation burdens.

Through a streamlined **3‑step workflow (Info → Photos → Checks → Sign)** and optional **Job Sheet Scan flow**, users generate branded, professional PDF certificates and job reports that can be sent instantly via email or WhatsApp.

A core system differentiator is **Trade‑Aware Onboarding**:

* During signup, users select their trade(s) and certifications (e.g., Gas Safe, WRAS, CPS, NVQ levels).
* CertNow automatically personalises templates, terminology, required fields, and workflows for their profession.
* Users only see the certificates relevant to them, eliminating clutter and manual setup.

The result is a zero‑friction, tailor‑made compliance workflow from the first login.

---

## Core Features

### Trade‑Aware Personalisation

* Onboarding by trade and certification.
* Auto‑configured workflows for plumbing, gas, heating, maintenance, etc.

### Certificate & Checklist Engine

* Customisable forms and checklists.
* Drag‑and‑drop template editing.
* Curated starter templates per trade.

### Photo & Signature Capture

* In‑app camera capture for site evidence.
* Digital customer & engineer signatures.

### Instant AI‑Generated PDFs

* Branded documents summarised in clear professional language.
* Multi‑page reports containing photos, readings, checklists, and notes.

### Cloud Storage & Sharing

* Secure cloud archive.
* One‑tap delivery via WhatsApp or email.

### Job-Sheet Scan (Paper → Digital)

Scan Job Sheet (/jobs/scan): A dedicated mobile-first camera interface to scan Job Sheet QR codes and jump directly into the correct job.
Future versions may also support capturing photos of handwritten forms for AI-powered digitization.

* Future: OCR capture of handwritten pads and forms.
* Future: Layout detection and autofill of structured digital certificates.
* Short CN-XXXXXX codes link scanned sheets back to jobs.
* The job sheet lookup API resolves codes to job IDs for scan flows.
* QR scan entry lives at `/jobs/scan` and uses the job sheet lookup API.
* Job sheet PDFs include a QR code that deep-links to the scan flow.
* Job sheet PDFs are generated server-side from job + customer data.
* Job sheet PDFs are served from `/api/jobs/{jobId}/job-sheet`.
* Job detail pages can generate job sheet PDFs from the actions row.
* The scan UI handles lookup errors inline and keeps the camera active.

### Automated Reminders

* Annual gas safety, servicing, or maintenance follow‑ups.

### Performance Dashboard

* Weekly/monthly job stats.
* Report history.
* Compliance completion tracking.

---

## MVP Focus Certificates

* **CP12 Gas Safety Certificate**
* **Boiler Service Certificate**
* **General Works / Job Completion Certificate**
* **Job Sheet Capture → Digital Conversion**

---

## Target Users

* Solo plumbers, gas engineers, heating installers, drainage technicians, and maintenance contractors.
* UK‑based initially, then expanding to global regulated trades.
* Users who value **speed, professionalism, and zero admin**.

---

## Market Positioning & Differentiators

* **Certificate‑first focus** — not a bulky CRM.
* **Trade‑aware onboarding** for instant relevance.
* **Lightweight pricing (£10–£30/mo)** built for owner‑operators.
* **AI productivity layer** for summarisation and OCR.
* **Mobile‑first speed** — 30‑second certificates.

---

## Go‑To‑Market Strategy

* Trade‑specific Facebook groups and WhatsApp communities.
* Educational content around CP12 and servicing compliance.
* Partnerships with training providers and Gas Safe mentors.
* Simple referral incentives for early adopters.

---

## Financial Targets

* £10–£30/month subscription.
* £500 MRR ≈ 34–40 paying users.
* Micro‑SaaS marketplace exit target: £10k–£25k+ with upward scalability.

---

## Long‑Term Vision

CertNow becomes the trusted compliance companion for field trades worldwide — a flexible reporting engine that adjusts to any industry’s regulations, certifications, and workflows to produce fast, professional, defensible documentation.

---

## Core Certification Types

* CP12 Gas Safety Certificate
* Boiler Service Certificate
* General Works / Job Completion Certificate
* Job Sheet (Handwritten → Snap to Digital)

---

## 1. Home Screen — "Jobs" (Command Centre)

### Top Bar

* 🔍 Search bar
* Filter: **Today / Week / All**

### Primary CTAs

* **+ New Job**
* **Scan Job Sheet**

### Jobs List Examples

* *Boiler Service — 15 Acacia Avenue — Draft*
* *CP12 — Complete — PDF Sent*
* *General Works — Signature Needed*

The home screen acts as the central command centre for all active and completed jobs.

---

## 2. New Certificate Selection

When the user taps **+ New Job**, a modal opens with certificate options:

1. **CP12 Gas Safety Certificate**
2. **Boiler Service Certificate**
3. **General Works Certificate**

*(Future option, disabled / greyed out for anticipation)*

* **Electrical Minor Works — Coming Soon**

---

## 3. Certificate Creation Flow (Shared 3‑Step Wizard)

All certificates use the same wizard flow to minimise learning curve and maximise speed.

---

### STEP 1 — Job Info

Fields auto‑complete from past customer data whenever possible:

* Customer name
* Property address
* Landlord / agent (optional)
* Date & time
* Job type (auto‑filled based on certificate selected)
* Engineer name (auto‑filled)
* Company details (auto‑filled)

CTA:
➡️ **Next → Add Photos**

---

### STEP 2 — Add Photos

Large photo capture slots for common evidence types:

* Appliance
* Labels / serials
* Any issues / defects
* Before / after
* Flue
* Meter readings
* Site evidence

Photo input options:

* Take photo inside app
* Upload from camera roll
* *(Future)* AI auto‑labelling & sorting

CTA:
➡️ **Next → Checks**

---

### STEP 3 — Checks & Readings

#### CP12 Fields

* Appliance type
* Ventilation
* Flue condition
* Gas tightness
* CO tests / readings
* Observations
* Defects & remedial actions

#### Boiler Service Fields

* Service actions performed
* Visual inspection results
* Burner & flue checks
* Condensate check
* CO2 readings
* Service recommendations

#### General Works Fields

* Work completed summary

* Findings

* Parts used

* Recommendations

* Large text boxes support AI suggestions and auto‑summaries (optional later feature).

---

## FINISH — Digital Signatures & PDF Generation

Final step across all certificates:

* Customer signature (touch/finger draw)
* Engineer signature (pre‑saved or drawn)

🎉 **Upon completion, CertNow automatically generates a professional PDF certificate.**

---

## 4. PDF Preview Screen

After generation, the user sees a visual PDF preview with action buttons:

* **Send to Client** (email / WhatsApp)
* **Download PDF**
* **Edit Before Sending**
* **Duplicate Template** (for repeat jobs)

Once sent, the job is permanently stamped:

> *PDF Sent at 14:32*

This confirmation moment reinforces completion satisfaction.

---

## 5. Job Sheet Snap Flow (Separate Capture Flow)

Scan Job Sheet (/jobs/scan): A dedicated mobile-first camera interface to scan Job Sheet QR codes and jump directly into the correct job.
Future versions may also support capturing photos of handwritten forms for AI-powered digitization.

Accessed from home screen via **Scan Job Sheet**.

Future capture workflow:

---

### STEP 1 — Camera Capture

User photographs a handwritten paper job sheet.

CertNow automatically:

* Enhances image quality
* Runs OCR extraction
* Detects layout fields & handwritten text boxes
* Segments form data

---

### STEP 2 — Auto‑Filled Digital Form

CertNow pre‑builds a **General Works Certificate** using extracted fields:

* Customer
* Address
* Job summary
* Work carried out
* Parts used
* Price
* Engineer
* Date
* Signature (if captured)

User reviews, edits if required, then taps:
➡️ **Generate PDF**

---

### STEP 3 — PDF Ready

User can:

* **Send to Client**
* **Save as Template**
* **Add to Job List**

This workflow converts legacy paper processes into instant digital compliance reporting.

---

## 6. Job Details Page

Accessible by tapping any job in the list.

Displays:

* Job status: Draft / Waiting for Signature / Completed
* Uploaded photos
* Attached certificate PDF
* Controls:

  * **Edit**
  * **Duplicate**
  * **Delete**

---

## UX Goals

* 30‑second certificate creation
* Minimal typing via photos + auto‑fill
* Consistent flow across all document types
* Mobile‑first, one‑hand usage
* Offline capture support (sync when online later)

---

This UX model forms the foundation for CertNow MVP v1 focused on CP12, Boiler Service, General Works and Job Sheet digitisation.

## Visual Direction
- Monochrome, Notion-inspired palette for UI: accent/brand/action `#111827`, muted backgrounds `#f3f4f6`, surface `#ffffff`, success `#15803d`, danger `#b91c1c`. No blue branding; lean on black/white/grey with subtle contrast.
