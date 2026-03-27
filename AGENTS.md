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

## Architecture Overview
- Next.js App Router with mixed server/client components; pages and layouts live in `src/app`.
- Data flows through server actions in `src/app` and shared helpers in `src/server`; keep Supabase clients server-side except for SSR helpers in `src/lib`.
- Client UI pulls typed data via props; shared types in `src/types` keep server/client contracts aligned.
- Styling uses Tailwind (`tailwind.config.ts`); components favor utility-first classes over bespoke CSS.
- App navigation is now explicitly client-first: `/dashboard` is the operational home, `/clients` is a first-class destination, and `/jobs/[id]` is treated as a job record with related client/property context.
- Document preview is canonical at `/jobs/[id]/pdf` (legacy report/pdf routes should redirect here); saved documents live under `/documents` and use Supabase signed URLs.
- External integrations: Supabase (auth/storage), PDF generation via `pdf-lib`, maps via `@googlemaps/google-maps-services-js`; isolate integration code under `src/server`.
- Job sheets: `src/server/job-sheets.ts` manages `public.job_sheets` codes (CN-XXXXXX) for the job sheet scan flow.
- Job sheet lookup API: `src/app/api/job-sheets/lookup/route.ts` resolves CN codes to jobs for the scan flow.
- Job sheet scan UI: `src/app/(app)/jobs/scan` provides the QR scan entry point that redirects to the linked job.
- Job sheet scan client: `scan-job-sheet-client.tsx` uses QR scanning + lookup with inline errors and auto-redirect on success.
- Job sheet PDF: `src/lib/pdf/job-sheet-template.ts` renders a QR-enabled job sheet PDF for scan flows.
- Job sheet PDF API: `src/app/api/jobs/[jobId]/job-sheet/route.ts` serves the generated job sheet PDF.
- Job detail actions: job pages include a "Generate Job Sheet" button wired to the job sheet PDF API.
- Cross-certificate links: CP12 can deep-link to Gas Warning Notice using the same jobId; Gas Warning Notice may prefill from CP12 job fields and appliances when available.

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
- Job sheets: `renderJobSheetPdf` in `src/lib/pdf/job-sheet-template.ts` builds QR-enabled PDFs; `generateJobSheetPdf` in `src/server/pdf/renderJobSheetPdf.ts` loads job context and sheet codes.

## Build, Test, and Development Commands
- `pnpm dev`: Run dev server (Turbopack); access via LAN/DNS from phones on the same network.
- `pnpm build`: Production build.
- `pnpm start`: Run the compiled build locally.
- `pnpm lint`: ESLint over the repo; fixes style and catches dead imports.
- `pnpm test`: Vitest test suite; add `--runInBand` when debugging server actions.

## Coding Style & Naming Conventions
- TypeScript + React 19 + Next.js app router; prefer functional components.
- Components, hooks, and types use `PascalCase`; files are `kebab-case.tsx|ts`.
- Keep server-only modules in `src/server` and avoid importing them into client components.
- Follow ESLint (Next + TypeScript) defaults; use 2-space indentation and trailing commas per lint rules.
- Co-locate schemas (zod) and validation with their feature; reuse from `src/lib` for cross-cutting concerns.
- Primary CTAs use the `--action` green; secondary actions use brand/neutral blues. Favor rounded-xl, subtle shadows, and mobile-first spacing.

## Auth & Onboarding
- Auth supports magic-link (`signInWithOtp`) and password login, plus password change and reset flows; environment requires Supabase keys and `NEXT_PUBLIC_SITE_URL` for reset redirects.
- Unified signup + onboarding is handled by the wizard at `/signup/step1-3`; incomplete profiles redirect there. Auth helpers include `userHasPassword`, `completeSignupWizard`, `changePassword`, `requestPasswordReset`, and `applyPasswordReset`.
- Onboarding currently completes on `/signup/step2` and `/signup/step3` redirects back to step 2 (certifications removed for now).
- Step 2 onboarding collects profession (dropdown + manual fallback), company name, engineer name, engineer ID card number, and Gas Safe registration; these are persisted to `profiles` for certificate defaults.
- If signup fails with `permission denied for table profiles`, fix the `public.handle_new_user()` trigger to be `SECURITY DEFINER` so it can insert into `public.profiles` under RLS.

