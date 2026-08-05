# Letting agent channel — infrastructure audit

**Date:** 2026-07-30
**Branch audited:** `free-cp12-generator` (working tree, uncommitted state included)
**Method:** static reading of the repo only. No code was changed. Where the live Supabase
project would have been the only way to confirm something, that is stated as unverified —
the Supabase MCP server is not authenticated in this session and `docs/supabase-snapshot.md`
records itself as empty since 2024-12-24.

---

## Reuse for the agent use case

### 1. Could a letting agent use the landlord request-to-engineer page as-is?

**No. Not for managing multiple properties, and the rate limits alone stop it before
anything conceptual does.**

**What exists**

| Piece | Path |
|---|---|
| `/request-job` | `src/app/request-job/page.tsx` — a 7-line permanent redirect to `/request` |
| `/request` (unscoped) | `src/app/request/page.tsx` |
| `/request/[slug]` (scoped to one engineer) | `src/app/request/[slug]/page.tsx` |
| The form itself | `src/app/request-job/request-job-client.tsx` (666 lines, plain `useState`) |
| The server action | `submitStandaloneLandlordJobRequest` → `createPendingJobRequest`, `src/server/job-requests.ts:709-966` |
| Where it lands | `job_requests` table; engineer inbox at `src/app/(app)/requests/page.tsx` |

**What actually happens on submit** (`src/server/job-requests.ts:709` onwards)

1. Zod-parses the input (`StandaloneJobRequestSchema`, line 32) — note the shape: `propertyAddress`
   is a **single string**, `min(5).max(500)`.
2. Consumes two rate-limit buckets (lines 733–750): `landlord_job_request_ip` **5 per IP per hour**,
   and `landlord_job_request_engineer` **10 per engineer per 24 hours**. Exceeding either throws
   `Too many requests. Please wait a little while and try again.`
3. Tries to match the named engineer to a `profiles` row by request slug → company email → auth
   email → Gas Safe number → phone (`findEngineerProfileForRequest`, line 274).
4. Inserts **one** `job_requests` row (line 764) with one `property_address`, one landlord block,
   one engineer block.
5. Emails the submitter a confirmation, and either emails the matched engineer a "new job request"
   or emails an unmatched engineer a "claim it by signing up" link with a **30-day claim token**.
6. Returns `engineerActionUrl` so the page can offer a WhatsApp share (`request-job-client.tsx:316-339`).

**What breaks for an agent**

- **One submission = one property, and nothing is remembered.** The form is React `useState` only
  — no account, no cookie, no localStorage, no draft. An agent with 40 properties fills in the
  whole three-step form 40 times, retyping their own name, email, phone and office address every
  single time.
- **The rate limits make it unusable at portfolio scale.** 5 requests per IP per hour means an
  agency office (one shared `x-forwarded-for`) gets five properties an hour across all staff. 10
  per engineer per 24 hours means an agent who uses one trusted engineer is hard-blocked after ten
  properties, regardless of IP. These are tuned for a landlord doing one property, and they are
  correct for that. They are wrong for this channel.
- **The identity model is "landlord", with agent bolted on in copy only.** Every column is
  `landlord_name`, `landlord_email`, `landlord_phone`, `landlord_address_*`. The UI hint at
  `request-job-client.tsx:440` says "as the landlord or agent", and GSIUR Reg 36(3)(c) does permit
  the agent's name and address on the record — so an agent filling it in as themselves is legally
  fine. But **there is nowhere to record who the actual landlord is.** The record will say the
  agent, with no link to the owner.
- **Bug found: the agency name is collected and then silently dropped.** `landlordCompany` is a
  state field with a "Company (optional)" input (`request-job-client.tsx:96, 450`), but
  `handleSubmit` never passes it to the server action (lines 266–287), and
  `StandaloneJobRequestSchema` has no field for it. For a landlord that is a minor loss. For an
  agent it is the single most important identifying field, and it goes nowhere.
- **An engineer is mandatory.** On the unscoped `/request`, step 1 blocks with "Engineer name is
  required" (`validateCurrentStep`, line 229). There is no "find me an engineer" path. An agent
  onboarding without a nominated engineer cannot get through step 1.
- **If the engineer isn't a CertNow user, the request may go nowhere.** It is inserted with
  `user_id: null`, `assigned_engineer_id: null` and a claim token; the engineer gets a sign-up
  invite. If they never sign up, the request sits pending forever and the agent is told "The
  request has been sent to your engineer."
