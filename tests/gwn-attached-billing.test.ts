import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * A Gas Warning Notice raised from a CP12 is part of the same visit, so it must
 * not spend a second certificate from the monthly allowance. A standalone
 * notice — a breakdown or service visit where something dangerous turns up —
 * still is.
 *
 * The rule keys off parent_job_id, which ensureGasWarningNoticeJob sets when it
 * creates a notice from a parent job. These assert the wiring stays in place;
 * exercising the whole issue path would need the full authenticated stack.
 */
const source = readFileSync('src/server/certificates.ts', 'utf8');

describe('warning notice attached to a CP12 is not charged', () => {
  it('reads parent_job_id to decide whether the notice is attached', () => {
    expect(source).toMatch(/attachedToParentJob\s*=\s*Boolean\(/);
    expect(source).toMatch(/\.select\('parent_job_id'\)/);
  });

  it('skips the allowance gate when attached', () => {
    expect(source).toMatch(
      /const limitReached = attachedToParentJob\s*\n?\s*\? null\s*\n?\s*: await getLimitReachedResultForFinalIssue/,
    );
  });

  it('skips usage recording when attached', () => {
    expect(source).toMatch(
      /if \(!attachedToParentJob\) \{\s*\n\s*await recordCertificateUsageForUser\(user\.id, input\.jobId, 'gas_warning_notice'\);/,
    );
  });

  it('still charges the other certificate types unconditionally', () => {
    for (const type of ['cp12', 'boiler_service', 'general_works']) {
      const pattern = new RegExp(`await recordCertificateUsageForUser\\([^)]*'${type}'\\)`);
      expect(source).toMatch(pattern);
    }
  });

  it('ensureGasWarningNoticeJob sets the parent that the rule depends on', () => {
    expect(source).toMatch(/parent_job_id: input\.parentJobId/);
  });
});
