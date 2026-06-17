# Item 9 — One app shell: findings (STOP-and-report)

Per the brief ("if the two shells turn out to be deeply entangled, STOP and report …
this item can ship separately"), here is what the two shells actually are and the one
structural decision that blocks a clean unification.

## The two shells today

| Shell | File | Routes it wraps | Nav | Breakpoint |
|-------|------|-----------------|-----|------------|
| Bottom-nav | `src/app/(app)/layout.tsx` | dashboard, settings, clients, properties, jobs (list), invoices, documents, reports, requests, templates, billing, tools, **onboarding** | header (certnow + `ToolsMenu` hamburger) + `BottomNav` (fixed, `h-14`) | **none** — bottom nav at every width (this is why dashboard/settings show the "mobile" shell at 1257px) |
| Sidebar | `src/app/(wizard)/layout.tsx` | **jobs/new**, **jobs/new/[jobId]/* (legacy step wizard)**, **wizard/create/[certificateType] (current wizard)** | `aside` sidebar (Dashboard/Certificates/Settings + Gas-rate) + a mobile hamburger `<details>` | **md (768px)** |

So the breakpoints disagree (none vs 768) and the nav models differ (bottom-tab vs sidebar+hamburger).
The two layout files are **not** entangled in code — they're independent. The entanglement is in the **route grouping**.

## The blocker: the `(wizard)` group mixes a "standard" route with focused flows

The brief's target end-state:
- **Standard routes** → bottom tab bar < 1024, sidebar ≥ 1024.
- **Focused flows** (`/wizard/`, `/onboarding/`) → **no** global nav at any size.

But `(wizard)/layout.tsx` is a single route-group layout that wraps **both**:
- `/jobs/new` — which the brief classifies as a **standard** route (should get the unified shell), and
- `/wizard/create/*` (and the legacy `/jobs/new/[jobId]/*` steps) — which are **focused** (no nav).

A route-group layout can't render "sidebar for /jobs/new but no-nav for /wizard/create" without either:
1. **Route restructuring** — move `/jobs/new` out of `(wizard)` into `(app)` (or a new standard group), leaving `(wizard)` purely focused; or
2. **Pathname-conditional layout** — a client wrapper in `(wizard)/layout.tsx` (like the `HideDuringOnboarding` added in Item 10) that picks shell-vs-no-shell from `usePathname()`.

Both are structural and change navigation for the whole app — exactly what the brief says to do as its own commit with testing at 390/800/1100/1400px on every route.

## One decision needed from you

**Is `/jobs/new` a standard route (gets sidebar/bottom-nav) or a focused task (no nav, just the in-flow ← Back)?**
- The brief lists it as *standard*. If so → option 1 (move it to `(app)`) is cleanest.
- If you'd accept it as *focused* (it's a quick "pick type + path" screen with a Back), then `(app)` becomes the only standard shell and `(wizard)` becomes purely focused — the simplest, lowest-risk split, and it still removes the reported inconsistency (no more desktop sidebar on a task screen).

## Recommended plan (once the above is decided)

1. Extract the sidebar `aside` into a shared `<SidebarNav>` and keep `<BottomNav>`.
2. Define the breakpoint once (Tailwind `lg` = 1024px; or a `--shell-breakpoint` token).
3. `(app)/layout.tsx`: render `<SidebarNav className="hidden lg:flex">` + content + `<BottomNav className="lg:hidden">`, both wrapped in `HideDuringOnboarding` (onboarding stays nav-less, per Item 10).
4. `(wizard)/layout.tsx`: render focused (no global nav; the wizard already has its own `← Back` header). Route `/jobs/new` per the decision above.
5. Delete the `(wizard)` mobile hamburger `<details>` and the md(768) breakpoint.
6. Test every route at 390 / 800 / 1100 / 1400px (the brief's gate).

## Why I stopped rather than forced it
- The split requires a structural routing decision (above) that's yours to make, not a default I should pick silently.
- The brief gates this item on 4-breakpoint verification across every route. The browser available in this session points at production (certnow.uk), which won't reflect local changes, and no local dev server is running — so I couldn't meet that verification bar here.
- Items 11, 7, 8, 14, 19, 10, 12, 13, 15 and the riding P3s are all done, committed, and pass `pnpm lint` + `tsc`. Item 9 is the only one outstanding and the brief explicitly allows it to ship separately.