- **A scoped link belongs to exactly one engineer.** `/request/{slug}` resolves one profile by
  `profiles.request_link_slug`. Good for an agent with a single contractor; no concept of an agent
  who spreads work across several.
- **No dedupe.** The only uniqueness constraints on `job_requests` are for *open renewals*
  (`supabase/migrations/20260729213157_public_action_rate_limits.sql`, the two partial indexes at
  the end). Submitting the same property twice creates two pending rows.
- **The agent gets no visibility afterwards.** A confirmation email and a WhatsApp share button.
  No list of what they've submitted, no status, no portfolio view. Nothing.

**Verdict:** *Reusable with changes* for an agent submitting one property occasionally. *Not
reusable* as the agent channel. Do not point outreach at `/request`.

**If changes needed**

| Change | Effort |
|---|---|
| Fix the dropped `landlordCompany` (schema field + pass-through + column) | ~1 hour |
| Separate "requester" (agent) from "responsible person" (landlord) in schema + form + emails | 1–2 days, touches `job_requests`, the prefill path, the wizard and the CP12 render model |
| Multi-property submission (repeat/paste/CSV) with per-agent rate-limit exemption | 2–3 days minimum, and needs an identity to hang the exemption on — i.e. accounts |
| Agent-side status view of submitted requests | Needs auth for agents. Multi-day, effectively a new surface. |

---

### 2. The tokenised property/certificate link

**What exists**

- **`/p/[publicToken]` — the "Property Vault".** Page: `src/app/p/[publicToken]/page.tsx`. Data:
  `getPublicPropertyByToken`, `src/server/public-property.ts:68`. Token is
  `properties.public_token`, a de-hyphenated UUID, unique-indexed, generated by column default
  (`supabase/migrations/20260510120000_complete_job_lifecycle_foundation.sql:5,16`).
- **`/j/[publicToken]` — the per-job link.** Page: `src/app/j/[publicToken]/page.tsx` (349 lines).
  Data: `src/server/public-job.ts`. Token is `jobs.public_token`
  (`supabase/migrations/20260507100000_jobs_public_share_token.sql`).
- **`/sign/cp12/[token]`** — a separate, genuinely expiring signature link
  (`src/app/sign/cp12/[token]/page.tsx` handles `invalid` / `expired` / `completed` states).

**What a recipient sees on `/p`** — property address, landlord name, compliance status
(current/due soon/overdue), tenant name, every certificate with a download button, the engineer's
name, company, Gas Safe number, phone **and email**, the full service history, and a renewal
booking form.

**How long it's valid: forever.** There is no expiry column, no revocation, no auth on either
`/p` or `/j`. Anyone who is ever forwarded the URL keeps that access permanently. The only
mitigation is `robots.ts`, which disallows `/j/` and `/p/`. The *PDF* download URLs inside the
page are Supabase signed URLs valid **1 hour**, minted at page render
(`public-property.ts:117`, `public-job.ts:181`) — so the page is permanent and the file links
inside it are short-lived but re-minted on every visit. That is a permanent grant, not a
time-limited one.

**One recipient receiving links for many properties: does not exist.** Tokens are per-property
and per-job. There is no index page, no account, no "all properties for this email" view, and no
join from an email address to a set of tokens. Two traces of the idea exist and both are dead
ends:

- `landlordHasMultipleJobs` is computed in `src/server/public-job.ts:66, 260` — costing two extra
  queries on every public job page load — and is **never read anywhere in `src/` or `tests/`.**
  Dead code.
- `src/app/_components/landing-tabs.tsx` carries an in-code TODO admitting it: *"no landlord-facing
  lookup route exists for an existing /p/[token] property vault link, so this points at the request
  flow for now."* The "Open it here" link on the landlord tab is a lie — it goes to `/request`.

**Verdict:** *Reusable as-is* for what it does (one property, one permanent link). *Doesn't exist*
for the agent case (one recipient, many properties). Also note that handing agents these links
means handing them permanent, unrevocable, unauthenticated URLs that expose the engineer's contact
details — worth a decision before you make it a selling point.

**If changes needed:** an agent-facing "my properties" view needs either agent accounts or a
signed multi-property token. Either is a new surface, not a tweak. Multi-day.

---

### 3. Is there any grouping concept above a property?

**No. There is one, and it isn't the one you need.**

**What exists**

