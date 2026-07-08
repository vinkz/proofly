# CertNow launch video (Remotion)

Self-contained 2.5D launch video. **No Three.js / R3F / 3D** — pure Remotion + DOM.
1080×1920 vertical, 30fps, 35s (`CertNowLaunch`).

## Scripts (run from this `/video` dir)

| Script | What |
| --- | --- |
| `npm run video:preview` | Open Remotion Studio |
| `npm run video:render:draft` | Half-res h264 draft → `out/certnow-launch-draft.mp4` |
| `npm run video:render` | Full-quality h264 (crf 16, 16M) → `out/certnow-launch.mp4` |
| `npm run video:cover` | Export frame 0 PNG (upload cover) → `out/cover.png` |

Renders pass `--muted` (the video has no audio; this also avoids a macOS-version
mismatch in Remotion's silent-audio step on older macOS).

In Studio, the **`CertNowLaunch-SafeZones`** composition renders the same video with
the TikTok safe-zone overlay on (middle-75% box + bottom-250px / right-120px bands).

## Structure

- `src/theme.ts` — colours, radii, font mirrored **exactly** from `DESIGN_TOKENS.md` +
  `globals.css`. No new colours/fonts anywhere.
- `src/anim.ts` — shared spring-with-overshoot motion language (0.6–1.2s feel).
- `src/scenes/*` — the eight scenes, each taking its **copy as props** (variant-ready).
- `src/components/*` — device frame, count-up timer, grain, vignette, safe-zone.
- `src/ui/mock.tsx` + `src/ui/icons.tsx` — **stylised UI panels** in the landing-page
  language (design-token colours, feather icons, Pass pills, progress bars). Referenced
  by key from the hero/landlord/dashboard scenes.
- `src/CertNowLaunch.tsx` — sequences the scenes + global overlays. `TIMINGS` holds the cut points.
- `src/Root.tsx` — composition registration + all default copy/props.

## App UI = stylised, not screenshots

The product screens are **stylised recreations** in the landing-page style (`src/ui/mock.tsx`),
not screenshots — self-contained, on-brand, and free of real-data artefacts (messy fields,
sparse dashboards, missing PDFs). The CP12 in the certificate scene is a faithful recreation;
to show a **real** PDF page instead, drop an image into `public/assets/` and set
`certificate.image` in `Root.tsx`.

`public/assets/*.png` (real captured screens) and `scripts/capture-screens.mjs` remain in the
repo as an optional real-screenshot path (`DeviceFrame src=…`), but are **not used** by the
current render.

## Adding R3F hero scenes later

This composition is standalone. Add 3D as **separate** compositions/sequences (with
`@remotion/three`) without touching these files.
