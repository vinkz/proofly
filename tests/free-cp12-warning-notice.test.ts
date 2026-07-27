import { describe, expect, it, vi } from 'vitest';

import { POST as generate } from '@/app/api/free-cp12/generate/route';
import type { FreeCp12PayloadInput } from '@/lib/cp12/freeCp12Payload';

/**
 * A CP12 that classifies an appliance At Risk or Immediately Dangerous records
 * a GIUSP unsafe situation, which sits on binding duties: GSIUR Reg 26(9)
 * (notify), the GIUSP procedure (isolate / cap / label / notify) and, for ID, a
 * RIDDOR 2013 Reg 6(2) report to HSE within 14 days.
 *
 * The free tool must not emit a certificate saying "Immediately Dangerous"
 * while leaving that procedure half-done.
 */
vi.mock('@/lib/supabaseServer', () => ({
  supabaseServerServiceRole: async () => {
    throw new Error('generate must not touch Supabase');
  },
}));

let ip = 0;
const post = (body: unknown) =>
  generate(
    new Request('http://localhost/api/free-cp12/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `172.16.0.${(ip += 1)}` },
      body: JSON.stringify(body),
    }),
  );

const base = (): FreeCp12PayloadInput => ({
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
    defect_description: 'Cracked heat exchanger',
    remedial_action: 'Appliance capped and labelled',
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

/** A fully-answered Immediately Dangerous appliance. */
const compliantId = (): FreeCp12PayloadInput => {
  const payload = base();
  payload.appliances[0].safety_classification = 'id';
  payload.appliances[0].defect_notes = 'Cracked heat exchanger';
  payload.appliances[0].actions_taken = 'Capped and labelled';
  payload.appliances[0].unsafe_situation = {
    customer_present: 'Yes',
    customer_informed: 'Yes',
    gas_supply_isolated: 'Yes',
    appliance_capped_off: 'Yes',
    danger_label_fitted: 'Yes',
    riddor_reported: 'Yes',
  };
  return payload;
};

const json = async (r: Response) => (await r.json()) as { issues?: string[]; documents?: Array<{ kind: string; title: string; base64: string }> };

describe('warning notices arising from a free CP12', () => {
  it('a safe certificate produces no notice', async () => {
    const data = await json(await post(base()));
    expect(data.documents).toHaveLength(1);
    expect(data.documents?.[0].kind).toBe('cp12');
  });

  it('an Immediately Dangerous appliance produces a notice alongside the certificate', async () => {
    const response = await post(compliantId());
    expect(response.status).toBe(200);

    const data = await json(response);
    expect(data.documents).toHaveLength(2);
    expect(data.documents?.[1].kind).toBe('gas_warning_notice');
    expect(data.documents?.[1].title).toContain('Immediately Dangerous');

    const bytes = Buffer.from(data.documents![1].base64, 'base64');
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it('an At Risk appliance produces a notice too', async () => {
    const payload = base();
    payload.appliances[0].safety_classification = 'ar';
    payload.appliances[0].defect_notes = 'Loose flue joint';
    payload.appliances[0].actions_taken = 'Turned off with permission';
    payload.appliances[0].unsafe_situation = {
      customer_present: 'Yes',
      customer_informed: 'Yes',
      gas_supply_isolated: 'Yes',
    };

    const data = await json(await post(payload));
    expect(data.documents).toHaveLength(2);
    expect(data.documents?.[1].title).toContain('At Risk');
  });

  it('one notice per unsafe appliance', async () => {
    const payload = compliantId();
    payload.appliances.push({
      appliance_type: 'gas_fire',
      location: 'Lounge',
      make_model: 'Valor',
      safety_classification: 'ar',
      defect_notes: 'Blocked flue',
      actions_taken: 'Turned off',
      reg_26_9_confirmed: true,
      unsafe_situation: { customer_present: 'Yes', customer_informed: 'Yes', gas_supply_isolated: 'Yes' },
    });

    const data = await json(await post(payload));
    expect(data.documents).toHaveLength(3);
    expect(data.documents?.filter((d) => d.kind === 'gas_warning_notice')).toHaveLength(2);
  });

  // --- the GIUSP / RIDDOR gate ------------------------------------------
  it('blocks Immediately Dangerous without a Danger — Do Not Use label', async () => {
    const payload = compliantId();
    payload.appliances[0].unsafe_situation!.danger_label_fitted = 'No';

    const data = await json(await post(payload));
    expect(data.issues?.join(' ')).toMatch(/Do Not Use label/i);
  });

  it('blocks Immediately Dangerous without isolation or a recorded refusal', async () => {
    const payload = compliantId();
    payload.appliances[0].unsafe_situation!.gas_supply_isolated = 'No';
    payload.appliances[0].unsafe_situation!.customer_refused_isolation = 'No';

    const data = await json(await post(payload));
    expect(data.issues?.join(' ')).toMatch(/refusal is required/i);
  });

  it('accepts a recorded refusal in place of isolation', async () => {
    const payload = compliantId();
    payload.appliances[0].unsafe_situation!.gas_supply_isolated = 'No';
    payload.appliances[0].unsafe_situation!.customer_refused_isolation = 'Yes';

    const response = await post(payload);
    expect(response.status).toBe(200);
  });

  it('blocks Immediately Dangerous with no RIDDOR report recorded', async () => {
    const payload = compliantId();
    payload.appliances[0].unsafe_situation!.riddor_reported = 'No';

    const data = await json(await post(payload));
    expect(data.issues?.join(' ')).toMatch(/RIDDOR/i);
  });

  it('accepts a RIDDOR reference in place of the report flag', async () => {
    const payload = compliantId();
    payload.appliances[0].unsafe_situation!.riddor_reported = 'No';
    payload.appliances[0].unsafe_situation!.riddor_reference = 'HSE-2026-0042';

    const response = await post(payload);
    expect(response.status).toBe(200);
  });

  it('requires handover — informed when present, notice left when not', async () => {
    const notInformed = compliantId();
    notInformed.appliances[0].unsafe_situation!.customer_informed = 'No';
    expect((await json(await post(notInformed))).issues?.join(' ')).toMatch(/must be informed/i);

    const absent = compliantId();
    absent.appliances[0].unsafe_situation!.customer_present = 'No';
    absent.appliances[0].unsafe_situation!.customer_informed = '';
    expect((await json(await post(absent))).issues?.join(' ')).toMatch(/left on premises/i);

    const absentButLeft = compliantId();
    absentButLeft.appliances[0].unsafe_situation!.customer_present = 'No';
    absentButLeft.appliances[0].unsafe_situation!.customer_informed = '';
    absentButLeft.appliances[0].unsafe_situation!.notice_left_on_premises = 'Yes';
    expect((await post(absentButLeft)).status).toBe(200);
  });

  it('names the appliance in a notice failure so the engineer knows which to fix', async () => {
    const payload = compliantId();
    payload.appliances[0].unsafe_situation!.danger_label_fitted = 'No';

    const data = await json(await post(payload));
    expect(data.issues?.join(' ')).toMatch(/Appliance 1 warning notice/);
  });

  it('At Risk does not demand the Immediately Dangerous label or a RIDDOR report', async () => {
    const payload = base();
    payload.appliances[0].safety_classification = 'ar';
    payload.appliances[0].defect_notes = 'Loose flue joint';
    payload.appliances[0].actions_taken = 'Turned off with permission';
    payload.appliances[0].unsafe_situation = {
      customer_present: 'Yes',
      customer_informed: 'Yes',
      gas_supply_isolated: 'Yes',
      danger_label_fitted: 'No',
      riddor_reported: 'No',
    };

    const response = await post(payload);
    expect(response.status).toBe(200);
  });
});