```
auth.users (engineer)
  └── profiles            (the engineer's business identity)
  └── clients             (the engineer's customer record)
        └── properties    (properties.client_id → clients.id)
              └── jobs    (jobs.property_id)
                    └── certificates
```

- `properties` — `supabase/migrations/20260510120000_complete_job_lifecycle_foundation.sql:1-14`.
  Columns: `user_id`, `client_id`, `public_token`, `name`, address parts, `phone`,
  `next_service_due`. RLS: `auth.uid() = user_id`.
- `clients` — `supabase/migrations/20240219120000_proofly_schema.sql:32-42`. Columns: `user_id`,
  `name`, **`organization`**, `email`, `phone`, `address`.

So the only thing above a property is `clients`, and it is *the engineer's* customer row, scoped by
`user_id`. Consequences:

- The same letting agent working with three engineers is **three unrelated `clients` rows** in
  three tenants, with no shared identity and no way to reconcile them.
- `clients.organization` is the closest thing to an agency field that exists. It is a free-text
  column on a per-engineer record, not an entity.
- There is **no** portfolio, owner, organisation, agency or account-above-user concept anywhere in
  the schema. RLS is uniformly "the row belongs to one engineer".

**Verdict:** *Doesn't exist.* Any agent-facing product that shows one agent many properties needs a
new entity above `properties` that is not owned by a single engineer — which cuts across the RLS
model the whole app is built on. Treat that as a foundational change (days, not hours), not
something to bolt onto the capture page.

---

### 4. The landlord landing page — what's reusable for an agent page?

**What exists — and first, a correction to the premise: there is no landlord landing page.**
It is a **client-side tab on the root page**, not a route.

- `src/app/page.tsx` (32 lines) — renders `MarketingHeader`, `<LandingTabs />`, `MarketingFooter`.
  Redirects logged-in users to `/dashboard`. Its `metadata` is engineer-facing only.
- `src/app/_components/landing-tabs.tsx` (590 lines) — `useState<Tab>` toggling
  `EngineersContent()` (line 240) and `LandlordsContent()` (line 458).

Because it's client state, the landlord content has **no URL, no deep link, no own `<title>` or
description, and cannot be linked from an outreach email or indexed separately.** If you want to
send agents to a page, you are building a route regardless.

**Reusable as-is**

| Asset | Path |
|---|---|
| Header + footer chrome | `src/app/_components/marketing-chrome.tsx` (75 lines) |
| Section patterns: centred hero, icon+title+body benefit cards, numbered step list, dark pricing card, closing CTA | `landing-tabs.tsx` — copy the JSX shapes |
| Inline SVG icon components | `landing-tabs.tsx:8-128` — self-contained, no icon library |
| Design tokens (`--color-*`, `--brand`, `--color-action`) | `src/app/globals.css`, documented in `DESIGN_TOKENS.md` |
| Metadata + noindex pattern | `src/app/free-cp12/page.tsx:9-16` (see Q8) |
| Blog CTA component referenced as `<ArticleCTA variant="landlord" />` | `src/components/blog/` |

**Landlord-specific, needs rewriting**

- `landlordBenefits` (lines 130–156) and `landlordSteps` (158–171). Every line is possessive —
  "your engineer", "your property", "your permanent link", "You enter the property, tenant and
  access details yourself". An agent does not own the property and does not want a link *per*
  property.
- The closing CTA "Ready to get your property compliant?" → `/request`, plus the false "Open it
  here" link noted in Q2.

**One layout warning:** the whole landing page is built at phone width — `px-5`, text blocks capped
at `max-w-[300px]`–`max-w-[330px]`, full-width stacked buttons. It has no desktop breakpoints. A
B2B page that letting agents will open on an office desktop will look like a stretched mobile app
if you copy the sections verbatim.

**Verdict:** *Reusable with changes* — chrome and section patterns yes, copy no, layout needs
desktop treatment.

**Effort:** a standalone `/letting-agents` route reusing the chrome and card patterns, with a
capture form: **half a day to a day** of build, plus however long the copy takes you.

---

## Existing primitives

### 5. How does the free CP12 tool's form submit, and what should a new public form reuse?

**What exists** — `src/app/free-cp12/_components/free-cp12-form.tsx` (1341 lines).

- **No form library.** Plain `useState` (line 177 onwards) holding one `FreeCp12Payload` object.
  `react-hook-form` + `@hookform/resolvers` **are** in `package.json` and **are** used — but only
  inside the authenticated wizard (`src/app/(wizard)/.../*-client-step.tsx`,
  `src/components/job-wizard/*`, `src/components/new-job-modal.tsx`). No public page uses RHF.
