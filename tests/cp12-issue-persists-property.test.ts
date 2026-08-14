import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { validateCp12TierOne } from '@/lib/cp12/validation';

/**
 * Issuing a CP12 failed with "Property address line 1 is required; Enter a valid
 * property postcode" on an address that was filled in on screen.
 *
 * The property address reaches the server as the job fields job_address_line1 /
 * job_postcode, which only the full jobFields payload writes. That payload used
 * to be sent by the step-1 Next button; once the CP12 became a single page there
 * is no step footer to press, so the issue handler is the only remaining writer.
 * It was persisting a hand-rolled subset (the five safety fields) that omitted
 * the address, so the job reached validateCp12ForIssue without it.
 *
 * The same shape of bug had already been fixed once in the boiler service, so
 * these tests pin both halves of the contract: what the validator demands, and
 * that the issue path sends the payload containing it.
 */
const wizard = readFileSync(
  'src/app/(wizard)/wizard/create/[certificateType]/_components/certificate-wizard.tsx',
  'utf8',
);

const validFields = {
  inspection_date: '2026-07-11',
  property_address: '34 Benham Close, London, E2 2AA',
  landlord_name: 'Alex Landlord',
  landlord_address: '21 Owner Street, London, SE1 1AA',
  landlord_address_line1: '21 Owner Street',
  landlord_postcode: 'SE1 1AA',
  engineer_name: 'A. Engineer',
  gas_safe_number: '123456',
  engineer_signature_path: 'signatures/engineer.png',
  job_address_line1: '34 Benham Close',
  job_postcode: 'E2 2AA',
};

const validAppliance = {
  appliance_type: 'boiler',
  make_model: 'Worcester Bosch Greenstar',
  location: 'Kitchen',
  safety_rating: 'safe',
  reg_26_9_confirmed: true,
};

/** Extract the body of persistCp12IssueState — the wizard is 4k lines we do not render. */
function persistCp12IssueStateSource() {
  const start = wizard.indexOf('const persistCp12IssueState');
  expect(start).toBeGreaterThan(-1);
  const end = wizard.indexOf('\n  };', start);
  expect(end).toBeGreaterThan(start);
  return wizard.slice(start, end);
}

describe('CP12 issue gate reads the property address from the job fields', () => {
  it('reports exactly the reported errors when job_address_line1 / job_postcode are missing', () => {
    const errors = validateCp12TierOne({
      fields: { ...validFields, job_address_line1: '', job_postcode: '' },
      appliances: [validAppliance],
    });

    expect(errors).toContain('Property address line 1 is required');
    expect(errors).toContain('Enter a valid property postcode');
  });

  it('passes once they are present, so the address is the only thing that was missing', () => {
    const errors = validateCp12TierOne({
      fields: validFields,
      appliances: [validAppliance],
    });

    expect(errors).toEqual([]);
  });
});

describe('persistCp12IssueState', () => {
  it('sends the shared draft payload rather than a hand-rolled subset', () => {
    const source = persistCp12IssueStateSource();

    expect(source).toMatch(/buildCp12DraftPersistencePayload\(\)/);
    expect(source).toMatch(/saveJobFields\(\{ jobId, fields: payload\.jobFields \}\)/);
  });

  it('no longer writes only the five safety fields, which omitted the address', () => {
    const source = persistCp12IssueStateSource();

    expect(source).not.toMatch(/cp12SafetyFieldsPayload/);
  });

  it('keeps the address in the payload the issue path sends', () => {
    // The builder is what carries job_address_line1 / job_postcode; if these
    // ever leave it, the issue path silently stops persisting the address again.
    expect(wizard).toMatch(/job_address_line1: nextJobAddress\.job_address_line1/);
    expect(wizard).toMatch(/job_postcode: nextJobAddress\.job_postcode/);
  });
});
