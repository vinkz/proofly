# CertNow — Updated Product Vision (V2)

## Purpose & Mission

CertNow helps **UK Gas Safe registered engineers** eliminate evening admin by completing **compliant certificates and professional invoices on site**, in one continuous flow.

We focus on the **“Sole Trader Speed”** niche: engineers who need paperwork finished **before they reach the van**.

CertNow is **not** a complex CRM.  
It is a **high-speed documentation engine**.

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
- Job address captures **Name, Address lines, City, Post Code, Tel. No. (site)** and writes to `job_address_*` + `property_postcode`.
- Customer/Landlord card captures **Name, Company, Address, Post Code, Tel. No.** and writes to `landlord_*` fields; billable customer is **removed** from CP12.
- Appliance identity captures **Location, Appliance Type, Make, Model, Flue type** (up to **5 appliances** to match the PDF table capacity).
- Appliance checks capture the inspection table values: **Operating Pressure, Heat Input, combustion readings (hi/lo), Safety device operation, Ventilation, Flue visual/performance, Appliance serviced, Appliance safe to use**, plus defect + warning notice logic.

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

1. **Start Job**  
   Select **CP12**. Choose existing client or *Add New*.

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

## Visual & Technical Direction

- **UI**
  - High-contrast *Notion-Dark*
  - Deep greys and whites
  - Safety colours used sparingly

- **Data Structure**
  - Relational model:
    - Landlord (payer)
    - Tenant (property)

- **Primary CTA**
  - Persistent **“Next Step”** button
  - Bottom-anchored for one-thumb navigation