- **Two `fetch` calls to route handlers**, not server actions:
  - `POST /api/free-cp12/generate` — renders a preview PDF, writes nothing
    (`src/app/api/free-cp12/generate/route.ts`).
  - `POST /api/free-cp12/download` — the email wall
    (`src/app/api/free-cp12/download/route.ts`, 165 lines).
- The email step is a native `<form onSubmit={handleDownload}>` (line 622) with a single
  `<Input type="email" required>` and a submit `<Button>`.
- **Validation is server-side zod**, mirrored by a client-side `localIssues` list. Schemas:
  `FreeCp12PayloadSchema` (`src/lib/cp12/freeCp12Payload.ts`), `DownloadSchema` (route line 20).
  Errors come back as `{ error, issues[] }` and render as a red `role="alert"` paragraph.

**Compare: the request form** (`request-job-client.tsx`) uses the *other* pattern — a `'use server'`
server action with zod parsing inside it (`src/server/job-requests.ts`), `useTransition` for pending
state, and `toUserMessage()` (`src/lib/user-errors.ts`) to stop raw errors reaching users.

**What a new public capture form should reuse**

| Reuse | Path |
|---|---|
| `Input`, `Button`, `Textarea`, `Select`, `Badge`, `useToast` | `src/components/ui/` |
| `AddressLookupField` — debounced autocomplete against `/api/address-search`, with graceful degradation to manual entry | `src/components/address/address-lookup-field.tsx` (245 lines) |
| `toUserMessage()` — never leak raw errors to a public page | `src/lib/user-errors.ts` |
| Rate limiting | `assertPublicActionAllowed` / `consumePublicActionRateLimit`, `src/lib/public-action-security.ts` |
| Email sending | `sendEmail` + `isEmailConfigured`, `src/lib/resend.ts`; layout helpers in `src/lib/email-templates.ts` (`baseEmail`, `emailTitle`, `infoCard`, `ctaButton`, `note`) |
| Analytics | `ANALYTICS_EVENTS` in `src/lib/analytics/events.ts` — note the explicit no-PII rule in its header comment |
| Error reporting | `Sentry.captureException` with `tags: { area: ... }`, as in `src/server/free-cp12.ts:74-79` |

**Verdict:** *Reusable as-is.* Recommend the **server action + zod** shape (mirror
`src/server/job-requests.ts`) rather than the route-handler shape — you don't need the free tool's
two-phase generate/download split for a capture form.

**Effort:** a validated, rate-limited agent capture form on top of these primitives: **3–4 hours.**

---

### 6. Existing public unauthenticated forms, and how they handle spam

**What exists** — every public write path in the app:

| Surface | Path | Protection |
|---|---|---|
| `/request`, `/request/[slug]` | `src/server/job-requests.ts:733-750` | 5/IP/hour + 10/engineer/24h |
| `/p/[token]` renewal | `src/server/public-property.ts:209-221` | 10/IP/hour + 3/token/24h |
| `/j/[token]` renewal | `src/server/public-job.ts:320-331` | 10/IP/hour + 3/token/24h |
| `/j/[token]` landlord email capture | `src/server/public-job.ts:275-286` | 10/IP/hour + 3/token/24h |
| `/free-cp12` generate | `src/app/api/free-cp12/generate/route.ts` | 30/IP/hour (in-memory **and** durable) |
| `/free-cp12` download | `src/app/api/free-cp12/download/route.ts` | 10/IP/day + 5/email/day + a DB row count |
| `/free-boiler-service` | same shape | same shape |
| `/free-gas-rate` | `src/app/free-gas-rate/` | calculator, captures nothing |
| `/prefill/[jobId]` | `src/server/jobs.ts:876` | token-gated with `prefill_token_expires_at` |
| `/sign/cp12/[token]` | `src/server/certificates.ts` | token with expiry/completed states |

**Spam handling: rate limits only. Nothing else.**

- The durable limiter is `src/lib/public-action-security.ts` + the Postgres function
  `consume_public_action_rate_limit` (`supabase/migrations/20260729213157_public_action_rate_limits.sql`,
  fixed by `20260729214703`). It HMACs the identifier before storage (no raw IPs or emails in the
  DB), takes an advisory lock per bucket, and **fails closed** — if the RPC errors the action is
  refused, not allowed.
