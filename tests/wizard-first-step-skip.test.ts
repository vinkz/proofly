import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * Step one of the certificate wizard ("Landlord & property") is the only screen
 * that collects the landlord. The job form skips it when it already holds those
 * details — but it once skipped for *every* upcoming CP12, whether or not the
 * landlord had been filled in, so a first job created with the landlord blank
 * opened on "Appliances" and could never be issued without a Back-navigation to
 * a step the engineer had never seen.
 *
 * The wizard needs auth, so this asserts against the source rather than
 * rendering it.
 */
const soloJobForm = readFileSync('src/components/jobs/solo-job-form.tsx', 'utf8');
const cp12Validation = readFileSync('src/lib/cp12/validation.ts', 'utf8');

const skipDecision = soloJobForm.slice(
  soloJobForm.indexOf('const handedOverEarly'),
  soloJobForm.indexOf('const href = shouldSkipFirstWizardStep'),
);

describe('skipping the wizard landlord step', () => {
  it('requires the landlord before skipping, not merely an upcoming CP12', () => {
    expect(skipDecision).toContain('cp12LandlordCaptured');
    // The bare flag must not be what authorises the skip.
    expect(skipDecision).toMatch(
      /shouldSkipFirstWizardStep\s*=\s*\n?\s*!handedOverEarly\s*&&\s*\n?\s*\(Boolean\(selectedPropertyKey\)\s*\|\|\s*cp12LandlordCaptured\s*\|\|\s*jobType === 'warning_notice'\)/,
    );
  });

  it('demands every landlord field the wizard step would have demanded', () => {
    for (const field of ['landlordName', 'landlordAddressLine1', 'landlordCity', 'landlordPostcode']) {
      expect(skipDecision).toContain(`${field}.trim()`);
    }
  });

  it('still routes a handover through the landlord step', () => {
    expect(skipDecision).toContain('!handedOverEarly');
  });

  it('guards the same fields the issue-time validator rejects a CP12 for', () => {
    // If these ever diverge, the skip lets an engineer past a step whose data
    // the validator will later insist on — the exact trap this test exists for.
    expect(cp12Validation).toContain('landlord_name');
    expect(cp12Validation).toContain('landlord_address_line1');
    expect(cp12Validation).toContain('landlord_postcode');
  });
});
