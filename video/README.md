# CertNow launch video (Remotion)

Self-contained 2.5D launch video. **No Three.js / R3F / 3D** — pure Remotion + DOM.
1080×1920 vertical, 30fps, ~33s (`CertNowLaunch`).

## First run

This project is **self-contained** with its own pinned Remotion — it is NOT part of the
parent repo's install. Before anything else:

```bash
cd video && npm install
```

(Skipping this makes `npx remotion` resolve the parent repo's Remotion and fail with
`Cannot find module '@remotion/tailwind-v4'`.)

## Scripts (run from this `/video` dir)

| Script | What |
| --- | --- |
| `npm run video:preview` | Open Remotion Studio |
| `npm run video:render:draft` | Half-res draft → `out/certnow-launch-draft.{mp4\|webm}` |
| `npm run video:render` | Full-quality → `out/certnow-launch.{mp4\|webm}` |
| `npm run video:cover` | Export frame 0 PNG (upload cover) → `out/cover.png` |

### Rendering (important — SIGABRT workaround)

Remotion's platform **compositor binary is built for macOS 15**; on older macOS it
**SIGABRTs at the video-mux step** (`Symbol not found: _AVCaptureDeviceTypeContinuityCamera`).
Frame rendering itself is fine, so `video:render` uses `scripts/render.mjs`: it renders a
**frame sequence** (headless Chrome) and muxes with a real ffmpeg, auto-picking output:

- **system `ffmpeg` with libx264 → h264 `.mp4`** (preferred). Get it with `brew install ffmpeg`.
- **`ffmpeg-static` (prebuilt, has libx264) → h264 `.mp4`** — the fast route on macOS where
  Homebrew compiles ffmpeg from source. Install once: `npm i -D ffmpeg-static`.
- **else Playwright's bundled ffmpeg → VP8 `.webm`** (fallback, no install needed).

So for a proper **MP4**: `brew install ffmpeg` once, then `npm run video:render`.
On macOS 15 you can also use the direct path: `npm run video:render:native`.

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
sparse dashboards). The certificate scene shows the **real** CP12 (`public/assets/cp12-page1.png`,
rasterised from `cp12.pdf` via `qlmanage`); `certificate.image` in `Root.tsx` points at it.
Set `certificate.image` to `undefined` to fall back to the stylised recreation.

`public/assets/*.png` (real captured screens) and `scripts/capture-screens.mjs` remain in the
repo as an optional real-screenshot path (`DeviceFrame src=…`), but are **not used** by the
current render.

## Adding R3F hero scenes later

This composition is standalone. Add 3D as **separate** compositions/sequences (with
`@remotion/three`) without touching these files.
