import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FreeCp12PayloadSchema,
  emptyFreeCp12Appliance,
  type FreeCp12PayloadInput,
} from '@/lib/cp12/freeCp12Payload';
import { buildFreeGwnFields, unsafeAppliances } from '@/lib/cp12/freeGwn';
import { validateGwnForIssue } from '@/lib/gwn/validation';

/**
 * Defects found in the pre-launch review. Each one was reachable by an ordinary
 * engineer on an ordinary job, so each keeps a test.
 */
const inserted: Array<Record<string, unknown>> = [];
const sent: string[] = [];

vi.mock('@/lib/supabaseServer', () => ({
  supabaseServerServiceRole: async () => ({
    from: () => ({
      insert(row: Record<string, unknown>) {
        inserted.push(row);
        return Promise.resolve({ error: null });
      },
      select: () => ({ eq: () => ({ gte: () => Promise.resolve({ count: 0, error: null }) }) }),
    }),
  }),
}));

vi.mock('@/lib/resend', () => ({
  isEmailConfigured: () => true,
  sendEmail: async () => {
    // Records ordering: if the lead were written after the send, a hang here
    // would lose it. Asserted below by checking the lead exists by send time.
    sent.push(`lead_rows_at_send:${inserted.length}`);
    return { status: 'sent' as const, id: 'e1' };
  },
}));

const { POST: download } = await import('@/app/api/free-cp12/download/route');

const payload = (): FreeCp12PayloadInput => ({
  fields: {
    inspection_date: '2026-07-28',
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
  download(
    new Request('http://localhost/api/free-cp12/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `198.18.0.${(ip += 1)}` },
      body: JSON.stringify(body),
    }),
  );

describe('launch regressions', () => {
  beforeEach(() => {
    inserted.length = 0;
    sent.length = 0;
  });

  it('writes the lead before calling Resend, so a hung send cannot lose it', async () => {
    const response = await post({ email: 'engineer@example.com', payload: payload() });
    expect(response.status).toBe(200);
    // The lead already existed at the moment the send was attempted.
    expect(sent[0]).toBe('lead_rows_at_send:1');
  });

  it('the combustion opt-in travels with its appliance, not its position', () => {
    // Two gas fires; the first opted into combustion readings, the second did not.
    const parsed = FreeCp12PayloadSchema.parse({
      fields: {},
      appliances: [
        { appliance_type: 'gas_fire', location: 'Lounge', combustion_opt_in: true, high_co_ppm: '12' },
        { appliance_type: 'gas_fire', location: 'Bedroom', combustion_opt_in: false },
      ],
    });

    // Remove the first — previously the second inherited index 0's opt-in.
    const remaining = parsed.appliances.filter((_, i) => i !== 0);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].location).toBe('Bedroom');
    expect(remaining[0].combustion_opt_in).toBe(false);
    expect(remaining[0].high_co_ppm).toBe('');
  });

  it('a new appliance starts with combustion opt-in off', () => {
    expect(emptyFreeCp12Appliance().combustion_opt_in).toBe(false);
  });

  it('a record-level defect satisfies the warning notice', () => {
    // The CP12 gate accepts a defect in either place; the notice must not block
    // an engineer who used the record-level box instead of the appliance one.
    const parsed = FreeCp12PayloadSchema.parse({
      fields: {
        ...payload().fields,
        defect_description: 'Cracked heat exchanger',
        remedial_action: 'Capped and labelled',
      },
      appliances: [
        {
          appliance_type: 'boiler',
          location: 'Kitchen',
          make_model: 'Vaillant',
          safety_classification: 'id',
          reg_26_9_confirmed: true,
          // Deliberately blank per-appliance.
          defect_notes: '',
          actions_taken: '',
          unsafe_situation: {
            customer_present: 'Yes',
            customer_informed: 'Yes',
            gas_supply_isolated: 'Yes',
            danger_label_fitted: 'Yes',
            riddor_reported: 'Yes',
          },
        },
      ],
    });

    const unsafe = unsafeAppliances(parsed);
    expect(unsafe).toHaveLength(1);
    const fields = buildFreeGwnFields(parsed, unsafe[0], {
      recordId: 'R',
      issuedAt: new Date('2026-07-28T00:00:00Z'),
    });

    expect(fields.unsafe_situation_description).toBe('Cracked heat exchanger');
    expect(fields.actions_taken).toBe('Capped and labelled');
    expect(validateGwnForIssue(fields)).toEqual([]);
  });

  it('rejects more appliances than the form allows, so the cap is real', () => {
    const many = { fields: {}, appliances: Array.from({ length: 13 }, () => ({ appliance_type: 'boiler' })) };
    expect(FreeCp12PayloadSchema.safeParse(many).success).toBe(false);

    const twelve = { fields: {}, appliances: Array.from({ length: 12 }, () => ({ appliance_type: 'boiler' })) };
    expect(FreeCp12PayloadSchema.safeParse(twelve).success).toBe(true);
  });
});
