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
- OnboardingAgent: Owns trade/cert onboarding flows under `src/app/(onboarding)`, using shadcn UI, guarded redirects, and server actions to persist profile data.
- TemplateAgent: Filters templates by `profiles.trade_types` or `is_general`, keeps template metadata (`is_general`, `trade_type`) in sync, and wires template pickers/lists to those rules.
- ProfileAgent: Maintains `profiles` table fields (`trade_types`, `certifications`, `onboarding_complete`), updates via `src/server/profile.ts`, and enforces onboarding guards (`RequireAuth`, onboarding layout).

## Architecture Overview
- Next.js App Router with mixed server/client components; pages and layouts live in `src/app`.
- Data flows through server actions in `src/app` and shared helpers in `src/server`; keep Supabase clients server-side except for SSR helpers in `src/lib`.
- Client UI pulls typed data via props; shared types in `src/types` keep server/client contracts aligned.
- Styling uses Tailwind (`tailwind.config.ts`); components favor utility-first classes over bespoke CSS.
- External integrations: Supabase (auth/storage), PDF generation via `pdf-lib`, maps via `@googlemaps/google-maps-services-js`; isolate integration code under `src/server`.

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
- Auth is Supabase magic-link via `signInWithOtp` (see `src/app/login/page.tsx`); `shouldCreateUser: true` supports sign-in and sign-up with the same flow.
- Environment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and server keys) must be set; `/env-check` helps verify.
- After login, users land in the App Router (`/dashboard` etc.); keep onboarding copy trade-aware per CONTEXT.md.
- Auth helpers include `userHasPassword` (checks identities for email/password) and password updates respect whether a user had a password: require current password if present, otherwise allow setting a first password (see `src/server/auth.ts`, `src/server/password.ts`, `src/app/(app)/settings/password-section.tsx`).
- Forgot/reset password flow: `requestPasswordReset` sends reset email with redirect to `/reset-password`; `applyPasswordReset` exchanges the code then updates the password. UI routes: `/forgot-password`, `/reset-password`, and login links the flow.

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
