import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const page = readFileSync(join(ROOT, 'src/app/prefill/[jobId]/page.tsx'), 'utf8');
const form = readFileSync(join(ROOT, 'src/app/prefill/[jobId]/prefill-client.tsx'), 'utf8');
const card = readFileSync(join(ROOT, 'src/components/jobs/request-landlord-details-card.tsx'), 'utf8');

/**
 * The page a landlord opens from a link an engineer sent them.
 *
 * It is the only screen in the product shown to someone who has never seen the
 * product, usually on a phone, often from an SMS. No job has ever carried a
 * prefill token, so nothing here had been through a real landlord's hands.
 */
describe('the landlord prefill page', () => {
  it('labels every field, not just placeholders', () => {
    // Sixteen inputs carried a placeholder and nothing else. The moment a
    // landlord types, the only clue to what a box is for disappears.
    const inputs = (form.match(/<Input /g) ?? []).length;
    const labels = (form.match(/mb-1 block text-\[12px\]/g) ?? []).length;
    expect(labels).toBe(inputs);
  });

  it('uses no hardcoded colours', () => {
    // A literal #111 submit button is a black block on a dark background for
    // any landlord whose phone is in dark mode.
    for (const [name, file] of [['page', page], ['form', form]] as const) {
      expect(file.match(/#[0-9a-fA-F]{3,6}/g) ?? [], `${name} has hardcoded colour`).toEqual([]);
    }
    expect(form).toContain('bg-[var(--color-cta)]');
  });

  it('speaks to the landlord, not about them', () => {
    // They did not request anything — an engineer asked them for details.
    expect(page).toContain('Fill in your details');
    expect(page).toContain('Your gas engineer has asked for these');
    expect(page).not.toContain('Requested job');
  });
});

describe('the SMS the engineer sends', () => {
  it('puts a dialable number in the sms: link', () => {
    // encodeURIComponent turned "+44 7700 900000" into "%2B44%207700%20900000",
    // which handsets do not parse as a number.
    expect(card).toContain("const smsNumber = landlordPhone.replace(/[^\\d+]/g, '')");
    expect(card).not.toMatch(/sms:\$\{encodeURIComponent/);
  });

  it('builds a query the handset can read', () => {
    // "?&body=" is malformed, so the message body was dropped.
    expect(card).toContain('?body=${encodeURIComponent(shareText)}');
    // Scoped to the code: the comment above it quotes the old malformed query.
    const href = card.slice(card.indexOf('const smsHref'), card.indexOf('return ('));
    expect(href).not.toContain('?&body=');
  });

  it('keeps a leading +, which is part of the number', () => {
    const strip = (n: string) => n.replace(/[^\d+]/g, '');
    expect(strip('+44 7700 900000')).toBe('+447700900000');
    expect(strip('(01254) 555-123')).toBe('01254555123');
  });
});
