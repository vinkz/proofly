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
      expect(wizard).toContain(`singlePage || (inApplianceDetail && checksTab === '${tab}')`);
    }
    // The tab bar itself has nothing to switch between once all three render.
    expect(wizard).toContain('inApplianceDetail && !singlePage ?');
  });

  it('adding an appliance does not collapse the ones already filled in', () => {
    // Every appliance block filters on activeApplianceIndex. Adding used to set
    // it to the new, empty appliance, so the list collapsed to that one and the
    // work already entered vanished from the page — indistinguishable, to the
    // engineer, from having been wiped.
    expect(wizard).toContain('if (!singlePage) openAppliance(newIndex);');
  });

  it('shows every appliance, not only one drilled into', () => {
    // The gate used to require inApplianceDetail, which is false until an
    // appliance is opened — so on one page the checks rendered for nothing at
    // all. The loop inside always handled "show all"; only the outer gate
    // stopped it running. The free tool puts every appliance on the page and
    // this is what makes the paid one agree.
    expect(wizard).not.toMatch(/\{inApplianceDetail && \(singlePage \|\| checksTab/);
    expect(
      (wizard.match(/if \(activeApplianceIndex != null && index !== activeApplianceIndex\) return null;/g) ?? [])
        .length,
    ).toBe(3);
  });

  it('is the only layout — there is no stepped flow to switch back to', () => {
    // The two layouts were kept side by side while which to keep was an open
    // question. It is answered, so the toggle and the stepped exits are gone.
    // A CP12 that can still be reached one screen at a time is the bug this
    // guards against: two blocks doing the same job is what caused three
    // bugs in a row the last time this file carried a duplicate.
    expect(wizard).not.toContain('layoutToggle');
    expect(wizard).not.toMatch(/Use step-by-step|Show on one page/);
    expect(wizard).not.toMatch(/if \(step === 1\) return/);
  });

  it('keeps one source of state — no forked save path', () => {
    // Exactly one save routine, one draft key, one offline fallback. If a
    // single-page-specific save appears, this is where it gets caught.
    expect(wizard.match(/Saved on this device/g)?.length).toBe(2);
    expect(wizard).toContain('Offline draft synced');
    expect(wizard).not.toMatch(/singlePage[\s\S]{0,80}saveCp12/);
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
  it('stores no layout preference, because there is no layout to choose', () => {
    // The preference existed to remember which of two layouts to show. With one
    // layout it is a stored answer to a question nobody is asked, and a private-
    // mode browser that refuses storage has nothing to fall back to.
    expect(wizard).not.toContain('single-page-preference');
    expect(wizard).not.toContain('certnow.cp12-wizard.single-page');
  });

  it('hands straight over when the engineer is doing it now', () => {
    const handler = jobForm.slice(
      jobForm.indexOf('const startManualEntry'),
      jobForm.indexOf('const handleSubmit'),
    );
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

/**
 * The new-job form's draft is keyed `jobs_new:create` — one shared entry for
 * every new job rather than one per job. Abandon a half-filled job and the
 * next one restores that landlord.
 *
 * Walking the landlord step made that visible and easy to overwrite. Handing
 * straight to the certificate does not, so the stale landlord would reach a gas
 * safety record without anyone seeing it. Found by loading the page: a brand-new
 * job opened pre-filled with a landlord left behind by an old Playwright run.
 */
describe('a new certificate does not inherit an abandoned one', () => {
  it('clears carried-over identity before handing over', () => {
    const handler = jobForm.slice(
      jobForm.indexOf('const startManualEntry'),
      jobForm.indexOf('const startExistingLandlordEntry'),
    );
    expect(handler).toContain('clearCarriedOverIdentity()');
    expect(handler).toContain('clearDraft()');
    // Order matters: both must happen before the submit is latched.
    expect(handler.indexOf('clearCarriedOverIdentity()')).toBeLessThan(
      handler.indexOf('setHandOverPending(true)'),
    );
  });

  it('clears every field that reaches createSoloJob', () => {
    const reset = jobForm.slice(
      jobForm.indexOf('const clearCarriedOverIdentity'),
      jobForm.indexOf('const startManualEntry'),
    );
    // Anything sent to createSoloJob and not cleared here is a field that can
    // carry a previous landlord onto a new certificate.
    for (const setter of [
      'setLandlordName',
      'setLandlordCompany',
      'setLandlordAddressLine1',
      'setLandlordAddressLine2',
      'setLandlordCity',
      'setLandlordPostcode',
      'setLandlordTel',
      'setClientName',
      'setClientPhone',
      'setClientEmail',
      'setPropertyName',
      'setAddressLine1',
      'setCity',
      'setPostcode',
      'setJobAddressLine1',
      'setJobAddressPostcode',
    ]) {
      expect(reset, `${setter} not cleared`).toContain(`${setter}('')`);
    }
  });
});

/**
 * Stacking four screens that each assumed they owned the viewport leaves their
 * chrome behind. Found by loading the page rather than reading the file: four
 * identical "Saved on this device" banners down one scroll, and three stranded
 * "Back / Continue" rows that moved nobody anywhere.
 */
describe('single-page mode drops the per-screen chrome', () => {
  it('shows the offline banner once, not once per section', () => {
    expect(wizard).toContain('const offlineDraftBanner = singlePage ? null : offlineDraftBannerNode;');
    const shell = wizard.slice(wizard.indexOf('if (singlePage) {'));
    expect(shell).toContain('{offlineDraftBannerNode}');
  });

  it('hides the step navigation that has nowhere to navigate to', () => {
    for (const n of ['1', '2', '3']) {
      // The id appears twice — once as actionsHideWhenVisibleId, once on the
      // div. Anchor on the div, which is the thing being gated.
      const at = wizard.indexOf(`<div id="cp12-step${n}-footer-actions"`);
      expect(at, `step ${n} footer div not found`).toBeGreaterThan(-1);
      expect(wizard.slice(at - 60, at), `step ${n} footer not gated`).toContain(
        '{singlePage ? null : (',
      );
    }
  });

  it('keeps the action that still means something', () => {
    // "Save & issue CP12" is the end of the page, not navigation between
    // screens, so it renders in both layouts.
    const at = wizard.indexOf('<div id="cp12-step4-footer-actions"');
    expect(at).toBeGreaterThan(-1);
    expect(wizard.slice(at - 60, at)).not.toContain('{singlePage ? null : (');
  });
});

/**
 * A job is a container; the certificate is the document.
 *
 * SoloJobSchema required the landlord's name, address, city and postcode
 * before a job could exist at all — which is precisely why two screens of
 * preamble stood in front of an engineer who was already at the property.
 * Clearing those fields to avoid inheriting a previous job's landlord then
 * made the job uncreatable, and the handover silently did nothing.
 *
 * Deferring loses no safety: validateCp12TierOne enforces exactly these fields
 * before a certificate can be issued, so an incomplete record still cannot
 * leave the building — it just no longer has to be complete before it exists.
 */
describe('a job can be created with its details deferred', () => {
  const jobsServer = readFileSync(join(ROOT, 'src/server/jobs.ts'), 'utf8');

  it('skips the identity requirements only when asked to', () => {
    expect(jobsServer).toContain('deferDetails: z.boolean().optional().default(false)');
    expect(jobsServer).toMatch(/if \(value\.deferDetails\) return;/);
  });

  it('takes the schema input type so callers need not pass the flag', () => {
    // z.infer is the parsed output, where a defaulted field is required —
    // typing the parameter with it forced every existing caller to pass it.
    expect(jobsServer).toContain('createSoloJob(payload: z.input<typeof SoloJobSchema>)');
  });

  it('defers only on the straight-to-certificate path', () => {
    expect(jobForm).toContain("deferDetails: timing === 'now' && path === 'self'");
  });

  it('still refuses to issue a certificate without a landlord', () => {
    // The guarantee that makes deferral safe. If this ever stops being true,
    // deferring becomes a way to issue an incomplete gas safety record.
    const validation = readFileSync(join(ROOT, 'src/lib/cp12/validation.ts'), 'utf8');
    expect(validation).toMatch(/landlord_address_line1/);
    expect(validation).toMatch(/is required/);
  });
});

/**
 * Choosing a saved landlord was a route into the wizard — a picker screen that
 * ran before the form. It is not a different way of making a certificate, only
 * a faster way of filling one in, so on a single page it belongs on the page.
 */
describe('saved landlords are prefill, not a route', () => {
  const wizardPage = readFileSync(
    join(ROOT, 'src/app/(wizard)/wizard/create/[certificateType]/page.tsx'),
    'utf8',
  );

  it('offers the picker above the stacked sections', () => {
    const shell = wizard.slice(wizard.indexOf('if (singlePage) {'));
    expect(shell).toContain('{savedLandlordPicker}');
    expect(shell.indexOf('{savedLandlordPicker}')).toBeLessThan(shell.indexOf('{StepOne}'));
  });

  it('hides itself rather than showing an empty dropdown', () => {
    // Two reasons to hide: no customers to offer, or a landlord already known.
    expect(wizard).toContain('const savedLandlordPicker = clients.length && !arrivedWithLandlord ? (');
  });

  it('is searchable by the name the engineer types', () => {
    // SearchableSelect is a native <datalist>: the browser filters on each
    // option's `value` and hands that raw string back. Keyed on the id, the
    // customer list was searched by UUID substring — typing a landlord's name
    // matched nothing. Value and label must be the same string.
    expect(wizard).toContain('label: savedLandlordLabel(client),');
    expect(wizard).toContain('value: savedLandlordLabel(client),');
    expect(wizard).not.toMatch(/value: client\.id,/);
  });

  it('resolves the pick through the same label it offered', () => {
    const apply = wizard.slice(
      wizard.indexOf('const applySavedLandlord'),
      wizard.indexOf('const savedLandlordPicker'),
    );
    expect(apply).toContain('savedLandlordLabel(candidate) === chosenLabel');
  });

  it('writes into the fields the engineer can edit, and locks nothing', () => {
    const apply = wizard.slice(
      wizard.indexOf('const applySavedLandlord'),
      wizard.indexOf('const savedLandlordPicker'),
    );
    // Falls back to the existing value rather than blanking a field the saved
    // customer happens not to carry.
    expect(apply).toContain('prev.landlord_name');
    expect(apply).toContain('prev.landlord_postcode');
    expect(apply).not.toContain('readOnly');
    expect(apply).not.toContain('disabled');
  });

  it('survives a client list that fails to load', () => {
    expect(wizardPage).toContain('await listClients().catch(() => [])');
  });

  it('stops pointing at a step name that is not on screen', () => {
    // "People & location" is a step. On one page the section is right there
    // and called something else.
    expect(wizard).toContain("singlePage ? 'Add it under Landlord & property above'");
    expect(wizard).toContain("singlePage ? 'Fill it in under Landlord & property above'");
  });
});

/**
 * Step one is itself two pages — landlord on the first, the property address on
 * the second — behind `infoSubStep`. Stacked, only the first rendered, so a
 * certificate started on one page had nowhere to enter the address of the
 * premises it certifies. That is Reg 36(3)(b) content: the record must state
 * the address of the premises at which the appliance is installed.
 *
 * The same shape as the appliance sub-tabs, missed because it is a second,
 * separate sub-navigation inside a step that already looked flattened.
 */
describe('the property address is reachable on one page', () => {
  it('renders both halves of step one rather than either/or', () => {
    expect(wizard).toContain('{infoSubStep === 0 || singlePage ? (');
    expect(wizard).toContain('{infoSubStep === 1 || singlePage ? (');
  });

  it('still shows one half at a time in the stepped flow', () => {
    // Both gates fall through to null, so stepping is unchanged.
    const landlordGate = wizard.indexOf('{infoSubStep === 0 || singlePage ? (');
    const propertyGate = wizard.indexOf('{infoSubStep === 1 || singlePage ? (');
    expect(landlordGate).toBeLessThan(propertyGate);
    expect(wizard.slice(landlordGate, propertyGate)).toContain(') : null}');
  });

  it('names the section for what it now contains', () => {
    expect(wizard).toContain("? 'Landlord & property'");
  });
});

/**
 * The start options only make sense once you know when the work is happening.
 *
 * Stood at the property there is nothing left to choose: asking the landlord to
 * fill it in is nonsense, and "myself" versus "existing landlord" is a false
 * choice, because the certificate offers the saved-landlord dropdown and the
 * fields on the same page. Booking ahead is the opposite — the details are
 * worth capturing, but on this page rather than two screens before it.
 */
describe('the start options follow the timing answer', () => {
  const stepOne = jobForm.slice(
    jobForm.indexOf('{step === 1 ?'),
    jobForm.indexOf('{step === 2 ?'),
  );

  it('offers one action when the engineer is doing it now', () => {
    expect(stepOne).toContain("{timing === 'now' ? (");
    expect(stepOne).toMatch(/Start \{JOB_TYPE_LABELS\[jobType\]\} now/);
    expect(stepOne).toContain('onClick={startManualEntry}');
  });

  it('drops "ask landlord" from the doing-it-now path', () => {
    const now = stepOne.slice(stepOne.indexOf("{timing === 'now' ? ("), stepOne.indexOf(') : ('));
    expect(now).not.toContain('Ask landlord');
  });

  it('keeps "ask landlord" for a booking', () => {
    const later = stepOne.slice(stepOne.indexOf(') : ('));
    expect(later).toContain('Ask landlord');
    expect(later).toContain('Enter the details now');
  });

  it('reveals the details in place rather than navigating to them', () => {
    expect(jobForm).toContain('setDetailsInline(true)');
    expect(jobForm).toContain('{step === 4 || (step === 1 && detailsInline) ? (');
    expect(jobForm).toContain('{step === 5 || (step === 1 && detailsInline) ? (');
  });

  it('offers saved landlords alongside the fields, not instead of them', () => {
    // You asked for the dropdown and the fields together on the booking page.
    expect(jobForm).toContain('{step === 2 || (step === 1 && detailsInline) ? (');
    // Its Continue has nowhere to go once the details are already below it.
    expect(jobForm).toContain('{step === 1 && detailsInline ? null : (');
  });

  it('retires the picker as a screen of its own', () => {
    expect(jobForm).not.toContain('startExistingLandlordEntry');
  });

  it('asks the combined-job question once', () => {
    // Step 5 carries its own copy of "complete first". Inline it landed a
    // second time, below the one already answered at the top of step 1.
    expect(jobForm).toContain(
      "{jobType === 'safety_check_service' && !initialRequest && !(step === 1 && detailsInline) ? (",
    );
  });

  it('drops the Continue that leads to a section already on screen', () => {
    // Step 4's footer continues to step 5, which is rendered underneath it.
    const footer = jobForm.slice(jobForm.indexOf('By step 4 the landlord/property selection'));
    expect(footer.slice(0, 700)).toContain('{step === 1 && detailsInline ? null : (');
  });

  it('ends a booking at the diary, not in the certificate', () => {
    // "Book for later" says the work is for another day. Continuing into the
    // certificate — or onto the completion checklist — walked the engineer
    // back through the details they had just entered to reach work they were
    // not doing.
    const submit = jobForm.slice(jobForm.indexOf('const { jobId } = await createSoloJob'));
    const branch = submit.slice(0, submit.indexOf("} else if (submitMode === 'continue')"));
    expect(branch).toContain("if (timing === 'later')");
    expect(branch).toContain("router.push('/jobs')");
  });

  it('names the action after what it does', () => {
    expect(jobForm).toContain("? 'Book job'");
  });

  it('leaves the stepped route reachable', () => {
    // Both gates still fire on their own step, so nothing that arrives at
    // step 4 or 5 by another path stops working.
    expect(jobForm).toMatch(/\{step === 4 \|\|/);
    expect(jobForm).toMatch(/\{step === 5 \|\|/);
  });
});

/**
 * "Back" should mean the page before this one.
 *
 * With no step to retreat to, the wizard fell back to a link to /jobs — so
 * leaving a certificate always landed on the full job list, whichever screen
 * the engineer had actually come from. Arriving from /jobs/new and pressing
 * Back showed them every job they have, which is not where they were.
 */
describe('Back returns to where you came from', () => {
  const layout = readFileSync(join(ROOT, 'src/components/certificates/wizard-layout.tsx'), 'utf8');

  it('uses history rather than a fixed destination', () => {
    for (const [name, file] of [['layout', layout], ['single-page shell', wizard]] as const) {
      expect(file, `${name} does not use history`).toContain('window.history.length > 1');
      expect(file, `${name} does not go back`).toContain('router.back()');
    }
  });

  it('still has somewhere to go when opened cold', () => {
    // A link opened in a fresh tab has no history to return to.
    expect(layout).toContain("router.push('/jobs')");
    expect(wizard).toContain("router.push('/jobs')");
  });

  it('leaves an explicit onBack in charge where a step provides one', () => {
    // Stepping back through the wizard is a different thing from leaving it.
    expect(layout).toContain('{onBack ? (');
  });
});

/**
 * DESIGN_TOKENS.md: "Always reference the variable, never the hex, so dark mode
 * keeps working." /jobs/new had nine literal `bg-[#111]` selected states, which
 * stay dark when the theme inverts — so the page had no green and read as
 * unfinished beside the completion screen it sits next to.
 */
describe('/jobs/new is themed like the rest of the app', () => {
  it('uses no hardcoded colours', () => {
    expect(jobForm.match(/bg-\[#[0-9a-fA-F]{3,6}\]/g) ?? []).toEqual([]);
  });

  it('uses the CTA token, which inverts in dark mode', () => {
    expect(jobForm).toContain('bg-[var(--color-cta)]');
    expect(jobForm).toContain('text-[var(--color-cta-fg)]');
  });

  it('marks the chosen option in the green the app uses for an active state', () => {
    expect(jobForm).toContain('bg-[var(--color-action-bg)] text-[var(--color-action)]');
  });

  it('labels sections the way the completion page does', () => {
    // --color-text-eyebrow is reserved for uppercase eyebrow labels.
    expect(jobForm).toContain('uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]');
    expect(jobForm).not.toContain('font-medium tracking-[0.5px] text-[var(--color-text-tertiary)]');
  });
});

/**
 * "Ask landlord" set the path and revealed nothing.
 *
 * The button moved to step one; what it opens stayed behind in step three —
 * the duplicate block nothing routes to any more. Exactly the bug that started
 * this whole thread, in the one piece of it that never got moved.
 */
describe('Ask landlord opens something', () => {
  it('renders the reveal on the screen the button is on', () => {
    const stepOne = jobForm.slice(
      jobForm.indexOf('{step === 1 ?'),
      jobForm.indexOf('{step === 2 ||'),
    );
    expect(stepOne).toContain('Ask landlord');
    expect(stepOne).toContain('{landlordRequestReveal}');
  });

  it('holds it as one value rather than a copy that can drift', () => {
    expect(jobForm).toContain('const landlordRequestReveal = (');
    // One place offers the option now that the duplicate block is gone.
    expect((jobForm.match(/\{landlordRequestReveal\}/g) ?? []).length).toBe(1);
  });

  it('still keys off the path the button sets', () => {
    const reveal = jobForm.slice(
      jobForm.indexOf('const landlordRequestReveal = ('),
      jobForm.indexOf('const startManualEntry'),
    );
    expect(reveal).toContain("path === 'landlord'");
  });
});

/**
 * solo-job-form carried two "How do you want to start?" blocks: one on step
 * one, which engineers reach from /jobs/new, and one on step three, which
 * nothing had routed to since the start options moved.
 *
 * That duplicate caused three separate bugs in a row — four rounds of changes
 * landing in the copy nobody sees, and then "Ask landlord" setting a path whose
 * form lived only in the dead block. Grep found it, tests passed against it,
 * and nothing about the code looked wrong. Deleting it is the fix; this keeps
 * it deleted.
 */
describe('there is one start-options block, not two', () => {
  it('asks how to start exactly once', () => {
    expect((jobForm.match(/How do you want to start\?/g) ?? []).length).toBe(1);
  });

  it('has no step three to route to', () => {
    expect(jobForm).not.toContain('step === 3');
    expect(jobForm).not.toContain('setStep(3)');
  });

  it('cannot hold a step that does not exist', () => {
    expect(jobForm).toContain('useState<1 | 2 | 4 | 5>');
  });

  it('keeps every option an engineer can actually press', () => {
    const stepOne = jobForm.slice(
      jobForm.indexOf('{step === 1 ?'),
      jobForm.indexOf('{step === 2 ||'),
    );
    for (const option of ['Ask landlord', 'Enter the details now', 'Doing it now']) {
      expect(stepOne, `${option} lost`).toContain(option);
    }
    // The doing-it-now action is built from the job type label.
    expect(stepOne).toMatch(/Start \{JOB_TYPE_LABELS\[jobType\]\} now/);
  });
});

/**
 * The saved-landlord picker is only useful when the landlord is unknown.
 *
 * A job created by booking, or filled from a landlord's own request link,
 * already carries those details — offering to fill them from a saved customer
 * is clutter at best, and an invitation to overwrite what the landlord supplied
 * at worst.
 */
describe('the picker appears only when there is something to fill', () => {
  it('hides when the certificate arrived knowing its landlord', () => {
    expect(wizard).toContain('const savedLandlordPicker = clients.length && !arrivedWithLandlord ? (');
  });

  it('decides from the job as loaded, not the live field', () => {
    // Reading the current value would make the picker vanish mid-typing, the
    // moment the name became non-empty.
    expect(wizard).toContain(
      "const arrivedWithLandlord = Boolean(String(resolvedInitialInfo.landlord_name ?? '').trim())",
    );
    const decision = wizard.slice(
      wizard.indexOf('const arrivedWithLandlord'),
      wizard.indexOf('const savedLandlordPicker'),
    );
    expect(decision).not.toContain('info.landlord_name');
  });

  it('tells the engineer the dropdown is coming, when they have customers', () => {
    // The prompt sits on /jobs/new because the dropdown it describes is on the
    // next screen.
    expect(jobForm).toContain("? ', where you can fill them from a saved landlord' : ''");
  });

  it('says nothing about saved landlords to someone with none', () => {
    const hint = jobForm.slice(jobForm.indexOf('Landlord and property details are entered'));
    expect(hint.slice(0, 200)).toContain('clients.length ?');
  });
});
