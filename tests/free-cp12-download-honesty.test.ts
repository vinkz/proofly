import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The free CP12 saves via a blob URL and a synthetic anchor click, which an
 * in-app WebView can refuse silently — there is no callback that reports it.
 * Most of this tool's traffic arrives from a Facebook link, so the two screens
 * around that download have to be careful about what they claim.
 *
 * The done screen used to say "Your CP12 is downloaded" and "Saved to your
 * device" unconditionally. Inside a WebView that is a false success, and if the
 * email had also failed the visitor was told they had a certificate they did
 * not have.
 *
 * The warning also has to live on the step that still has an email form under
 * it. On the done step the email has already been sent or failed, so "email
 * yourself a copy below" points at nothing.
 */
const form = readFileSync('src/app/free-cp12/_components/free-cp12-form.tsx', 'utf8');

const doneStage = form.indexOf("if (stage === 'done')");
const previewStage = form.indexOf("if (stage === 'preview')");
const notice = form.indexOf('free-cp12-in-app-browser-notice');
const emailForm = form.indexOf('Email and download');

describe('the done screen does not claim a download it cannot see', () => {
  it('makes the heading conditional on the browser rather than always "downloaded"', () => {
    expect(form).not.toMatch(
      /\{documents\.length > 1 \? 'Your documents are downloaded' : 'Your CP12 is downloaded'\}/,
    );
    expect(form).toMatch(/'Your CP12 is ready'/);
  });

  it('stops telling a WebView visitor it was saved to their device', () => {
    // The unconditional pairing is what was wrong; the phrase itself is still
    // correct for a real browser and may remain in the non-in-app branch.
    expect(form).not.toMatch(
      /\{emailed\s*\n?\s*\? 'Also sent to your inbox\.'\s*\n?\s*: 'Saved to your device\. Email delivery failed\.'\}/,
    );
  });

  it('tells them what to do instead', () => {
    expect(form).toMatch(/open this page in Safari or Chrome to download it/);
  });

  it('still reports the email result, which the server does confirm', () => {
    expect(form).toMatch(/emailed \? 'Sent to your inbox\.' : 'Email delivery failed\.'/);
  });
});

describe('the warning sits where the email form still exists', () => {
  it('is on the preview step, not the done step', () => {
    expect(previewStage).toBeGreaterThan(doneStage);
    expect(notice).toBeGreaterThan(previewStage);
  });

  it('appears above the email form it points at', () => {
    expect(notice).toBeLessThan(emailForm);
  });
});
