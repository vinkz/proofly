# Proofly – Context & Development Guide 

##  Purpose & Mission

Empower solo and small-team tradespeople—starting with plumbers—to **achieve compliance**, deliver **professional reports**, and **reduce admin time** using lightweight, AI-driven digital tools. Proofly eliminates manual paperwork and lowers legal and operational risks by transforming field reporting into a seamless, mobile-first experience that builds trust with clients and regulators.

##  Product Concept

Proofly is a **micro‑SaaS** platform built for independent plumbers, gas engineers, electricians, drainage specialists, and small contractors who face daily compliance demands and documentation pressure.

Using a **7-step smart workflow**, Proofly lets users:

* Create or customise compliance templates
* Capture photos and signatures in the field
* Generate branded, AI-summarised PDF reports
* Deliver reports instantly via email or WhatsApp
* Store and track all jobs securely in the cloud

### 🔧 Trade-Aware Onboarding (Key Innovation)

During signup, users specify their:

* Trade (plumber, gas engineer, electrician, heating, drainage, etc.)
* Certifications (Gas Safe, WRAS, CPS, NVQ levels, etc.)
* Typical work domains

Proofly then **personalises the entire system**:

* Relevant templates only
* Trade-specific terminology
* Auto‑suggested checklists
* Legal/regulatory variations

This creates **zero setup friction** and makes the app feel tailor‑made from minute one.

---

## Core Features

### 1. Personalised Trade-Aware Onboarding

* Choose trade + certifications
* UI, templates, and workflows adapt instantly
* Removes clutter, increases trust and speed

### 2. Customisable Compliance Checklists

* Drag-and-drop template builder
* Preloaded trade-specific templates
* Each checklist item supports notes, photos, and pass/fail

### 3. Photo & Signature Capture

* Attach real‑time, on‑site proof for every job
* Dual signatures: engineer + client

### 4. Instant AI-Generated PDF Reports

* Professional, branded client reports
* AI summarises inspection results into clear, compliant narratives

### 5. Cloud Storage & Sharing

* Secure record archive
* One‑tap email / WhatsApp delivery

### 6. Automated Service Reminders

* Send follow-ups for compliance maintenance
* Helps drive repeat business

### 7. Visual Dashboard

* Track job volume, compliance rates, templates used, and top clients

---

##  Target User

* Independent tradespeople (plumbers, gas engineers, electricians)
* Small teams (1–5 engineers)
* Businesses needing compliance documentation
* Users who value speed over admin-heavy software

Focus: **UK market first**, expanding to similar regulated trades globally.

---

##  Market Position & Differentiators

* **Trade-aware personalisation**—unique advantage
* **Compliance-first** rather than full CRM or scheduling software
* **Lightweight and affordable** for solo operators
* **AI-augmented workflow** massively reduces time to produce reports
* **Fastest onboarding** in the sector

---

##  Technical Stack

Same as previous version, with no changes:

* Next.js 15 App Router, Supabase SSR, Tailwind 4, OpenAI GPT-4o-mini, pdf-lib, etc.

---

##  Design System (Updated)

The action button color should be updated to a **green** that complements Proofly’s core blue.

### Brand Colors

* `--brand`: **#1E3A8A** (primary blue)
* `--accent`: **#2563EB** (secondary blue)
* `--action`: **#16A34A** (green for primary actions)
* `--muted`: #F3F4F6
* `--surface`: #FFFFFF
* `--danger`: #DC2626
* `--success`: #16A34A

Use `bg-[--action]` for primary buttons.

### Styling Principles

* Mobile-first
* Minimal inputs, maximise automation
* Use rounded-xl, subtle shadows, clean typography
* Framer Motion micro-animations for fluidity

---

##  Developer Workflow

* Use server actions (`"use server"`) for backend operations
* Keep components modular
* Use Zod for validation
* Run:

  ```bash
  pnpm exec tsc --noEmit
  pnpm lint
  pnpm dev
  ```

---

##  Future Extensions

* Stripe subscriptions
* Template marketplace
* Offline mode (PWA)
* “Proof Mode” live job viewer
* AI-driven auto-complete for job details
