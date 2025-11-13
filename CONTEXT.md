# Proofly – Context & Development Guide (Codex Source of Truth)

## 🧭 Overview
Proofly is a **Next.js 15 (App Router)** + **Supabase SSR 0.7** + **Tailwind CSS 4** SaaS platform built to empower **solo tradespeople** (starting with plumbers) to achieve compliance, document their work, and generate client-ready AI reports.

Proofly should feel **trustworthy, mobile-first, simple, and professional** — like Notion meets Shopify Admin for tradespeople.  
The app must **minimize friction**, allowing users to finish compliance tasks in minutes.

---

## ⚙️ Technical Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15 App Router (TypeScript, React 19) |
| UI | Tailwind 4, Framer Motion, lucide-react icons, shadcn/ui components |
| Backend | Supabase (Postgres, Auth, Storage) |
| Auth | Magic link (email OTP) via Supabase SSR helpers |
| AI | OpenAI GPT-4o-mini for PDF summaries |
| PDF | `pdf-lib` for in-app generation |
| Forms | React Hook Form + Zod validation |
| Charts | Recharts for dashboard KPIs |
| Tests | Vitest for unit tests |
| Hosting | Vercel (Next.js server actions + static routes) |

---

## 🧠 Core Architecture

### Folder Structure

src/
├ app/
│ ├ (marketing)/page.tsx → Landing page
│ ├ (auth)/login/page.tsx → Supabase magic link
│ ├ (app)/layout.tsx → App shell (RequireAuth + sidebar + header)
│ ├ (app)/dashboard/page.tsx → User dashboard
│ ├ (app)/jobs/[id]/page.tsx → Job detail + checklist flow
│ ├ (app)/templates/[id]/page.tsx → Template editor
│ ├ (app)/reports/[jobId]/page.tsx → PDF viewer
│ ├ (app)/clients/[id]/page.tsx → Client details
│ └ (app)/settings/page.tsx → Preferences & account
├ components/ → Shared UI components
├ lib/ → Supabase + util helpers
├ server/ → Server actions
├ types/ → Shared types (JobDetail, TemplateItem, etc.)
└ docs/CONTEXT.md → This file


---

## 🎨 Design System

**Theme keywords:** trustworthy · clean · light industrial · modern SaaS · field-ready

| Token | Example Value | Description |
|--------|----------------|-------------|
| `--brand` | `#1E3A8A` | Core brand blue |
| `--accent` | `#2563EB` | Action blue |
| `--muted` | `#F3F4F6` | Neutral surface |
| `--surface` | `#FFFFFF` | Background |
| `--danger` | `#DC2626` | Error |
| `--success` | `#16A34A` | Success |

Typography: `font-sans` (Inter, system default)  
Components: use rounded-xl, drop shadows (`shadow-card`), and plenty of white space.  
Icons: lucide-react (`CheckSquare`, `Wrench`, `FileText`, `Users`, `Settings`).  
Animations: subtle fade/slide via Framer Motion (0.2–0.3s duration).  

---

## 🧰 Core Features (Functional Requirements)

| Module | Functionality |
|--------|----------------|
| **Dashboard** | KPI cards (Jobs this month, Completed, Pending), sparkline charts, quick links. |
| **Jobs** | Create from template → checklist flow → capture photos & signatures → generate report. |
| **Templates** | Drag-and-drop form builder for trade workflows (editable JSON schema). |
| **Reports** | View generated PDF; share via link/email. |
| **Clients** | Manage clients, contact info, and follow-ups. |
| **Reminders** | Background jobs (via Supabase cron) to remind clients or users. |
| **Auth** | Magic link OTP → redirects to /dashboard if logged in. |
| **AI Summary** | Generate PDF summaries of job notes/photos using GPT-4o-mini. |

---

## 🧩 Coding Conventions

- TypeScript strict mode enabled.  
- All server functions must await `supabaseServer()`.  
- Prefer server actions (`'use server'`) over API routes.  
- UI components are client components with `"use client"`.  
- Don’t hardcode paths — use constants from `/src/lib/routes.ts`.  
- All DB operations typed via `Database["public"]["Tables"]`.  
- Use Zod for validation.  
- Use `NavLink` for navigation; highlight active route with `usePathname()`.

---

## 💅 UX Style Guide

- **Mobile first:** every page must work perfectly on 360–400px width.  
- **Minimal inputs:** prefer toggles, checkboxes, and prefilled fields.  
- **Visual clarity:** strong hierarchy, clear icons, and whitespace.  
- **Fast completion:** fewest taps possible from job → report.  
- **Trust feel:** brand colors + crisp sans-serif + subtle depth.

**Inspiration:** Notion, Linear, Fieldwire, Stripe Dashboard.  
**No clutter, no marketing fluff.**

---

## 🚀 Future Extensions

- Stripe integration for subscriptions.  
- Template marketplace.  
- AI-driven auto-fill for repeated job data.  
- Offline mode (PWA caching).  
- “Proof mode”: share job progress live via secure link.

---

## 🧩 Developer Workflow

1. Read this file before major Codex prompts.  
2. Always import `supabaseServer` for server components and `supabaseBrowser` for client components.  
3. Keep designs modular — e.g., checklist items, job cards, KPI cards, etc.  
4. Run local tests:

   ```bash
   pnpm exec tsc --noEmit
   pnpm lint
   pnpm dev