- **No honeypot. No captcha. No Turnstile/hCaptcha/reCAPTCHA. No Vercel BotID.** I grepped the
  whole repo: the only matches are commented-out captcha config in `supabase/config.toml` (Supabase
  Auth, not the app forms).
- Secondary defences that exist by accident: zod `max()` lengths on every field, `.email()`
  validation, and `X-Robots-Tag: noindex` on free-tool responses.

**One thing to know before you rely on IP limits for agents:** the identifier is the first
`x-forwarded-for` address (`publicActionClientIdentifier`, line 35). A letting agency office shares
one egress IP, so all their staff share one bucket.

**Verdict:** *Reusable as-is* — the rate limiter is well built and is the right primitive. If the
agent page will be publicly indexed and outreach-linked, a honeypot field is ~20 minutes of work
and worth adding, since the rate limit alone won't stop a low-volume form-spam bot from filling
your enquiry table.

---

### 7. Is there a path for sending you an internal notification email?

**No. This is new work.**

**What exists**

- `sendEmail()` — `src/lib/resend.ts` (120 lines). Direct `fetch` to the Resend API, 15s timeout,
  returns `sent | not_configured | failed`, supports attachments and `replyTo`. Configured by
  `RESEND_API_KEY` + `EMAIL_FROM`.
- HTML layout helpers — `src/lib/email-templates.ts` (`baseEmail`, `emailTitle`, `emailSubtitle`,
  `infoCard`, `ctaButton`, `benefitList`, `note`, `formatDate`, `titleCase`).
- A `sendEmailSafely()` wrapper duplicated in three places (`job-requests.ts:302`, `jobs.ts:434`,
  `invoices.ts:117`) — logs failures instead of throwing.

**Every single `sendEmail` call in the codebase targets an engineer, a landlord/tenant, or the
free-tool visitor.** There is no admin or internal recipient anywhere. `ADMIN_EMAILS` exists
(`src/server/mission-control.ts:14`, defaulting to `kelvinhospodarz@gmail.com`) but it is purely an
**allowlist for viewing `/admin`** — it is never used as a `to:` address.

Separately: `docs/outreach-automation-workflow.md` (1254 lines) documents a full outreach system —
but it is Google Places + Airtable + Make + Gmail, entirely **outside** this application. Nothing
in the app writes to it.

**Verdict:** *Doesn't exist.*

**Effort:** ~1 hour to send yourself a notification on enquiry (`sendEmail` + an `ENQUIRY_NOTIFY_EMAIL`
env var; reuse `infoCard` for the body). Add ~1 hour to also surface enquiries as a panel on
`/admin`, which is where you'll actually want them once the volume is more than a handful — the
mission-control pattern for that is already established in `src/server/mission-control.ts`.

---

### 8. How are static/marketing pages structured, and is there a noindex/feature-flag pattern?

**Structure.** Next.js 15 App Router, React 19, Tailwind v4. Marketing pages are plain server
components under `src/app/` with no route group: `/`, `/free-tools`, `/free-cp12`,
`/free-boiler-service`, `/free-gas-rate`, `/blog`, `/legal/privacy`, `/request`. Shared chrome
comes from `src/app/_components/marketing-chrome.tsx`.

**Metadata** is per-page `export const metadata: Metadata`. The fullest example is
`src/app/blog/page.tsx:7-28` (title, description, canonical, OpenGraph with `locale: 'en_GB'`,
Twitter card). The simplest is `src/app/free-cp12/page.tsx:9-16`.

**Blog content** is MDX in `content/blog/*.mdx`, read by `src/lib/blog.ts` with `gray-matter`
frontmatter (`title`, `description`, `date`, `slug`, `author`, `tags`, `faq`) and rendered via
`next-mdx-remote`. `getAllPosts()` feeds both `/blog` and `sitemap.ts`.

**The noindex flag pattern — this is the good bit, and it is exactly what a soft-launched agent
page should copy.**

- One boolean constant per tool, with the reasoning in the comment beside it:
  `src/lib/cp12/free-tool.ts:24` → `export const FREE_CP12_NOINDEX = true;`
  (also `src/lib/boiler-service/free-tool.ts`, `src/lib/gas-rate/free-tool.ts`).
- A single catalogue reads them: `src/lib/free-tools.ts` — `FREE_TOOLS`, `indexableFreeTools()`,
  `noindexedFreeToolRoutes()`, and `FREE_TOOLS_HUB_NOINDEX` (the hub hides itself when every tool
  is hidden).
