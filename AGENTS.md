# Repository Guidelines

## Project Structure & Module Organization
- `src/app/`: Next.js app router entry points, layouts, routes, and server actions.
- `src/components/` & `src/hooks/`: Reusable UI and client-side hooks; prefer colocated styles per component.
- `src/lib/`: Utilities, API clients, validation, and helpers shared across pages.
- `src/server/`: Server-only logic (Supabase helpers, PDFs, external APIs); keep fetchers and mutations here.
- `src/types/`: Shared TypeScript types and schemas.
- `public/`: Static assets served at the root.
- `tests/`: Vitest suites (e.g., `tests/server-actions.test.ts`) covering server actions and utilities.
- `supabase/` and `scripts/`: Supabase config and DevOps helpers (includes a legacy mobile tunnel script if ever needed).

## Agent Responsibilities
- AuthAgent: Handles login (password + magic link), password reset, password change, and signup wizard. Routes: `/login`, `/forgot-password`, `/reset-password`, `/signup/step1-3`. Server actions: `signInWithPassword`, `signInWithMagicLink`, `userHasPassword`, `changePassword`, `requestPasswordReset`, `applyPasswordReset`, `completeSignupWizard`.
- SignupAgent: Owns multi-step signup under `src/app/(auth)/signup` (steps: account details, personal/professional details, trade/cert selection) using shadcn UI and zod validation; finalizes via `completeSignupWizard` (auth signUp + profile upsert, onboarding_complete=true) then redirects to `/dashboard`.
- TemplateAgent: Filters templates by `profiles.trade_types` or `is_general`, keeps template metadata (`is_general`, `trade_type`) in sync, and wires template pickers/lists to those rules.
- ProfileAgent: Maintains `profiles` table fields (`trade_types`, `certifications`, `onboarding_complete`, personal basics) via `src/server/profile.ts`, enforces guards in `RequireAuth` (redirects incomplete users to `/signup/step1`).
- JobRequestAgent: Owns landlord-submitted work requests from public property links (`/p/[public_token]`). It validates the landlord form (`tenant_name`, `tenant_phone`, `access_notes`, `preferred_dates`), classifies requests as `request_type = 'new_job'` or `request_type = 'renewal'`, creates `job_requests` rows, triggers engineer notification, and keeps request status moving through `pending -> scheduled -> completed -> dismissed`.
- JobContextAgent: Produces the clean prefill payload for `/jobs/new` and downstream certificate wizards by merging context from the job request, property record, previous jobs/certificates, landlord/client record, and engineer profile. It must preserve manual `/jobs/new` behavior when no request exists.
- AutofillAgent: Reduces repeated data entry across jobs, certificates, and invoices. It autofills engineer company details, Gas Safe number, saved engineer signature where available, property address, landlord/client details, tenant/access notes from job requests, and eventually previous appliance data.
- CertificateAgent: Focuses on certificate validation, PDF generation, certificate storage, signed URLs, and certificate lifecycle side effects. It should not be responsible for gathering landlord/request data; it consumes normalized context prepared by JobContextAgent/AutofillAgent.

## Architecture Overview
- Next.js App Router with mixed server/client components; pages and layouts live in `src/app`.
- Data flows through server actions in `src/app` and shared helpers in `src/server`; keep Supabase clients server-side except for SSR helpers in `src/lib`.
- Client UI pulls typed data via props; shared types in `src/types` keep server/client contracts aligned.
- Styling uses Tailwind (`tailwind.config.ts`); components favor utility-first classes over bespoke CSS.
- Production is intended to run on Vercel behind the custom domain `certnow.uk`; Vercel preview URLs remain useful for test deployments. Keep `NEXT_PUBLIC_SITE_URL` aligned with the exact public origin used for OAuth callbacks.
- Product direction is property-first and link-based: properties hold long-term compliance history, jobs are execution events at a property, and landlords can request work from public property links while engineers can still create jobs manually.
- Core model: Property = long-term compliance anchor; Job = one execution event at a property; Job Request = landlord-submitted request for work; Engineer Profile = reusable engineer/company identity for autofill.
- Every job must have a random, unguessable `jobs.public_token` generated at creation time. Public landlord/job routes must resolve by token, never by internal UUID.
- App navigation remains engineer-first operationally: `/dashboard` is the operational home, `/jobs/new` must always support manual engineer-created jobs, `/clients` remains useful for customer history, and `/jobs/[id]` is treated as an execution record with related client/property/certificate/invoice context.
- Document preview is canonical at `/jobs/[id]/pdf` (legacy report/pdf routes should redirect here); saved documents live under `/documents` and use Supabase signed URLs.
- External integrations: Supabase (auth/storage), PDF generation via `pdf-lib`, address lookup via Ideal Postcodes, and transactional email via Resend; isolate integration code under server/API routes.
- Job sheet scan/QR flows have been removed from the active product. Do not reintroduce QR scanning or drag-and-drop interactions without a clear mobile-field use case.
- Cross-certificate links: CP12 can deep-link to Gas Warning Notice using the same jobId; Gas Warning Notice may prefill from CP12 job fields and appliances when available.

