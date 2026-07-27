# CertNow Analytics

What is tracked, how, and where to look. **Read this before changing signup or
job-creation code** — event names here are the contract behind the conversion
funnel. Renaming or removing an event silently breaks the funnel and any saved
insight built on it.

## Stack

| Concern | Tool | Status |
| --- | --- | --- |
| Traffic, pageviews, funnels, session replay | **PostHog** (EU Cloud) | Live once `NEXT_PUBLIC_POSTHOG_KEY` is set |
| Product data (signups, jobs, certs, payments) | Supabase + Stripe | Live |
| Errors + performance traces | Sentry | Live |

PostHog is the only *marketing/traffic* analytics. Sentry is errors only — it
does not count visitors. There is no Google Analytics, Vercel Analytics,
Segment, or Plausible (intentionally — avoid duplicate/competing pageview
counts).

## Configuration

- **Client bootstrap:** `src/components/analytics/posthog-provider.tsx`, mounted
  once in `src/app/layout.tsx`. Initialises only when
  `NEXT_PUBLIC_POSTHOG_KEY` is present — absent key is a clean no-op (same
  pattern as the Sentry DSN guard), so local dev and previews without a key
  are unaffected.
- **Event helper:** `src/lib/analytics/events.ts` — `track(event, props)` plus
  the `ANALYTICS_EVENTS` name constants. `track()` no-ops safely when PostHog
  is not loaded, so call sites never need to guard.
- **Env vars** (see `.env.local.example`):
  - `NEXT_PUBLIC_POSTHOG_KEY` — the project API key (starts `phc_`).
  - `NEXT_PUBLIC_POSTHOG_HOST` — defaults to `https://eu.i.posthog.com`.

### Privacy / UK-GDPR posture

- **Cookieless.** `persistence: 'memory'` — no cookies, no localStorage, no
  sessionStorage. This is why the app ships **no cookie-consent banner**.
- **No PII in events.** Event properties carry only low-cardinality categories
  (e.g. `job_type`, `method`). Never add names, emails, phone numbers,
  addresses, or landlord/tenant details to an event.
- **Session replay is fully masked.** `maskAllInputs: true` and
  `maskTextSelector: '*'` — every input and every text node is masked, so
  rendered landlord/tenant PII never leaves the browser. Replays show layout,
  clicks, navigation, and rage-clicks, not content.
- **Respects Do Not Track** (`respect_dnt: true`).
- **Consent note:** cookieless + masked replay is a strong privacy posture, but
  UK PECR/ICO guidance treats analytics storage as non-essential in general.
  We avoid device storage entirely (memory only), which is the pragmatic basis
  for running without a banner. Confirm with your DPO/legal that this matches
  your risk appetite; if they require explicit opt-in, switch persistence to
  `localStorage+cookie` and gate `posthog.init` behind a consent banner.

## The conversion funnel

Goal: see whether the problem is **traffic** (few people arrive) or
**conversion** (people arrive but don't sign up / don't create a job).

| # | Step | Event | Fired from |
| --- | --- | --- | --- |
| 1 | Landing page view | `$pageview` (auto) on `/` | `posthog-provider.tsx` (route-change tracker) |
| 2 | Signup started | `signup_started` | `src/app/(auth)/signup/step1/page.tsx` (mount) |
| 3 | Signup completed | `signup_completed` `{ method: 'email' \| 'google' }` | step1 email success + `src/components/auth/google-auth-button.tsx` |
| 4 | First job created | `job_created` `{ job_type, client_mode }` | `src/components/jobs/solo-job-form.tsx` (submit success) |

**"First job created":** PostHog funnels count the *first* occurrence per person,
so `job_created` doubles as "first job created" — no separate event needed.

### Free CP12 tool funnel (`/free-cp12`)

Top-of-funnel acquisition: an anonymous engineer generates a real CP12 with no
account, and gives us an email address to download it.

| # | Step | Event | Fired from |
| --- | --- | --- | --- |
| 1 | Page view | `$pageview` (auto) on `/free-cp12` | `posthog-provider.tsx` |
| 2 | Form started | `free_cp12_form_started` | first edit to any field, once per session |
| 3 | PDF generated | `free_cp12_generated` `{ appliance_count }` | preview renders successfully |
| 4 | Email submitted | `free_cp12_email_submitted` | download form submit |
| 5 | Download completed | `free_cp12_download_completed` `{ emailed }` | after the file saves |

**The number to watch is step 3 → step 4:** the drop-off between generating a
certificate and being willing to hand over an email address. That gap is the
cost of the email wall. Steps 4 → 5 should be near-total; a gap there means
delivery or rate limiting is failing, not that people changed their minds.

`free_cp12_email_submitted` deliberately carries **no** email address or any
other property — see the PII rule above. The address lives only in
`free_tool_leads`, which is the sole thing the tool persists.

### Identity / stitching caveat (cookieless trade-off)

Memory persistence keeps a stable `distinct_id` across **client-side**
navigation within a single visit, so the whole email-signup journey
(land → start → complete → create job in one sitting) stitches into one funnel.
Identity resets on a **full page reload, a new tab, or the Google OAuth
redirect**. Practical effects:

- A visitor who signs up one day and creates their first job on another day
  will not be stitched (counts as two people).
- Google signups lose stitching at the OAuth redirect, so
  `signup_completed {method:'google'}` and their later `job_created` may not
  join in the funnel.

If cross-session accuracy matters more than avoiding a consent banner, switch
`persistence` to `localStorage+cookie` (add a banner) and call
`posthog.identify(userId)` at `signup_completed`.

## Traffic sources (referrer / UTM)

PostHog automatically captures `$referrer`, `$referring_domain`, and any
`utm_*` query params on the first pageview of a visit — no extra code. To
attribute TikTok/LinkedIn/etc., tag the links you post:

```
https://certnow.uk/?utm_source=tiktok&utm_medium=social&utm_campaign=launch
https://certnow.uk/?utm_source=linkedin&utm_medium=social&utm_campaign=launch
```

Then break the funnel or pageviews down by `utm_source` / `$referring_domain`.

## Where to view it (PostHog dashboard)

1. **Funnel:** Product analytics → New insight → Funnel. Add steps in order:
   `$pageview` (optionally filtered to pathname `/`) → `signup_started` →
   `signup_completed` → `job_created`. Save as **"Signup → First job"**.
   Break down by `utm_source` to compare channels.
2. **Traffic sources:** Web analytics tab, or a Trends insight on `$pageview`
   broken down by `$referring_domain` / `utm_source`.
3. **Session replay:** Session replay tab. Filter to sessions that hit
   `signup_started` but not `signup_completed` to watch where people drop off.
4. **Live check:** Activity → live events to confirm events arrive in real time.

## Adding or changing events

1. Add the name to `ANALYTICS_EVENTS` in `src/lib/analytics/events.ts`.
2. Call `track(ANALYTICS_EVENTS.yourEvent, { /* non-PII props only */ })`.
3. Update the tables above.
4. Never rename an existing event without updating its saved insights/funnels in
   PostHog first, or historical continuity is lost.