- Three consumers can't drift: the page's own `metadata.robots` (`free-cp12/page.tsx:15`),
  `src/app/robots.ts` (disallow list), and `src/app/sitemap.ts` (only indexable tools).

**There is no general feature-flag system.** No LaunchDarkly, no flags table, no `NEXT_PUBLIC_FLAG_*`
convention. Environment-driven toggles exist only for infrastructure —
`ADDRESS_LOOKUP_ENABLED` / `DISABLE_ADDRESS_LOOKUP` and `NEXT_PUBLIC_SHOW_DEMO_AUTOFILL`
(see `.env.local.example`). Page visibility is done with the code constants above, which means
flipping one is a deploy.

**Verdict:** *Reusable as-is.* Add an `AGENT_PAGE_NOINDEX` constant in its own module and wire it
into page metadata + `robots.ts` + `sitemap.ts` the same way. **~1 hour.**

---

### 9. What tables exist in Supabase, and where does an agent-enquiry table sit?

**Caveat first: I could not verify the live schema.** Three sources disagree, and none of them is
authoritative:

- `supabase/migrations/` — 40+ files, but **incomplete**: `invoices`, `invoice_line_items`,
  `reminders`, `signatures`, `photos`, `job_sheets` and `usage_counters` are queried by code
  and/or typed, and have **no `create table` migration in this repo**.
- `src/types/supabase.ts` — **stale**: it has no `properties`, `job_requests`, `free_tool_leads`,
  `cp12_appliances` or `public_action_rate_limits`. `src/server/mission-control.ts:22-23` says so
  in a comment: *"the generated Database types lag behind the live schema"*.
- `docs/supabase-snapshot.md` — reports itself empty as of 2024-12-24.

**Tables with a `create table` in migrations:** `certificates`, `certificate_usage`, `clients`,
`cp12_appliances`, `fga_readings`, `free_tool_leads`, `job_code_counters`, `job_fields`,
`job_files`, `job_items`, `job_photos`, `job_records`, `job_requests`, `jobs`, `profiles`,
`properties`, `public_action_rate_limits`, `report_deliveries`, `reports`, `template_items`,
`templates`.

**Additionally referenced in code or types (live but unmigrated here):** `invoices`,
`invoice_line_items`, `reminders`, `signatures`, `photos`, `job_sheets`, `contacts`,
`usage_counters`.

**Where a new table sits.** `agent_enquiries` (or `letting_agent_enquiries`) collides with nothing
in either list. The precedent to copy is `free_tool_leads`
(`supabase/migrations/20260727120000_free_tool_leads.sql`), which is the closest analogue — a
public, unauthenticated capture table:

- Minimal columns, `source text not null default '...'` for attribution, `created_at`.
- An index on `(identifier, created_at desc)` supporting a per-identity cap.
- **`enable row level security` with no policies at all** — unreachable from `anon` and
  `authenticated`; only the service role writes, from the server. The migration comment spells out
  why. Do the same.
- Its own header comment states the boundary it must not cross. Worth imitating.

**Verdict:** *Doesn't exist, no collision risk.* **~1 hour** for the migration; longer only if you
want it visible in `/admin`.

One related note: whoever regenerates `src/types/supabase.ts` should do it before adding a table,
or the drift gets worse.

---

## Content

### 10. Existing material on legally-required CP12 fields / Regulation 36

**There is a substantial amount, and it is better than I expected.** Five distinct sources, quoted
below.

**a) `audit/cp12-field-analysis.md:35`** — the one-line statement of the legal minimum:

> The landlord gas-safety record must contain the matters in Gas Safety (Installation and Use)
> Regulations 1998, Regulation 36(3)(a)–(i): check date, premises address, landlord/agent name and
> address, appliance/flue description and location, defects, remedial action, Regulation 26(9)
> confirmation, engineer name and signature, and Gas Safe registration number.

and at line 37:

> The refactor distinguishes these tier-one issue blockers from conventional detail (for example
> readings, CO alarms, next inspection date, business contact fields and customer acknowledgement)
> and optional notes.

**b) `tests/free-cp12-reg36-compliance.test.ts`** — the richest CP12-specific mapping in the repo.
Its header (lines 10–18):

> Gas Safety (Installation and Use) Regulations 1998, Reg 36(3)(a)–(i) — the prescribed minimum
> content of a landlord gas safety record, as set out in audit/cp12-field-analysis.md.
>
> The free tool issues a real statutory document to people with no account and no support contract,
> so each item is asserted to actually block issue rather than assumed to be covered by the shared
> validator.