## Property-First Job Model
- Property is the long-term compliance anchor. It should own the public landlord link, compliance history, reminder eligibility, job request history, and future certificate history. Current job address/client structures must remain compatible while the property model is introduced.
- Job is one execution event at a property. Examples include CP12, boiler service, gas warning notice, general works, and commissioning. Jobs should be linkable to `property_id` and optionally to `job_requests.id` when created from a landlord request.
- Job Request is a landlord-triggered request to create work. It is not itself a job or certificate; it becomes scheduled work only when the engineer accepts/schedules it into `/jobs/new`.
- Engineer Profile is the persistent identity used to avoid repeated entry: company details, engineer name, Gas Safe number, ID card number, phone, default signature, and invoice/company defaults.
- Landlord/client records remain important for contact, billing, and portfolio context, but compliance status should be anchored to the property rather than duplicated across individual jobs.

## Job Creation Entry Points
- Engineers must retain manual job creation via `/jobs/new` at all times. This flow is used for work received by phone, WhatsApp, email, repeat clients, urgent visits, or any situation where no landlord request exists. The job request system must not replace or block this flow.
- Landlord new job request is used when a landlord requests work for a property with no existing CertNow CP12/certificate history. It should create `job_requests.request_type = 'new_job'` and flow into `/jobs/new` with medium prefill.
- Landlord renewal request is used when a landlord requests work for an existing property with previous CP12/certificate history, especially where a certificate is due soon, within 60 days of expiry, or expired. It should create `job_requests.request_type = 'renewal'` and flow into `/jobs/new` with high prefill.
- All three entry points converge into `/jobs/new`: manual engineer-created job = low/no prefill; new job request = medium prefill; renewal request = high prefill. Prefill should never remove the engineer’s ability to edit before creating the job.

## Public Property Links
- Each property should have a public route `/p/[public_token]`. This route must never require login.
- The page should show property address, current compliance/certificate status, latest certificate expiry date if available, engineer name and Gas Safe number, and a certificate download button if a certificate is available for public sharing.
- CTA logic: if there is no previous CP12/certificate history, show `Request Gas Safety Check`; if there is previous CP12/certificate history and the certificate is due or expired, show `Request Renewal`.
- Both CTAs use the same small landlord form. The form must have four fields maximum: `tenant_name`, `tenant_phone`, `access_notes`, and `preferred_dates`.
- Do not ask landlords to re-enter property address, landlord name, landlord contact, or engineer details on the public form. Those should come from property/client/engineer records where possible.
- Public tokens must be random, unguessable, and scoped to the property. Public routes should expose only landlord-safe property/certificate data and must not expose internal UUIDs, private notes, service-role URLs, or unrelated client history.

