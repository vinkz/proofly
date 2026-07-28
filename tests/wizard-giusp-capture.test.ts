import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { giuspFieldKey, readGiuspAnswers, emptyGiuspAnswers } from '@/lib/cp12/giusp';

/**
 * The wizard captures the GIUSP answers during the CP12 and stores them on the
 * parent job under the shared per-appliance namespace, so the notice can be
 * seeded from them instead of asking the engineer the same questions twice.
 *
 * The component itself is 3.4k lines of React that these tests do not render;
 * they assert the contract it depends on — the namespace, the persistence path,
 * and that the shared question block is what gets used.
 */
const wizard = readFileSync(
  'src/app/(wizard)/wizard/create/[certificateType]/_components/certificate-wizard.tsx',
  'utf8',
);
const server = readFileSync('src/server/certificates.ts', 'utf8');

describe('wizard GIUSP capture', () => {
  it('renders the shared question block rather than its own copy', () => {
    expect(wizard).toMatch(/import \{ UnsafeSituationFields \} from '@\/components\/cp12\/unsafe-situation'/);
    expect(wizard).toMatch(/<UnsafeSituationFields/);
  });

  it('only asks once the appliance is At Risk or Immediately Dangerous', () => {
    expect(wizard).toMatch(/classification === 'ar' \|\| classification === 'id'/);
  });

  it('writes answers under the shared per-appliance namespace', () => {
    expect(wizard).toMatch(/giuspFieldKey\(`appliance_\$\{index \+ 1\}`, key\)/);
  });

  it('persists them through the existing job-fields save', () => {
    expect(wizard).toMatch(/key\.startsWith\('giusp__'\)/);
  });

  it('no longer tells the engineer the notice is generated later', () => {
    expect(wizard).not.toMatch(/generated\s*\n?\s*later from the completion checklist/);
    expect(wizard).toMatch(/issued alongside the certificate/);
  });

  it('the server reads the same namespace back when seeding the notice', () => {
    expect(server).toMatch(/readGiuspAnswers\(sourceFieldMap, sourceApplianceKey\)/);
  });

  it('the wizard and server agree on the key format', () => {
    // The wizard builds `appliance_${index + 1}`; ensureGasWarningNoticeJob
    // validates that exact shape, and the notice is seeded from the same key.
    expect(giuspFieldKey('appliance_1', 'customer_present')).toBe('giusp__appliance_1__customer_present');
    expect(server).toMatch(/applianceKey: z\.string\(\)\.regex\(\/\^appliance_\\d\+\$\/\)/);
  });

  it('an appliance with no answers reads back empty rather than undefined', () => {
    expect(readGiuspAnswers({}, 'appliance_1')).toEqual(emptyGiuspAnswers());
  });
});
