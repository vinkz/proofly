/**
 * Render CertNowLaunch WITHOUT Remotion's platform compositor (which is built
 * for macOS 15 and SIGABRTs on older macOS at the video-mux step).
 *
 * Strategy: render a frame sequence (uses headless Chrome — works everywhere),
 * then mux with a real ffmpeg:
 *   - a system `ffmpeg` with libx264  -> h264 .mp4   (preferred; `brew install ffmpeg`)
 *   - else Playwright's bundled ffmpeg -> VP8 .webm  (fallback, always available here)
 *
 * Usage: node scripts/render.mjs [full|draft]
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const mode = (process.argv[2] || 'full').toLowerCase();
const draft = mode === 'draft';

// Guard: this project has its own pinned Remotion in /video/node_modules. If it
// isn't installed, `npx remotion` resolves the parent repo's Remotion and fails
// with "Cannot find module '@remotion/tailwind-v4'". Make the fix obvious.
if (!fs.existsSync('node_modules/@remotion/cli')) {
  console.error('\n✖ Dependencies not installed in /video.\n  Run `npm install` in this directory first, then re-run the render.\n');
  process.exit(1);
}
const COMP = 'CertNowLaunch';
const scale = draft ? '0.5' : '1';
// JPEG frames keep the temp sequence small (~10x smaller than PNG) — important
// on low-free-disk machines. High quality (92) is indistinguishable after h264.
const imgFormat = 'jpeg';
const ext = 'jpeg';
const jpegQuality = draft ? 80 : 92;

fs.mkdirSync('out', { recursive: true });
const seqDir = path.join('out', `seq-${mode}`);
fs.rmSync(seqDir, { recursive: true, force: true });
fs.mkdirSync(seqDir, { recursive: true });

console.log(`▶ rendering frames (${mode}, scale ${scale}, ${imgFormat}) …`);
execSync(
  `npx remotion render ${COMP} ${seqDir} --sequence --scale=${scale} --image-format=${imgFormat} --jpeg-quality=${jpegQuality}`,
  { stdio: 'inherit' },
);

// ---- choose an ffmpeg ----
function hasLibx264(bin) {
  try {
    const enc = execSync(`${bin} -hide_banner -encoders`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    return /libx264/.test(enc);
  } catch {
    return false;
  }
}
function playwrightFfmpeg() {
  const base = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  if (!fs.existsSync(base)) return null;
  const dir = fs.readdirSync(base).filter((d) => d.startsWith('ffmpeg-')).sort().pop();
  if (!dir) return null;
  const bin = path.join(base, dir, 'ffmpeg-mac');
  return fs.existsSync(bin) ? bin : null;
}
// Optional prebuilt ffmpeg (has libx264) — `npm i -D ffmpeg-static`. A quick
// download, no compiling — the fast route to an MP4 on machines without brew ffmpeg.
function staticFfmpeg() {
  for (const p of ['node_modules/ffmpeg-static/ffmpeg', 'node_modules/.bin/ffmpeg']) {
    if (fs.existsSync(p) && hasLibx264(p)) return p;
  }
  return null;
}

// Prefer any ffmpeg with libx264 (→ MP4); fall back to Playwright's VP8 (→ WebM).
const x264bin = (hasLibx264('ffmpeg') && 'ffmpeg') || staticFfmpeg();
let bin, codec, outFile;
if (x264bin) {
  bin = x264bin;
  codec = 'h264';
  outFile = path.join('out', draft ? 'certnow-launch-draft.mp4' : 'certnow-launch.mp4');
} else {
  const pw = playwrightFfmpeg();
  if (!pw) {
    console.error('No ffmpeg found. `npm i -D ffmpeg-static` (fast) or `brew install ffmpeg` for an MP4.');
    process.exit(1);
  }
  bin = pw;
  codec = 'vp8';
  outFile = path.join('out', draft ? 'certnow-launch-draft.webm' : 'certnow-launch.webm');
  console.log('ℹ no ffmpeg with libx264 — encoding WebM. For MP4: `npm i -D ffmpeg-static`, then re-run.');
}

const inCodec = ext === 'png' ? 'png' : 'mjpeg';
console.log(`▶ muxing → ${outFile} (${codec}) …`);

// Pipe frames in via image2pipe for BOTH codecs — padding-agnostic (Remotion's
// zero-pad width depends on frame count, e.g. 3 digits under 1000 frames) and
// works with both ffmpeg-static and Playwright's minimal ffmpeg.
const encodeArgs =
  codec === 'h264'
    ? `-c:v libx264 -preset slow -crf ${draft ? 23 : 17} -pix_fmt yuv420p -movflags +faststart`
    : `-c:v libvpx -b:v ${draft ? '4M' : '8M'} -auto-alt-ref 0 -pix_fmt yuv420p -an`;
execSync(
  `find "${seqDir}" -name 'element-*.${ext}' -print0 | sort -z | xargs -0 cat | ` +
    `"${bin}" -y -f image2pipe -framerate 30 -c:v ${inCodec} -i pipe:0 ${encodeArgs} "${outFile}"`,
  { stdio: 'inherit', shell: '/bin/bash' },
);

fs.rmSync(seqDir, { recursive: true, force: true });
console.log(`✔ done → ${outFile}`);
