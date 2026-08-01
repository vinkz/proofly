import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const wizard = readFileSync(
  join(ROOT, 'src/app/(wizard)/wizard/create/[certificateType]/_components/certificate-wizard.tsx'),
  'utf8',
);
const layout = readFileSync(join(ROOT, 'src/components/certificates/wizard-layout.tsx'), 'utf8');

/**
 * Single-page mode is a layout toggle, not a second form.
 *
 * The whole reason it can exist without becoming another thing to keep in step
 * is that it shares the wizard's state, its per-step autosave and its offline
 * fallback — only the chrome differs. These assertions exist to keep that true:
 * the day someone forks the state to make the layout easier, the free tool and
 * the wizard start drifting again, which is the bug class this session spent
 * most of its time undoing.
 */
describe('CP12 single-page mode', () => {
  it('renders every step, so nothing is only reachable by stepping', () => {
    const stacked = wizard.slice(wizard.indexOf('if (singlePage) {'));
    for (const step of ['{StepOne}', '{StepTwo}', '{StepThree}', '{StepFour}']) {
      expect(stacked, `${step} missing from the stacked render`).toContain(step);
    }
  });

  it('drops the per-step chrome rather than duplicating the steps', () => {
    expect(wizard).toContain("variant={singlePage ? 'section' : 'step'}");
    expect(layout).toMatch(/variant\?: 'step' \| 'section'/);
  });

  it('flattens the appliance sub-tabs instead of nesting navigation', () => {
    for (const tab of ['inspection', 'readings', 'safety']) {
      expect(wizard).toContain(`singlePage || checksTab === '${tab}'`);
    }
    // The tab bar itself has nothing to switch between once all three render.
    expect(wizard).toContain('inApplianceDetail && !singlePage ?');
  });

  it('is reachable and reversible from both layouts', () => {
    expect(wizard).toContain('headerAction={layoutToggle}');
    expect(wizard).toMatch(/Use step-by-step/);
    expect(wizard).toMatch(/Show on one page/);
  });

  it('keeps one source of state — no forked save path', () => {
    // Exactly one save routine, one draft key, one offline fallback. If a
    // single-page-specific save appears, this is where it gets caught.
    expect(wizard.match(/Saved on this device/g)?.length).toBe(2);
    expect(wizard).toContain('Offline draft synced');
    expect(wizard).not.toMatch(/singlePage[\s\S]{0,80}saveCp12/);
  });

  it('survives a browser that refuses local storage', () => {
    const pref = wizard.slice(wizard.indexOf('const [singlePage'), wizard.indexOf('const layoutToggle'));
    expect((pref.match(/catch/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
