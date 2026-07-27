import { describe, expect, it, vi } from 'vitest';

import { POST as generate } from '@/app/api/free-cp12/generate/route';
import type { FreeCp12PayloadInput } from '@/lib/cp12/freeCp12Payload';

/**
 * Gas Safety (Installation and Use) Regulations 1998, Reg 36(3)(a)–(i) — the
 * prescribed minimum content of a landlord gas safety record, as set out in
 * audit/cp12-field-analysis.md.
 *
 * The free tool issues a real statutory document to people with no account and
 * no support contract, so each item is asserted to actually block issue rather
 * than assumed to be covered by the shared validator.
 */
vi.mock('@/lib/supabaseServer', () => ({
  supabaseServerServiceRole: async () => {
    throw new Error('generate must not touch Supabase');
  },
}));

const complete = (): FreeCp12PayloadInput => ({
  fields: {
    inspection_date: '2026-07-27',
    job_address_line1: '9 Property Road',
    job_address_city: 'London',
    job_postcode: 'SE1 9SG',
    landlord_name: 'A Landlord',
    landlord_address_line1: '1 Landlord Street',
    landlord_city: 'London',
    landlord_postcode: 'E1 6AN',
    engineer_name: 'Alex Engineer',
    gas_safe_number: '123456',
    engineer_signature: 'data:image/png;base64,iVBORw0KGgo=',
  },
  appliances: [
    {
      appliance_type: 'boiler',
      appliance_subtype: 'combi',
      location: 'Kitchen',
      make_model: 'Vaillant EcoTec',
      safety_classification: 'safe',
      reg_26_9_confirmed: true,
    },
  ],
});

let ip = 0;
const post = (body: unknown) =>
  generate(
    new Request('http://localhost/api/free-cp12/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.0.0.${(ip += 1)}` },
      body: JSON.stringify(body),
    }),
  );

/** Mutate a complete payload so one Reg 36(3) item is missing, and expect a block. */
const expectBlocked = async (mutate: (p: FreeCp12PayloadInput) => void, expected: RegExp) => {
  const payload = complete();
  mutate(payload);
  const response = await post(payload);
  const data = (await response.json()) as { issues?: string[] };
  expect(response.status).toBe(422);
  expect((data.issues ?? []).join(' ')).toMatch(expected);
};

describe('Reg 36(3) minimum content is enforced on the free route', () => {
  it('issues when every prescribed item is present', async () => {
    const response = await post(complete());
    expect(response.status).toBe(200);
  });

  it('(a) date of the check', () =>
    expectBlocked((p) => { p.fields.inspection_date = ''; }, /Inspection date/i));

  it('(b) address of the premises', () =>
    expectBlocked((p) => {
      p.fields.job_address_line1 = '';
      p.fields.job_address_city = '';
      p.fields.job_postcode = '';
    }, /Property address/i));

  it('(c) name of the landlord or agent', () =>
    expectBlocked((p) => { p.fields.landlord_name = ''; }, /Landlord or agent name/i));

  it('(c) address of the landlord or agent', () =>
    expectBlocked((p) => {
      p.fields.landlord_address_line1 = '';
      p.fields.landlord_city = '';
      p.fields.landlord_postcode = '';
    }, /correspondence address/i));

  it('(c) landlord address is never inferred from the property address', async () => {
    // A landlord living at the property must still have it captured as theirs.
    const payload = complete();
    payload.fields.landlord_address_line1 = '';
    payload.fields.landlord_city = '';
    payload.fields.landlord_postcode = '';
    const response = await post(payload);
    expect(response.status).toBe(422);
  });

  it('(d) description of each appliance', () =>
    expectBlocked((p) => {
      p.appliances[0].appliance_type = '';
      p.appliances[0].make_model = '';
    }, /Appliance description/i));

  it('(d) location of each appliance', () =>
    expectBlocked((p) => { p.appliances[0].location = ''; }, /Appliance location/i));

  it('(d) at least one appliance must be recorded', () =>
    expectBlocked((p) => {
      p.appliances[0].appliance_type = '';
      p.appliances[0].make_model = '';
      p.appliances[0].location = '';
    }, /at least one appliance/i));

  it('(e) defect must be recorded when an appliance is unsafe', () =>
    expectBlocked((p) => {
      p.appliances[0].safety_classification = 'id';
      p.appliances[0].defect_notes = '';
      p.appliances[0].actions_taken = 'Capped';
    }, /Defect description is required/i));

  it('(f) remedial action must be recorded when an appliance is unsafe', () =>
    expectBlocked((p) => {
      p.appliances[0].safety_classification = 'ar';
      p.appliances[0].defect_notes = 'Loose flue joint';
      p.appliances[0].actions_taken = '';
      p.appliances[0].actions_required = '';
    }, /Remedial action is required/i));

  it('(g) Regulation 26(9) confirmation, per appliance', () =>
    expectBlocked((p) => { p.appliances[0].reg_26_9_confirmed = false; }, /Regulation 26\(9\)/i));

  it('(g) confirmation is required for every appliance, not just the first', () =>
    expectBlocked((p) => {
      p.appliances.push({
        appliance_type: 'gas_fire',
        location: 'Lounge',
        make_model: 'Valor',
        safety_classification: 'safe',
        reg_26_9_confirmed: false,
      });
    }, /Appliance 2.*Regulation 26\(9\)/i));

  it('(h) engineer name', () =>
    expectBlocked((p) => { p.fields.engineer_name = ''; }, /Engineer name/i));

  it('(h) engineer signature', () =>
    expectBlocked((p) => { p.fields.engineer_signature = ''; }, /Engineer signature/i));

  it('(i) Gas Safe registration number', () =>
    expectBlocked((p) => { p.fields.gas_safe_number = ''; }, /Gas Safe registration number/i));
});
