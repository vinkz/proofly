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
const COMP = 'CertNowLaunch';
const scale = draft ? '0.5' : '1';
const imgFormat = draft ? 'jpeg' : 'png';
const ext = imgFormat;

fs.mkdirSync('out', { recursive: true });
const seqDir = path.join('out', `seq-${mode}`);
fs.rmSync(seqDir, { recursive: true, force: true });
fs.mkdirSync(seqDir, { recursive: true });

console.log(`▶ rendering frames (${mode}, scale ${scale}, ${imgFormat}) …`);
execSync(`npx remotion render ${COMP} ${seqDir} --sequence --scale=${scale} --image-format=${imgFormat}`, {
  stdio: 'inherit',
});

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

let bin, codec, outFile;
if (hasLibx264('ffmpeg')) {
  bin = 'ffmpeg';
  codec = 'h264';
  outFile = path.join('out', draft ? 'certnow-launch-draft.mp4' : 'certnow-launch.mp4');
} else {
  const pw = playwrightFfmpeg();
  if (!pw) {
    console.error('No ffmpeg found. Install one with `brew install ffmpeg` for an MP4.');
    process.exit(1);
  }
  bin = pw;
  codec = 'vp8';
  outFile = path.join('out', draft ? 'certnow-launch-draft.webm' : 'certnow-launch.webm');
  console.log('ℹ no system ffmpeg with libx264 — encoding WebM. `brew install ffmpeg` for an MP4.');
}

const inCodec = ext === 'png' ? 'png' : 'mjpeg';
console.log(`▶ muxing → ${outFile} (${codec}) …`);

if (codec === 'h264') {
  // system ffmpeg: read the numbered files directly (image2 demuxer)
  const crf = draft ? 23 : 17;
  execSync(
    `ffmpeg -y -framerate 30 -i "${seqDir}/element-%04d.${ext}" ` +
      `-c:v libx264 -preset slow -crf ${crf} -pix_fmt yuv420p -movflags +faststart "${outFile}"`,
    { stdio: 'inherit' },
  );
} else {
  // playwright ffmpeg is minimal — pipe frames via image2pipe
  execSync(
    `find "${seqDir}" -name 'element-*.${ext}' -print0 | sort -z | xargs -0 cat | ` +
      `"${bin}" -y -f image2pipe -framerate 30 -c:v ${inCodec} -i pipe:0 ` +
      `-c:v libvpx -b:v ${draft ? '4M' : '8M'} -auto-alt-ref 0 -pix_fmt yuv420p -an "${outFile}"`,
    { stdio: 'inherit', shell: '/bin/bash' },
  );
}

fs.rmSync(seqDir, { recursive: true, force: true });
console.log(`✔ done → ${outFile}`);
