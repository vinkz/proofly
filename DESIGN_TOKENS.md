# CertNow design tokens — canonical reference

Extracted from `src/app/globals.css`, `tailwind.config.ts`, the landing page
(`src/app/page.tsx` + `src/app/_components/landing-tabs.tsx`), the app shell
(`src/app/(app)/layout.tsx`), and the shared UI kit (`src/components/ui/*`).
If a surface needs a style, derive it from something on this page — do not invent
new colours, fonts, or radius values.

## Colours

All colours are CSS variables defined in `src/app/globals.css` with light + dark
values (`prefers-color-scheme` and `[data-theme="dark"]`). Always reference the
variable, never the hex, so dark mode keeps working.

| Token | Light value | Use |
| --- | --- | --- |
| `--color-action` | `#1a7a52` | Primary green: links, accents, active tab, icon tiles, stats |
| `--color-action-bg` | `#edf7f2` | Green tint background (icon tiles, "Pass" pills) |
| `--color-action-fg` | `#ffffff` | Text on green |
| `--color-cta` | `#111111` | Dark CTA buttons (inverts to light in dark mode) |
| `--color-cta-fg` | `#ffffff` | Text on CTA |
| `--color-amber` / `-bg` | `#ba7517` / `#faeeda` | Warning, awaiting states |
| `--color-red` / `-bg` | `#a32d2d` / `#fcebeb` | Error, danger, overdue |
| `--color-blue` / `-bg` | `#185fa5` / `#e6f1fb` | Info, delivered |
| `--color-background-primary` | `#ffffff` | Page background (marketing pages) |
| `--color-background-secondary` | `#fafafa` | Alternating sections, app shell background |
| `--color-background-tertiary` | `#f5f5f5` | Inline code, muted badges, hover fills |
| `--color-text-primary` | `#111111` | Headings, emphasised text |
| `--color-text-secondary` | `#555555` | Body copy, secondary links |
| `--color-text-tertiary` | `#8a8a8a` | Meta text, timestamps, placeholders |
| `--color-text-eyebrow` | `#6b6b6b` | Uppercase eyebrow labels only |
| `--color-border-primary` | `#d4d4d4` | Strongest border (outlined buttons) |
| `--color-border-secondary` | `#e5e5e5` | Dividers (`hr`, step connectors) |
| `--color-border-tertiary` | `#ededed` | Default hairline: cards, header/footer rules |

A legacy token set (`--brand`, `--surface`, `--muted`, …) exists for
non-overhauled pages. New surfaces should use the `--color-*` set; the only
legacy token still used on marketing pages is `--brand` for the wordmark colour.

## Typography

- **Family:** `font-sans` → `Inter, system-ui, sans-serif` (`tailwind.config.ts`).
  No webfont is loaded via `next/font`; the stack resolves to whatever the system
  provides. Do not add a font import to one page — that IS drift.
- **Weights:** `font-medium` (500) for all headings, buttons, and emphasis;
  regular (400) for body. `font-extrabold` appears **only** in the `certnow`
  wordmark (frozen — never restyle). `font-semibold`/`font-bold` are not part of
  the marketing language.
- **Case:** sentence case everywhere. Uppercase only for eyebrow labels.

Marketing type scale (from the landing page):

| Role | Spec |
| --- | --- |
| Page h1 | `text-[30px] font-medium leading-[1.15] tracking-[-0.5px]` |
| Section h2 | `text-[24px] font-medium tracking-[-0.3px]` |
| Card / item title | `text-[15px] font-medium` (app `CardTitle`: `text-base font-medium`) |
| Body (lead) | `text-[15px] leading-[1.65] text-[var(--color-text-secondary)]` |
| Body (card) | `text-[13px] leading-[1.6] text-[var(--color-text-secondary)]` |
| Buttons | `text-[15px] font-medium` (large) / `text-[14px]` (small) |
| Meta / footnote | `text-[12px] text-[var(--color-text-tertiary)]` |
| Eyebrow | `text-[11px] uppercase tracking-[1.5px] text-[var(--color-text-eyebrow)]` |

## Spacing & layout

- Marketing pages are **mobile-first, single column, full width** with `px-5`
  horizontal padding; sections use `py-10` (`pt-11 pb-9` for heroes) and alternate
  `background-primary` / `background-secondary`.
- Long-form reading surfaces (blog articles) add `mx-auto max-w-[68ch]` for
  measure; the blog index uses `max-w-[640px]`. That is a readability concession,
  not a new grid system.
- Card internal padding: `p-[18px]` (marketing) or `px-[18px]` + vertical from
  `CardHeader`/`CardContent` (app). Gaps between stacked cards: `gap-3`.
- Header height: `h-14`, sticky, `z-30`.

## Borders, radius, shadows

- **Hairlines everywhere:** `border-[0.5px]` with `--color-border-tertiary` for
  cards and horizontal rules; `--color-border-primary` for outlined buttons.
- **Radius values in use:** `rounded-[16px]` cards & tables · `rounded-[12px]`
  icon tiles · `rounded-[8px]` small banners/inline code · `rounded-full` pills,
  badges, buttons. Buttons written as `rounded-[20/22/26/28px]` on the landing
  page are height/2 — i.e. pills; use `rounded-full`. Do not add other values.
- **Shadows:** marketing surfaces are flat (no shadow). `--shadow-elevated` and
  the `.card` class belong to legacy app pages only.

## Buttons

Shared component: `src/components/ui/button.tsx` (`Button`, supports `asChild`
to style a `next/link`). Variants: `primary` (cta), `action` (green), `secondary`,
`outline`, `ghost`, `danger`. Hover states live in the component — reuse them.

Landing-page sizes (apply via `className` on `Button asChild`):

| Use | Spec |
| --- | --- |
| Header pill ("Try free") | `h-9 px-4 text-[14px]` primary |
| Header pill ("Log in") | `h-9 px-4 text-[14px]` outline, `text-[var(--color-text-secondary)]` |
| Hero / signup CTA | `h-12 px-6 text-[15px]` primary |
| Full-width closing CTA | `h-[52px] w-full text-[16px]` primary |
| Secondary hero action | `h-11 text-[14px]` outline |

## Cards, badges, pills

- Card: `rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)]
  bg-[var(--color-background-primary)] p-[18px]` — or the shared `Card` component.
- Icon tile inside a card: `h-10 w-10 rounded-[12px] bg-[var(--color-action-bg)]
  text-[var(--color-action)]`.
- Badge/pill: shared `Badge` component (`rounded-full px-2.5 py-1 text-[11px]
  font-medium`; variants `muted`, `accent`, `brand`, `outline`).
- Interactive card hover: `hover:bg-[var(--color-background-tertiary)]
  transition-colors` (same fill the `outline`/`ghost` button hovers use).

## Links

- Inline text links: `text-[var(--color-action)]`, no persistent underline
  (landing convention); long-form prose adds `hover:underline` for affordance.
- Navigation-style links (header, footer, TOC, breadcrumbs):
  `text-[var(--color-text-secondary)]`, `hover:text-[var(--color-text-primary)]`.

## Shared marketing chrome

`src/app/_components/marketing-chrome.tsx` exports `MarketingHeader` and
`MarketingFooter` — used by the landing page (`/`) and the blog. Public
marketing surfaces must import these, never re-implement them.

## House rules

- The CertNow logo SVG and wordmark styling are **frozen**.
- Sentence case; no ALL-CAPS labels outside eyebrows.
- Every colour must come from the `--color-*` variables (dark mode depends on it).
