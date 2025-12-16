
- Updated copy to use “workflow” instead of “template” across the new job flow and workflows UI, and moved the jobs table to a client component with row-click navigation and inline delete.
- Installed the missing `qrcode-terminal` dependency and refreshed the lockfile so the `pnpm mobile` tunnel script can run.
- Improved `pnpm mobile` script to check port availability before starting, preventing tunnel startup when port 3000 is already in use.
- Rebuilt the login/create-account page with CertNow branding, magic-link auth for sign-in and sign-up, trade-aware messaging, and CTA styling aligned to the `--action` green.
- Updated user-facing headers and report labels to use the CertNow name across login, signup, the app shell, templates, wizard, and report previews.
- Added trade-specific onboarding (trades, certifications, confirmation), profile server actions, Supabase profile fields, template filtering by trade/is_general, and guards that redirect unfinished users into onboarding.
- Scaffolded the CertNow certificate workflow: jobs command centre UI, certificate type modal, wizard (info → photos → checks → signatures/PDF), PDF preview, and job sheet scan flow with mobile-first cards and pill controls.
- Added certificate server actions (create/save/upload/update/generate/send), reusable inspection/photo/signature cards, and a Supabase migration for certificate metadata, job photos, job fields, and certificates tables.
- Pivoted UI/navigation to certificate-only: removed template entry points, redirected old template routes, updated settings copy, and pointed jobs/dash flows to certificate selection and PDF preview.
