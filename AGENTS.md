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
- External integrations: Supabase (auth/storage), PDF generation via `pdf-lib`, maps via `@googlemaps/google-maps-services-js`; isolate integration code under `src/server`.

## PDF Generation
- Field reports: `src/lib/reporting.ts` builds PDFs with `pdf-lib`; `src/server/jobs.ts` loads photos/signatures, optionally AI-summarizes via OpenAI (`getOpenAIClient` and `OPENAI_API_KEY`), then uploads to the Supabase `reports` bucket and stores `reports` rows.
- Certificates: `src/server/certificates.ts` orchestrates Supabase service-role writes (public.certificates/jobs/job_fields) and storage uploads to the `certificates` bucket (preview vs final), then returns signed URLs; no external PDF API is used.
- CP12 / Gas Safety (AcroForm): `src/server/pdf/renderCp12Certificate.ts` loads `src/assets/templates/cp12-template.pdf`, reads AcroForm field names, and fills them via a mapping from `Cp12FieldMap` + `ApplianceInput`. It uses `setTextIfExists` to avoid hard failures on missing fields, combines defect/remedial/notes into `comments.comments`, uses fallbacks for signatures and issue dates, and fills appliance rows by `appliance_N.*` fields when present. If appliance fields are missing, it draws the appliance table text at fixed XY positions and adds pages by copying the template. It updates field appearances with Helvetica and leaves fields editable (no flatten).
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
