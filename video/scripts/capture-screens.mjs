/**
 * Re-capture the app screenshots used by the video (public/assets/*.png).
 *
 * Screens are auth-gated, so this reuses a logged-in session via a Playwright
 * storageState JSON. To produce one WITHOUT sharing credentials:
 *   1. Log into https://certnow.uk in your browser.
 *   2. In the devtools console on any certnow page, run:
 *        copy(JSON.stringify({cookies: document.cookie.split(';').map(s=>s.trim())
 *          .filter(Boolean).map(p=>{const i=p.indexOf('=');return{name:p.slice(0,i),
 *          value:p.slice(i+1),domain:'.certnow.uk',path:'/',expires:-1,httpOnly:false,
 *          secure:true,sameSite:'Lax'}}), origins: []}))
 *      and paste into a file, e.g. state.json (this is your own session — keep it private).
 *   3. Run: STATE=./state.json node scripts/capture-screens.mjs
 *
 * Screens are captured at 440x950 @3x (1320x2850) in light theme with reduced motion.
 * Wizard steps 2+ need a job context; edit JOB / advance clicks as needed.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const STATE = process.env.STATE;
if (!STATE || !fs.existsSync(STATE)) {
  console.error('Set STATE=/path/to/storageState.json (see header comment).');
  process.exit(1);
}
const OUT = 'public/assets';
fs.mkdirSync(OUT, { recursive: true });

// force light theme for consistent captures
const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));
for (const c of state.cookies) if (c.name === 'theme') c.value = 'light';
const tmpState = OUT + '/.state-light.json';
fs.writeFileSync(tmpState, JSON.stringify(state));

const pages = [
  { name: 'dashboard', url: 'https://certnow.uk/dashboard' },
  { name: 'properties', url: 'https://certnow.uk/properties' },
  { name: 'jobs-new', url: 'https://certnow.uk/jobs/new' },
  { name: 'cp12-step1', url: 'https://certnow.uk/wizard/create/cp12?jobId=REPLACE_JOB_ID&startStep=1' },
  { name: 'property-vault', url: 'https://certnow.uk/p/REPLACE_TOKEN' },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: tmpState,
  viewport: { width: 440, height: 950 },
  deviceScaleFactor: 3,
  isMobile: true,
  reducedMotion: 'reduce',
  colorScheme: 'light',
});
const page = await ctx.newPage();
for (const p of pages) {
  await page.goto(p.url, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape').catch(() => {});
  await page.screenshot({ path: `${OUT}/${p.name}.png` });
  console.log('captured', p.name);
}
fs.rmSync(tmpState, { force: true });
await browser.close();