and the test names give an item-by-item breakdown (lines 77–159):

> `(a) date of the check` · `(b) address of the premises` · `(c) name of the landlord or agent` ·
> `(c) address of the landlord or agent` · `(c) landlord address is never inferred from the property
> address` · `(d) description of each appliance` · `(d) location of each appliance` · `(d) at least
> one appliance must be recorded` · `(e) defect must be recorded when an appliance is unsafe` ·
> `(f) remedial action must be recorded when an appliance is unsafe` · `(g) Regulation 26(9)
> confirmation, per appliance` · `(g) confirmation is required for every appliance, not just the
> first` · `(h) engineer name` · `(h) engineer signature` · `(i) Gas Safe registration number`

**c) `src/lib/cp12/field-config.ts`** — the machine-readable tiering. Everything marked
`tier: 'tier_one'` is the legal minimum: `inspection_date`, `property_address`, `landlord_name`,
`landlord_address` ("Landlord or agent correspondence address"), `engineer_name`,
`gas_safe_number`, `engineer_signature`, `reg_26_9_confirmed`, `appliance_description`,
`appliance_location`, `defects`, `remedial_action`. `customer_signature` is explicitly
`tier_two` — and `src/lib/cp12/validation.ts:60-62` explains why:

> Customer / received-by signature is optional by default (HSE: only the engineer must sign).

**d) `content/blog/what-is-a-cp12.mdx:108-126`** — publish-ready prose under the heading "What must
be on the certificate":

> The regulations set out the minimum information a CP12 must contain. A valid record includes:
> the **date** the check was carried out · the **address** of the property · the **landlord's name
> and address** (or the letting agent's, where the agent manages) · a description and **location of
> each appliance and flue** checked · the **results of the check** for each appliance, including any
> safety defect identified and the **action taken** to fix it · confirmation that the check covered
> the matters the regulations require (combustion, ventilation, flue operation, safety devices) ·
> the **name, registration number and signature** of the engineer who did the check
>
> A missing landlord address or an unrecorded appliance can render the record useless as evidence of
> compliance, even though a check physically happened.

The same file at lines 53–61 covers the three Reg 36 duties (annual check / keep the record two
years / copies to tenants within 28 days and to new tenants before move-in), and lines 165–167
speak directly to your audience:

> If your agent manages the property, confirm in writing who sends copies to tenants and who stores
> the records. "I assumed the agent had it" is one of the most common ways a landlord ends up unable
> to produce a certificate when it matters.

**Two warnings on this file.** It contains an unresolved review comment at line 137:

> `REVIEW (Kelvin): Renters' Rights Act / possession claims — I have deliberately kept the paragraph
> below vague. Before publishing, verify what the current post-May-2026 position is on gas safety
> records and possession proceedings (the old rule tied a valid gas safety record to serving a
> Section 21 notice; Section 21 was abolished from 1 May 2026 and I have NOT stated what replaced
> it). Rewrite or delete.`

And I could not determine from the repo whether this post is live — it will be in the sitemap if
`getAllPosts()` picks it up, which it does for everything in `content/blog/`.

**e) The sibling audits, for the other two documents.** `audit/gas-warning-notice-field-analysis.md`
and `audit/gas-service-field-analysis.md` both carry **full field-by-field tables with a source
column and a (1) required / (2) conventional / (3) optional legend**, citing GSIUR Reg 26(9),
Reg 3, RIDDOR 2013 Reg 6(2), IGEM/G/11 GIUSP, HSE OC 440/37 and Benchmark, with legislation.gov.uk
links. Both open by contrasting themselves with the CP12:

> Unlike the CP12 (whose minimum content is *prescribed* by statute — GSIUR 1998 Reg 36(3)), the
> warning notice **is not a statutory form**.

**The asymmetry to know about:** the CP12 audit — the one you actually need for the checklist page
— is the *only* one of the three **without** a per-field table and without a sources table. Its
legal content is the single paragraph quoted at (a). The other two are far more rigorous. If you
want the checklist page to cite sources per field, that work has been done for the warning notice
and the service record, and **not** for the CP12.

**Verdict:** *Reusable with changes.* The substance exists across five files and one blog post is
already 80% of the page. It needs consolidating into one public artefact and it needs source
citations at CP12 field level, which don't currently exist.

**Effort:** half a day to assemble the page from (b)+(c)+(d); add time if you want per-field
legislation.gov.uk citations to CP12 fields at the standard of the other two audits.