## Wizard Flow Notes
- Job address steps follow the shared card layout: job reference, address name/lines/city/postcode, and site telephone; job line1/postcode sync into property address fields.
- General Works wizard step order: Job address → Evidence → Review → Signatures (client step still precedes wizard).
- Gas Warning Notice job step includes job address fields plus customer contact card; the job address fields are stored in job_fields and used to update the job address via `saveGasWarningJobInfo`.
- CP12 (2026-02 refresh):
  - Section order mirrors the PDF: Installer (read-only from account) → Job address → Customer/Landlord → Appliance identity → Appliance checks → Signatures.
  - **Billable customer is removed** from CP12; only job address + landlord/customer are collected.
  - Installer/company + Gas Safe + ID card come from profile; if missing, issuing is blocked and the user is pushed to Settings.
  - Step 1 now supports inline **client selection/creation** inside the wizard. New clients require only `name`; `phone` and `email` are optional. The job stores the linked `client_id` as the canonical key.
  - When a client is linked, Step 1 prefills from the canonical client record and can also offer **saved properties** derived from that client’s prior jobs/job fields.
  - Saved property selection fills property-side fields only: `job_address_name`, `job_address_line1`, `job_address_line2`, `job_address_city`, `job_postcode`, and `job_tel`. Landlord/property-owner fields remain separate for CP12 compliance.
  - Step 1 Job location requires `job_address_name`, `job_address_line1`, `job_postcode`, and `job_tel` (site telephone); `job_address_line2` and `job_address_city` are supported and render on separate PDF address lines.
  - Step 1 Landlord / Property owner uses structured fields: `landlord_name`, `landlord_company` (optional), `landlord_address_line1`, `landlord_address_line2` (optional), `landlord_city`, `landlord_postcode`, `landlord_tel` (optional). For backward compatibility, `landlord_address` is still persisted and used as a fallback.
  - CP12 Step 1 also supports a **prepare-only** entry path from dashboard upcoming jobs via `?prepare=1`; saving People & Location persists Step 1 data and returns to `/dashboard` without forcing the rest of the wizard.
  - Appliances capped at 5 rows to match the PDF table capacity.
- CP12 includes a CTA on Step 3 when "Warning notice issued" is YES that deep-links to Gas Warning Notice using the same jobId.
- CP12 guardrails (docs/specs/cp12.md): property + landlord addresses required and must differ, landlord name required, Reg 26(9) confirmation required, at least one appliance with location & description, engineer + customer signatures required to issue, and if any appliance is unsafe/defective you must capture defect_description, remedial_action, and a warning_notice_issued choice.
- Public ID chain: jobs get an 8-digit `job_code` and a job-scoped `client_ref` (`{job_code}-01`); certificates get `public_id` (`{job_code}-{CERT_TYPE}-01`). UUIDs remain primary keys for all joins.

## Dashboard & Client-First UX
- `/dashboard` is now an operational board, not a completed-jobs archive. It emphasizes the current job, grouped upcoming jobs (`Today`, `Tomorrow`, `This week`), and recent clients.
- Upcoming jobs compute a prep state from saved Step 1 fields. Unprepared jobs show `Prepare`; prepared jobs show `Start`.
- `/clients` is the main browse surface for customer history and `/clients/[id]` groups that client’s work into current jobs, completed jobs, reports, and calendar context.
- `/jobs/[id]` now presents job identity first: job title/type/status at the top, with linked client/property context and related certificates/invoices below.

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
