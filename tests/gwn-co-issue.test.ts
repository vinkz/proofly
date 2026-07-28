import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * A Gas Warning Notice is now issued alongside the CP12 that raised it.
 *
 * The properties that matter here are safety properties, not happy-path ones:
 * a notice must never cost the engineer a valid certificate, and a notice that
 * could not be issued must remain visibly outstanding rather than being
 * silently dropped. These assert the shape that guarantees them.
 */
const server = readFileSync('src/server/certificates.ts', 'utf8');
const completion = readFileSync('src/app/(app)/jobs/[id]/pdf/page.tsx', 'utf8');

describe('co-issued gas warning notices', () => {
  it('runs only after the certificate is committed', () => {
    // The call sits after the certificate record, usage and follow-ups, and
    // immediately before the revalidate/return.
    const coIssueAt = server.indexOf('issueAttachedGasWarningNotices({');
    const usageAt = server.indexOf("recordCertificateUsageForUser(userId, jobId, 'cp12')");
    const returnAt = server.indexOf('return { pdfUrl: finalSignedUrl, jobId, gasWarningNoticeJobs };');

    expect(usageAt).toBeGreaterThan(-1);
    expect(coIssueAt).toBeGreaterThan(usageAt);
    expect(returnAt).toBeGreaterThan(coIssueAt);
  });

  it('cannot fail the certificate: every notice is individually caught', () => {
    const fn = server.slice(
      server.indexOf('async function issueAttachedGasWarningNotices'),
      server.indexOf('const GeneratePdfSchema'),
    );
    expect(fn).toMatch(/try \{/);
    expect(fn).toMatch(/\} catch \(error\) \{/);
    // Records the failure and carries on rather than rethrowing.
    expect(fn).toMatch(/issued: false, error: message/);
    expect(fn).not.toMatch(/throw /);
  });

  it('reports each notice so a failure stays visible', () => {
    const fn = server.slice(
      server.indexOf('async function issueAttachedGasWarningNotices'),
      server.indexOf('const GeneratePdfSchema'),
    );
    expect(fn).toMatch(/issued: true/);
    expect(fn).toMatch(/results\.push/);
  });

  it('only unsafe appliances get a notice', () => {
    const fn = server.slice(
      server.indexOf('async function issueAttachedGasWarningNotices'),
      server.indexOf('const GeneratePdfSchema'),
    );
    expect(fn).toMatch(/const classification = getGasWarningClassification\(appliance\)/);
    expect(fn).toMatch(/if \(!classification\) continue/);
  });

  it('reuses the normal issue path rather than a private copy', () => {
    const fn = server.slice(
      server.indexOf('async function issueAttachedGasWarningNotices'),
      server.indexOf('const GeneratePdfSchema'),
    );
    expect(fn).toMatch(/await generateCertificatePdf\(\{/);
    expect(fn).toMatch(/certificateType: 'gas_warning_notice'/);
    // Idempotent per (parent, appliance), so re-issuing a CP12 cannot create
    // duplicate notices.
    expect(fn).toMatch(/await ensureGasWarningNoticeJob\(\{/);
  });

  it('uses the appliance key format the notice job validates', () => {
    const fn = server.slice(
      server.indexOf('async function issueAttachedGasWarningNotices'),
      server.indexOf('const GeneratePdfSchema'),
    );
    expect(fn).toMatch(/`appliance_\$\{index \+ 1\}`/);
  });

  it('the completion screen distinguishes issued from still-outstanding', () => {
    expect(completion).toMatch(/pendingGasWarningNoticeJobs/);
    expect(completion).toMatch(/Gas Warning Notice issued/);
    expect(completion).toMatch(/Gas Warning Notice still to issue/);
    // The manual wizard remains reachable as the recovery path.
    expect(completion).toMatch(/\/wizard\/create\/gas_warning_notice\?jobId=/);
  });

  it('reminds about the RIDDOR duty once a notice has been issued', () => {
    expect(completion).toMatch(/RIDDOR within 14 days/);
  });
});
