import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const wizard = readFileSync(
  join(ROOT, 'src/app/(wizard)/wizard/create/[certificateType]/_components/certificate-wizard.tsx'),
  'utf8',
);
const layout = readFileSync(join(ROOT, 'src/components/certificates/wizard-layout.tsx'), 'utf8');
const jobForm = readFileSync(join(ROOT, 'src/components/jobs/solo-job-form.tsx'), 'utf8');
const preference = readFileSync(join(ROOT, 'src/lib/wizard/single-page-preference.ts'), 'utf8');

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
    // Private mode throws on localStorage access. Both read and write swallow
    // it, and the fallback is the stepped flow that has always shipped.
    expect((preference.match(/catch/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(preference).toContain('return false');
  });
});

/**
 * The layout toggle was only half the problem. Reaching the certificate meant
 * five steps in the job form before the wizard even loaded — and two of those
 * collect the landlord and the job address, which the wizard's own first step
 * also collects, which is why it was then skipped with startStep=2. On one
 * page there is nothing to skip to, so the preamble has no work left to do.
 */
describe('the route into a certificate', () => {
  it('reads the same preference in both screens, from one place', () => {
    expect(preference).toContain('certnow.cp12-wizard.single-page.v1');
    for (const file of [wizard, jobForm]) {
      expect(file).toContain("from '@/lib/wizard/single-page-preference'");
      // Neither may keep its own copy of the key and drift.
      expect(file).not.toContain('certnow.cp12-wizard.single-page');
    }
  });

  it('hands straight over on "fill details myself" instead of two more steps', () => {
    expect(jobForm).toMatch(/if \(singlePageCert\) \{[\s\S]{0,400}setHandOverPending\(true\)/);
  });

  it('waits for the submit mode to commit before submitting', () => {
    // setSubmitMode is async; submitting in the same handler reads the previous
    // mode and returns the engineer to the job list instead of the certificate.
    expect(jobForm).toMatch(/if \(!handOverPending \|\| submitMode !== 'continue'\) return;/);
  });

  it('does not skip the wizard first step when everything is on one page', () => {
    expect(jobForm).toMatch(/shouldSkipFirstWizardStep =[\s\S]{0,20}!singlePageCert/);
  });

  it('leaves the stepped flow intact when the preference is off', () => {
    // Every fast path is gated. Nothing changes for an engineer who has not
    // opted in, which is what makes this safe on the revenue path.
    const fastPaths = jobForm.match(/singlePageCert/g) ?? [];
    expect(fastPaths.length).toBeGreaterThanOrEqual(4);
    expect(jobForm).toContain('setStep(4)');
  });
});
