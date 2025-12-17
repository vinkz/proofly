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
- Certificates: `src/server/certificates.ts` dispatches `generateCertificatePdf` to `renderBoilerServicePdf` (`src/lib/pdf/boiler-service.ts`), `renderGeneralWorksPdf` (`src/lib/pdf/general-works.ts`), or inline `renderCp12Pdf`, all using `pdf-lib`.
- Certificate PDFs are written to the Supabase `certificates` bucket (preview vs final paths), linked in the `certificates` table, and served via Supabase signed URLs; no external PDF API is used.

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
