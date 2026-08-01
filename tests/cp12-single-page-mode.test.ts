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
  it('keeps the layout preference in one module, owned by the wizard', () => {
    expect(preference).toContain('certnow.cp12-wizard.single-page.v1');
    expect(wizard).toContain("from '@/lib/wizard/single-page-preference'");
    // No second copy of the key to drift from the first.
    expect(wizard).not.toContain('certnow.cp12-wizard.single-page');
  });

  it('hands straight over when the engineer is doing it now', () => {
    // Anchored on the comment, which appears once — there is more than one
    // setPath('self') in the file and the other is a reset, not the button.
    const start = jobForm.indexOf('Straight to the certificate');
    expect(start, 'handover branch not found').toBeGreaterThan(-1);
    const handler = jobForm.slice(start - 200, start + 800);
    expect(handler).toContain("if (timing === 'now')");
    expect(handler).toContain('setHandOverPending(true)');
  });

  it('asks when and how to start on one screen', () => {
    // Two halves of one decision — "I am stood at this property" or "I am
    // putting it in the diary". Splitting them made booking and doing feel
    // like the same long flow.
    expect(jobForm).toContain("const [timing, setTiming] = useState<'now' | 'later'>('now')");
    expect(jobForm).toContain('Doing it now');
    expect(jobForm).toContain('Book for later');
  });

  it('does not gate the handover on a preference set on the far side of it', () => {
    // The layout toggle lives in the wizard, past the steps it was meant to
    // skip, so gating the handover on it meant it could never fire first.
    expect(jobForm).not.toContain('singlePageCert');
  });

  it('still asks for the landlord when the two steps were skipped', () => {
    // Handing over means steps 4 and 5 never ran, so the wizard's first step is
    // the only place left that collects the landlord and the job address.
    // Skipping it too would issue a certificate with no landlord on it.
    expect(jobForm).toContain("const handedOverEarly = timing === 'now' && path === 'self'");
    expect(jobForm).toMatch(/shouldSkipFirstWizardStep =[\s\S]{0,40}!handedOverEarly/);
  });

  it('waits for the submit mode to commit before submitting', () => {
    // setSubmitMode is async; submitting in the same handler reads the previous
    // mode and returns the engineer to the job list instead of the certificate.
    expect(jobForm).toMatch(/if \(!handOverPending \|\| submitMode !== 'continue'\) return;/);
  });

  it('asks when, and how to start, on the screen that already asks both', () => {
    // solo-job-form has TWO "How do you want to start?" blocks — one on step 1
    // beside the job type, one on step 3. Step 1 is the one an engineer
    // actually reaches from /jobs/new; four rounds of changes went into the
    // other, which is why none of them appeared. These pin the live one.
    const stepOne = jobForm.slice(
      jobForm.indexOf('{step === 1 ?'),
      jobForm.indexOf('{step === 2 ?'),
    );
    expect(stepOne).toContain('Doing it now');
    expect(stepOne).toContain('Book for later');
    expect(stepOne).toContain('Fill myself');
    expect(stepOne).toContain('Existing landlord');
  });

  it('lets the job type be chosen without navigating away from it', () => {
    // Advancing on tap sent the engineer to step 3 — a duplicate of the start
    // options they were already looking at.
    const stepOne = jobForm.slice(
      jobForm.indexOf('{step === 1 ?'),
      jobForm.indexOf('{step === 2 ?'),
    );
    expect(stepOne).not.toContain('setStep(hasInitialSelection ? 4 : 3)');
  });

  it('sends "fill myself, doing it now" straight to the certificate', () => {
    const handler = jobForm.slice(
      jobForm.indexOf('const startManualEntry'),
      jobForm.indexOf('const startExistingLandlordEntry'),
    );
    expect(handler).toContain("if (timing === 'now')");
    expect(handler).toContain('setHandOverPending(true)');
    expect(handler).toContain('setStep(4)');
  });

  it('goes from job type to the decision, not to a landlord picker', () => {
    // Choosing a saved landlord is one way to start, not a screen everyone
    // walks first — and with a long client list it always rendered, so it sat
    // between the job type and the only choice that actually shortcuts.
    expect(jobForm).toContain('Use a saved landlord or property');
  });

  it('honours "doing it now" after picking a saved landlord too', () => {
    // Otherwise the shortcut only worked for brand-new landlords, and anyone
    // reusing a customer was quietly put back on the long route.
    const picker = jobForm.slice(jobForm.indexOf('Always render Continue'));
    expect(picker.slice(0, 900)).toContain("if (timing === 'now')");
  });

  it('keeps the stepped route for anything that is not "doing it now"', () => {
    // Booking for later, asking the landlord, or requesting details all still
    // walk the original steps — only the stood-at-the-property path shortcuts.
    expect(jobForm).toContain('setStep(4)');
  });
});
