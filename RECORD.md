# Proofly Scaffold Summary

## Highlights
- Added end-to-end `/jobs/new` wizard covering client selection, template attachment, scheduling, inspection execution, signatures, AI generation, and final report delivery. Includes shared shell, progress UI, signature panel, and client/template components.
- Expanded Supabase server logic: client management, job drafting, template assignment, details saving, inspection updates, signature handling with status transitions, AI → PDF generation, shareable links, and queued report email deliveries.
- Upgraded domain pages (dashboard, jobs, clients, templates, reports) to surface real data, filters, quick actions, and new CTAs that point to the wizard.
- Introduced `lib/reporting` for the assumed `generateReport` + `generatePDF` helpers, plus `lib/db/schema` to document SQL structure (clients, jobs, template items, job items, reports, report deliveries).
- Updated UI components to support the new flow (client picker, inspection flow, template duplication, send-report form) and extracted reusable hooks such as `useSignaturePad`.
- Added Supabase migration `supabase/migrations/20240219120000_proofly_schema.sql` covering table creation, enums, updated_at triggers, cascading FKs, and storage policies for the `photos` bucket to match the new schema.
- Regenerated `src/lib/database.types.ts` from the latest Supabase schema (clients, templates, template_items, jobs, job_checklist/items, photos, reports, report_deliveries, enums) and updated queries/types to include new columns such as `updated_at`.
- Hardened `supabaseServer` to only mutate cookies inside allowed contexts (server actions + route handlers) and updated all server actions to opt into cookie writes, resolving the Next.js 15 cookie mutation error.
- Split Supabase factories into `supabaseServerReadOnly` for server components/pages and `supabaseServerAction` for server actions/route handlers, then updated every call site + tests to reflect the new API.
- Fixed template queries by selecting the `updated_at` column in both `listVisibleTemplates` and `getTemplate`, matching the schema/types expectations.
- Migrated server actions and UI types to the new `job_items` table (away from the legacy `job_checklist` view), ensuring job drafts, template assignments, inspection updates, photo uploads, signatures, AI report generation, and delivery records all operate on the updated schema.
- Added backwards-compatible client-table access: server actions now normalize data when the new `clients` table is missing (falling back to the legacy `contacts` table), so client CRUD, job drafts, and wizard views continue to work during staged migrations.
- Fixed runtime errors by removing the non-existent `status` column from all `job_items` queries, introducing the `result` field throughout server logic, UI components, and PDF/report generation, and updating TypeScript definitions/tests accordingly.

## Testing
- `pnpm exec tsc --noEmit`