## Job Request Schema Direction
- Use one broad table called `job_requests`, not a `renewal_requests`-only table.
- Current schema direction includes property/job source context, optional assigned engineer, standalone public requests, and request scheduling:
```sql
CREATE TABLE job_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID,
  source_job_id UUID REFERENCES jobs,
  scheduled_job_id UUID REFERENCES jobs,
  user_id UUID REFERENCES auth.users,
  assigned_engineer_id UUID REFERENCES auth.users,
  request_type TEXT NOT NULL, -- 'new_job' or 'renewal'
  source TEXT DEFAULT 'public_job_page',
  job_type TEXT NOT NULL DEFAULT 'cp12',
  landlord_name TEXT,
  landlord_email TEXT,
  landlord_phone TEXT,
  property_address TEXT,
  property_postcode TEXT,
  tenant_name TEXT,
  tenant_phone TEXT,
  access_notes TEXT,
  preferred_dates TEXT,
  engineer_name TEXT,
  engineer_company TEXT,
  engineer_email TEXT,
  engineer_phone TEXT,
  engineer_gas_safe_number TEXT,
  landlord_confirmation_status TEXT,
  engineer_notification_status TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
```
- Status lifecycle: `pending -> scheduled -> completed -> dismissed`.
- When a landlord submits the form, create a `job_requests` row, classify it as `new_job` or `renewal`, notify the engineer via Resend, and show it on the engineer dashboard.
- When an engineer creates a job from a request, link the job to `job_requests.id` and update the request status to `scheduled`.
- Public standalone landlord requests live at `/request-job`. Do not expose a public engineer directory by default. Landlords enter the engineer they already want to contact: name, company, email, phone, and Gas Safe number if known. CertNow stores the request and sends confirmation/engineer emails when email delivery is configured.

## Email Sending Policy
- CertNow owns the sending infrastructure for product emails. Transactional messages should send from a CertNow-controlled sender such as `notifications@certnow.uk` or `general@certnow.uk`, using Resend or the configured provider.
- Emails should still feel like they come from the engineer relationship. Include the engineer/company name prominently in subject/body copy where relevant, and set `Reply-To` to the engineer/company email when available so landlord replies go to the engineer, not CertNow support.
- Do not send directly from arbitrary engineer email addresses in the MVP. Per-engineer sender domains create SPF/DKIM/domain-verification and deliverability support burden. Treat custom sender domains as a future paid/advanced feature.
- For landlord request, job completion, certificate, invoice, and reminder emails, CertNow is the system sender and the engineer is the represented service provider. Copy should say or imply `Sent on behalf of [Engineer / Company]` where that context matters.
- Email links should point to stable CertNow routes: `/jobs/new?requestId=...` for engineer request acceptance and `/j/[publicToken]` for landlord-safe job/certificate views. Avoid exposing internal UUIDs in public landlord links.