---

## Before you brief a build

**1. The request page cannot be the agent channel, and the reason is prosaic: 5 per IP per hour.**
Everything else about it — one property per submission, no memory between submissions, no status
view, a mandatory named engineer — makes it a landlord tool. If outreach lands agents on `/request`
they will bounce off it at property three. Brief the agent page as a *capture* form (name, agency,
portfolio size, email) that lands in a table and emails you, and keep it entirely separate from the
request flow.

**2. There is nothing above a property in the data model, so don't promise agents a portfolio view.**
`clients` is the engineer's customer row, scoped by `user_id` and RLS'd to them. One agent working
with three engineers is three unrelated rows. A genuine agent-facing view of many properties cuts
across the ownership model the whole app is built on — that is a foundational piece of work, not
something the capture page can quietly imply. Make sure the landing copy promises only what exists.

**3. The primitives you need for the two pages are all there; the gaps are small and known.**
Metadata + noindex flag pattern (`src/lib/free-tools.ts`), rate limiting
(`src/lib/public-action-security.ts`), UI components, address lookup, `sendEmail`, and a capture-table
precedent (`free_tool_leads`). The only genuinely new pieces are (a) an internal notification email —
about an hour — and (b) the table. Both pages together are realistically **1–2 days**, most of it
copy and content assembly rather than plumbing.

### Things you may have assumed that the code doesn't support

- **"The tokenised link is time-limited."** It isn't. `/p` and `/j` tokens never expire and can't be
  revoked; only the PDF download URLs inside them are 1-hour signed URLs, re-minted each visit.
  Forwarding one grants permanent access to the certificates, the tenant name and the engineer's
  phone and email.
- **"There's a landlord landing page I can copy."** It's a `useState` tab on `/` with no URL, no own
  metadata, and no desktop layout. You're building a route either way.
- **"The form already handles agents — the copy says 'landlord or agent'."** The copy does; the data
  model doesn't. Every column is `landlord_*`, there is no field for the actual landlord behind the
  agent, and the "Company (optional)" input the agent would type their agency into is collected by
  the UI and **never sent to the server** (`request-job-client.tsx:96, 450` vs `handleSubmit`
  lines 266–287). That's a live bug.
- **"An existing enquiry/notification path just needs pointing at me."** There is none. No email in
  the app has ever been sent to an internal address; `ADMIN_EMAILS` only controls who can *view*
  `/admin`.
- **"The CP12 legal-content work is done."** It is done to a high standard for the *Gas Warning
  Notice* and the *service record*, and to one paragraph for the CP12. Also note
  `src/lib/cp12/free-tool.ts:15-22`: the free CP12 is deliberately `noindex` because *"the Gas Safe
  sign-off it was originally gated on"* is not complete, and `applianceConfig.ts` still carries
  `NEEDS GAS-SAFE VALIDATION` notes. A public "what a gas safety record must legally contain" page
  is a stronger claim than the free tool currently makes about itself — decide whether it ships
  before or after that sign-off.
  *(Superseded 2026-07-31: indexing was enabled, the sign-off is no longer being sought, and those
  notes are now `GAS-SAFE REVIEW` records of accepted risk. Left as written for the audit record.)*

### Broken / wasteful things noticed in passing (not fixed, per the brief)

- `landlordCompany` collected and dropped — `src/app/request-job/request-job-client.tsx:96, 450`
  vs `handleSubmit` lines 266–287.
- `landlordHasMultipleJobs` — computed at `src/server/public-job.ts:66, 260` at the cost of two
  extra Supabase queries per public job page load, and read nowhere in `src/` or `tests/`.
- The landlord tab's "Open it here" link points at `/request`, not at any property-link lookup —
  `src/app/_components/landing-tabs.tsx` (TODO comment in the closing CTA).
- `src/types/supabase.ts` is materially out of date (missing `properties`, `job_requests`,
  `free_tool_leads`, `cp12_appliances`, `public_action_rate_limits`); `docs/supabase-snapshot.md`
  is empty and self-describes as needing a refresh since 2024-12-24.
- Several tables the app queries (`invoices`, `invoice_line_items`, `reminders`, `signatures`,
  `photos`, `job_sheets`) have no `create table` migration in `supabase/migrations/`.
- `sendEmailSafely()` is copy-pasted in three modules (`job-requests.ts:302`, `jobs.ts:434`,
  `invoices.ts:117`).