## Security Boundaries
- Any module that reads private environment variables (`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) must stay server-only and include `import 'server-only';` unless it is a top-level Next server action file with `'use server'`.
- Current guarded secret-bearing utilities: `src/lib/env.ts`, `src/lib/openai.ts`, `src/lib/reporting.ts`, `src/lib/supabaseServer.ts`, and `src/server/pdf/renderCp12Certificate.ts`.
- Do not import private server utilities directly into client components. Client components may import server actions from `'use server'` modules, but those actions must validate the authenticated user and resource ownership before using service-role clients.
- `supabaseServerServiceRole()` bypasses RLS. Use it only in server actions, route handlers, or server-only helpers after confirming the current Supabase user is allowed to access the job/client/certificate being read or mutated.
- Never expose, serialize, log, or return private keys or key-presence checks. `NEXT_PUBLIC_*` values are public and must not contain secrets.
- Before real customer rollout, audit RLS policies and storage bucket rules for at least `profiles`, `properties`, `job_requests`, `clients`, `jobs`, `job_fields`, `certificates`, `invoices`, `documents`, `reports`, and certificate storage buckets.
- Public property routes (`/p/[public_token]`) must be deliberately unauthenticated but data-minimized. Use the token to resolve only landlord-safe fields, never service-role URLs or unrelated customer/job history.

## PDF Generation
- Field reports: `src/lib/reporting.ts` builds PDFs with `pdf-lib`; `src/server/jobs.ts` loads photos/signatures, optionally AI-summarizes via OpenAI (`getOpenAIClient` and `OPENAI_API_KEY`), then uploads to the Supabase `reports` bucket and stores `reports` rows.
- Certificates: `src/server/certificates.ts` orchestrates Supabase service-role writes (public.certificates/jobs/job_fields) and storage uploads to the `certificates` bucket (preview vs final), then returns signed URLs; no external PDF API is used.
- CP12 / Gas Safety (AcroForm): `src/server/pdf/renderCp12Certificate.ts` loads `src/assets/templates/cp12-template.pdf`, reads AcroForm field names, and fills them via `Cp12FieldMap` + `ApplianceInput`. Step 1 mappings now drive PDF blocks explicitly:
  - Job Address: `job_address.name`, `job_address.address_line_1/2/3`, `job_address.post_code`, `job_address.tel_no` from `job_address_name`, `job_address_line1`, `job_address_line2`, `job_address_city`, `job_postcode`, `job_tel`.
  - Customer/Landlord: `customer.name`, `customer.company`, `customer.address_line_1/2/3`, `customer.post_code`, `customer.tel_no` from `landlord_name`, `landlord_company`, `landlord_address_line1`, `landlord_address_line2`, `landlord_city`, `landlord_postcode`, `landlord_tel` (with legacy fallback from `landlord_address` when structured fields are missing).
  - It combines defect/remedial/notes into `comments.comments`, keeps targeted safety checkbox handling for the four `safety_checks.*` fields, and embeds signatures using detected widget placement where possible with fixed page-0 fallback boxes when dedicated signature fields are absent.
  - If appliance form fields are missing, it draws appliance rows at fixed XY positions and copies template pages as needed.
  - It updates field appearances with Helvetica and leaves fields editable (no flatten).
- CP12 / Gas Safety (drawn layout): `src/lib/pdf/cp12-template.ts` is a legacy/manual renderer that draws its own layout and writes text at coordinates (used by some dev routes).
- Gas Warning Notice: `src/server/pdf/renderGasWarningNoticePdf.ts` loads `src/assets/templates/gas-warning-notice.pdf`, fills AcroForm fields when present, and falls back to XY text drawing if the template is not form-enabled. Signature URLs are drawn into the signature boxes when available.
- Boiler Service Record: `renderGasServiceRecordTemplatePdf` in `src/lib/pdf/gas-service-template.ts` draws its own layout; wrappers `renderBoilerServicePdf`/`generateBoilerServiceRecordPdf` map certificate fields then call the renderer.
- General Works: `renderGeneralWorksPdf` in `src/lib/pdf/general-works.ts` handles the general_works branch with targeted logging around Supabase certificate/job/job_fields writes to surface RLS failures.

## Build, Test, and Development Commands
- `pnpm dev`: Run dev server (Turbopack); access via LAN/DNS from phones on the same network.
- `pnpm build`: Production build.
- `pnpm start`: Run the compiled build locally.
- `pnpm lint`: ESLint over the repo; fixes style and catches dead imports.
- `pnpm test`: Vitest test suite; add `--runInBand` when debugging server actions.
- Dependency integrity matters: this is a Next 15 app (`next` must remain `15.5.7` unless intentionally upgraded). If Turbopack reports `Next.js package not found` or `next.config.ts is not supported`, check for an accidental old Next install or `package.json` drift before changing app code.

## Coding Style & Naming Conventions
- TypeScript + React 19 + Next.js app router; prefer functional components.
- Components, hooks, and types use `PascalCase`; files are `kebab-case.tsx|ts`.
- Keep server-only modules in `src/server` and avoid importing them into client components. Secret-bearing helpers must also use `import 'server-only';`.
- Follow ESLint (Next + TypeScript) defaults; use 2-space indentation and trailing commas per lint rules.
- Co-locate schemas (zod) and validation with their feature; reuse from `src/lib` for cross-cutting concerns.
- Primary CTAs use the `--action` green; secondary actions use brand/neutral blues. Favor rounded-xl, subtle shadows, and mobile-first spacing.

## Auth & Onboarding
- Auth supports Google OAuth, magic-link (`signInWithOtp`), password login, password change, and reset flows; environment requires Supabase keys and `NEXT_PUBLIC_SITE_URL` for OAuth/reset redirects.
- Google OAuth uses `src/components/auth/google-auth-button.tsx` and redirects through `/auth/callback`. The callback exchanges the Supabase code, checks onboarding/profile completeness, and sends complete users to `/dashboard`.
- For custom domains and mobile testing, Supabase Auth redirect URLs must include the exact callback origins in use, e.g. `https://certnow.uk/auth/callback`, `https://www.certnow.uk/auth/callback`, and any stable Vercel/staging callback URL. After changing `NEXT_PUBLIC_SITE_URL`, redeploy/restart because it is bundled into client code.
- Unified signup + onboarding is handled by the wizard at `/signup/step1-3`; incomplete profiles redirect there. Auth helpers include `userHasPassword`, `completeSignupWizard`, `changePassword`, `requestPasswordReset`, and `applyPasswordReset`.
- Onboarding currently completes on `/signup/step2` and `/signup/step3` redirects back to step 2 (certifications removed for now).
- Step 2 onboarding collects profession (dropdown + manual fallback), company name, engineer name, engineer ID card number, and Gas Safe registration; these are persisted to `profiles` for certificate defaults.
- If signup fails with `permission denied for table profiles`, fix the `public.handle_new_user()` trigger to be `SECURITY DEFINER` so it can insert into `public.profiles` under RLS.

## Wizard Flow Notes
- Job address steps follow the shared card layout: job reference, address name/lines/city/postcode, and site telephone; job line1/postcode sync into property address fields.
- `/jobs/new` is the convergence point for manual engineer-created jobs, landlord new-job requests, and landlord renewal requests. It should accept optional context from `job_requests.id`, property, client/landlord, prior certificates, and engineer profile without breaking the existing manual creation path.
- Job context prefill priority should be: explicit job request values, property record, previous jobs/certificates, landlord/client record, engineer profile defaults. Engineer-entered values in the current form should not be silently overwritten.
- General Works wizard step order: Job address → Evidence → Review → Signatures (client step still precedes wizard).
- Gas Warning Notice job step includes job address fields plus customer contact card; the job address fields are stored in job_fields and used to update the job address via `saveGasWarningJobInfo`.
- Boiler Service is a public/selectable engineer flow again. It should start directly in `/wizard/create/gas_service`/`/wizard/create/boiler_service` like CP12, not behind the old client-only pre-step. Step 1 mirrors CP12 where relevant: service date, structured job address, address API lookup, site telephone, and structured client/landlord correspondence details.
- Boiler Service visible fields should track the PDF template, not generic service notes. The UI must collect every gas-service PDF field that is not already autofilled from profile/job context: job/client address blocks, boiler identity, high/low combustion readings, operating pressure, heat input, PDF safety/template yes-no checks, summary/recommendations/comments, next service date, and engineer/customer signatures. Avoid adding visible fields that are stored but never render to the Boiler Service PDF unless there is a clear operational reason.
- CP12 (2026-02 refresh):
  - Section order mirrors the PDF: Installer (read-only from account) → Job address → Customer/Landlord → Appliance identity → Appliance checks → Signatures.
  - **Billable customer is removed** from CP12; only job address + landlord/customer are collected.
  - Installer/company + Gas Safe + ID card come from profile; if missing, issuing is blocked and the user is pushed to Settings.
  - Step 1 now supports inline **client selection/creation** inside the wizard. New clients require only `name`; `phone` and `email` are optional. The job stores the linked `client_id` as the canonical key.
  - When a client is linked, Step 1 prefills from the canonical client record and can also offer **saved properties** derived from that client’s prior jobs/job fields.
  - Saved property selection fills property-side fields only: `job_address_name`, `job_address_line1`, `job_address_line2`, `job_address_city`, `job_postcode`, and `job_tel`. Landlord/property-owner fields remain separate for CP12 compliance.
  - Step 1 Job location requires `job_address_name`, `job_address_line1`, `job_postcode`, and `job_tel` (site telephone); `job_address_line2` and `job_address_city` are supported and render on separate PDF address lines.
  - Step 1 Landlord / Property owner uses structured fields: `landlord_name`, `landlord_company` (optional), `landlord_address_line1`, `landlord_address_line2` (optional), `landlord_city`, `landlord_postcode`, `landlord_tel` (optional). For backward compatibility, `landlord_address` is still persisted and used as a fallback.
  - Step 1 also captures optional `landlord_email` and `landlord_mobile`. These persist to `job_fields` and update the linked client email/phone so future jobs for that client prefill landlord contact automatically. Missing landlord email shows a non-blocking advisory on the final step; it must never block CP12 issue.
  - CP12 Step 1 also supports a **prepare-only** entry path from dashboard upcoming jobs via `?prepare=1`; saving People & Location persists Step 1 data and returns to `/dashboard` without forcing the rest of the wizard.
  - Appliances capped at 5 rows to match the PDF table capacity.
  - Mobile UX is intentionally tight: demo-fill buttons are hidden, address lookup disabled/configuration errors are suppressed in the UI, Step 2 has no extra "Appliance profile" wrapper, and `+ Appliance` is inline with "Appliance 1 identity".
  - Step 3 no longer exposes a global "Measurement source" switch. Voice capture is only shown inline on numerical reading inputs (`Operating pressure`, `Heat input`, high/low CO/CO2/ratio).
  - Signature canvases use `touch-action: none` through `useSignaturePad` and signature components so drawing on mobile does not scroll the whole page.
  - CP12 browser history is step-aware via `useWizardStepHistory`; phone/browser back gestures should move to the previous wizard step before leaving the route.
- CP12 includes a CTA on Step 3 when "Warning notice issued" is YES that deep-links to Gas Warning Notice using the same jobId.
- CP12 guardrails (docs/specs/cp12.md): property + landlord addresses required and must differ, landlord name required, Reg 26(9) confirmation required, at least one appliance with location & description, engineer + customer signatures required to issue, and if any appliance is unsafe/defective you must capture defect_description, remedial_action, and a warning_notice_issued choice.
- Public ID chain: jobs get an 8-digit `job_code` and a job-scoped `client_ref` (`{job_code}-01`); certificates get `public_id` (`{job_code}-{CERT_TYPE}-01`). UUIDs remain primary keys for all joins.

## Dashboard & Property-First UX
- `/dashboard` is now an operational board, not a completed-jobs archive. It should use a modern minimal calendar as the main planning surface instead of separate upcoming/past job tabs or duplicate card lists.
- `/dashboard` must surface pending `job_requests` above the calendar. Renewal requests from public job links and standalone landlord requests use the same cards and scheduling path.
- The dashboard calendar should show scheduled and completed work together, encode day-level progress quickly, and allow URL-based day selection via `/dashboard?date=YYYY-MM-DD` so engineers can scan a month and open the selected day’s jobs.
- Selected-day job rows should show job type labels, client/title, address, scheduled time, status, and the correct action (`Prepare`, `Start`, `Open`, or `Open PDF`). CP12 jobs with incomplete Step 1 prep should link to the prepare-only path.
- Add a job requests section above upcoming jobs. It should show landlord-submitted `pending` requests before scheduled work so engineers can quickly schedule or dismiss inbound demand.
- Request cards should be labelled by `request_type`: `New Job Request` for `new_job`, and `Renewal Request` for `renewal`.
- Request cards should show property address, landlord name and phone, certificate expiry status when it is a renewal, tenant name and phone, access notes, and preferred dates.
- Request actions are `Schedule Job` and `Dismiss`. `Schedule Job` opens `/jobs/new` pre-populated with property address, landlord/client details, job type, tenant details, access notes, and request id. Scheduling should link the new job to `job_requests.id` and update the request to `scheduled`.
- Upcoming calendar jobs compute a prep state from saved Step 1 fields. Unprepared CP12 jobs show `Prepare`; prepared CP12 jobs show `Start`.
- The current dashboard rows show job type labels (e.g. `CP12`, `Gas Warning Notice`) alongside client/name/address. `Create invoice` lives in the header actions; `View all jobs` lives with the calendar controls.
- `/clients` is the main browse surface for customer history and `/clients/[id]` groups that client’s work into current jobs, completed jobs, reports, and calendar context.
- `/jobs/[id]` now presents job identity first: job title/type/status at the top, with linked client/property context and related certificates/invoices below.

## Follow-Up Logic
- CP12 is the main compliance lifecycle anchor. When a CP12 is completed, always create a 12-month CP12 follow-up.
- CP12 issue also schedules reminder rows: landlord at eight weeks and four weeks before next inspection due, and engineer at eight weeks before. `/api/cron/reminders` processes due reminder rows daily and sends through the configured CertNow email provider. Only mark a reminder `sent_at` after a successful send; missing recipients or provider failures should remain visible in cron output rather than being silently discarded.
- Boiler Service follow-up depends on context. If linked to CP12 on the same job, do not create a separate boiler service follow-up because the CP12 renewal cycle covers it.
- If a Boiler Service is standalone, create a 12-month boiler service follow-up and add note: `Standalone service — confirm whether CP12 also required`.
- Gas Warning Notice keeps its existing logic: it is triggered from unsafe CP12 appliance checks and should not be merged with boiler service follow-up logic.
- Known future gap: standalone boiler service finding a dangerous appliance may need separate Gas Warning Notice handling later.

## Invoice Completion Flow
- Invoices already exist under `/invoices`, `/invoices/new`, and `/invoices/[invoiceId]`, but certificate completion should integrate them more directly.
- At CP12 Step 4 completion, after successful PDF generation, prompt: `Create invoice for this job?`
- CP12 completion first asks whether a boiler service was also completed. If yes, open `/wizard/create/boiler_service?jobId=...` on the same job so the boiler service certificate links to the CP12 job. If no, show invoice options.
- The invoice CTA should open `/invoices/new?jobId=...` and create one draft invoice for the job with line items derived from all certificates on that job. Unit prices default to the engineer’s last used price for that certificate type when available; otherwise they remain zero/empty for editing.
- Engineers should not need to navigate separately to invoices after completing a certificate, though standalone invoice creation from the dashboard/header should remain available.

## Public Job Links
- Public job pages live at `/j/[publicToken]` and must never require login. The first visible content for landlords is the full property address.
- Public job pages show completed compliance work, certificate downloads, engineer name/company/contact/Gas Safe number, and next inspection due.
- If landlord email is missing, show a one-field email capture for reminders. If the job is within 60 days of expiry or expired, show the four-field renewal request form: tenant name, tenant phone, access notes, preferred dates.
- Logged-in engineers who own the job may see an engineer progress panel and quick actions, but public visitors must only see landlord-safe job/certificate data.
- CP12 completion should include a WhatsApp share button with landlord name, full stored job address including postcode, and the `/j/[publicToken]` link.

## Compatibility Guardrails
- Preserve compatibility with the existing CP12 wizard, Supabase schema, certificate PDF generation pipeline, invoice routes, and follow-up system while adding the property/request/autofill direction.
- New property and job request features should be additive. Do not break manual `/jobs/new`, existing client selection/creation, saved property prefill, dashboard prepare/start actions, `/jobs/[id]/pdf`, or current certificate issuance.
- Public landlord links should act as acquisition/retention loops around properties and renewals, not as a replacement for engineer-controlled job creation.

## Landing Page & Assets
- The public landing page lives at `src/app/page.tsx` and uses static product screenshots from `public/landing`.
- Current phone screenshots are filled demo-style CP12 wizard states: `cp12-wizard-step-1.png`, `cp12-wizard-step-2.png`, and `cp12-wizard-step-3.png` at `393x852`.
- Keep screenshots free of demo/debug buttons, address lookup disabled text, and empty fields because they are used as marketing assets.

## Testing Guidelines
- Framework: Vitest; place specs in `tests/` with `*.test.ts`.
- Name tests after behavior, not implementation: `does X when Y`.
- Cover server actions, data transforms, and validation; prefer realistic Supabase/request stubs.
- Run `pnpm test` before PRs; gate new features with at least one happy-path and one failure-path test.

## Commit & Pull Request Guidelines
- Commit messages: short imperative summary (`Add server action`, `Fix PDF export`); scope tags optional (`fix:` is common in history).
- Keep commits focused; include migration or config changes in the same commit when tightly coupled.
- Pull requests: clear summary, linked issue/Notion task, and screenshots or notes for UI-affecting changes.
- Call out environment requirements; `.env.local.example` lists `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, optional Supabase service role key, and optional `OPENAI_API_KEY`. Mention Supabase redirect URL additions when relevant.
