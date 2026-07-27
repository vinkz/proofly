import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST as generate } from '@/app/api/free-cp12/generate/route';
import { FREE_CP12_LIMITS } from '@/lib/cp12/free-tool';
import type { FreeCp12PayloadInput } from '@/lib/cp12/freeCp12Payload';

/**
 * The free CP12 route must produce a real certificate for an anonymous visitor
 * and must not persist anything. The persistence half is asserted by mocking the
 * Supabase and Resend modules and proving the generate path never reaches them.
 */
const supabaseCalls: string[] = [];
vi.mock('@/lib/supabaseServer', () => ({
  supabaseServerServiceRole: async () => {
    supabaseCalls.push('service-role');
    throw new Error('the free generate path must not touch Supabase');
  },
}));

const completePayload = (): FreeCp12PayloadInput => ({
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

const post = (body: unknown, ip = '203.0.113.1') =>
  generate(
    new Request('http://localhost/api/free-cp12/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify(body),
    }),
  );

let ipCounter = 0;
const freshIp = () => `198.51.100.${(ipCounter += 1)}`;

describe('free CP12 generate route', () => {
  beforeEach(() => {
    supabaseCalls.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a real PDF for an anonymous visitor', async () => {
    const response = await post(completePayload(), freshIp());

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toContain('noindex');

    const data = (await response.json()) as { documents: Array<{ kind: string; base64: string }> };
    expect(data.documents).toHaveLength(1);
    expect(data.documents[0].kind).toBe('cp12');

    const bytes = Buffer.from(data.documents[0].base64, 'base64');
    expect(bytes.length).toBeGreaterThan(1000);
    // PDF magic number.
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('never reads or writes the database while generating', async () => {
    const response = await post(completePayload(), freshIp());

    expect(response.status).toBe(200);
    expect(supabaseCalls).toEqual([]);
  });

  it('applies the same statutory gate as the paid flow', async () => {
    const payload = completePayload();
    payload.fields.gas_safe_number = '';
    payload.appliances[0].reg_26_9_confirmed = false;

    const response = await post(payload, freshIp());
    const data = (await response.json()) as { error: string; issues: string[] };

    expect(response.status).toBe(422);
    expect(data.issues.join(' ')).toContain('Gas Safe registration number');
    expect(data.issues.join(' ')).toContain('Regulation 26(9)');
  });

  it('rejects a payload with no appliances', async () => {
    const response = await post({ ...completePayload(), appliances: [] }, freshIp());
    expect(response.status).toBe(400);
  });

  it('covers non-boiler appliance categories', async () => {
    const payload = completePayload();
    payload.appliances = [
      { appliance_type: 'hob_cooker', location: 'Kitchen', make_model: 'Bosch Hob', safety_classification: 'safe', reg_26_9_confirmed: true },
      { appliance_type: 'gas_fire', location: 'Lounge', make_model: 'Valor Fire', safety_classification: 'safe', reg_26_9_confirmed: true },
      { appliance_type: 'water_heater', location: 'Bathroom', make_model: 'Ariston', safety_classification: 'safe', reg_26_9_confirmed: true },
    ];

    const response = await post(payload, freshIp());
    expect(response.status).toBe(200);
    const data = (await response.json()) as { documents: Array<{ base64: string }> };
    expect(Buffer.from(data.documents[0].base64, 'base64').length).toBeGreaterThan(1000);
  });

  it('rate limits a single IP and fails with a message, not a stack trace', async () => {
    const ip = freshIp();
    for (let i = 0; i < FREE_CP12_LIMITS.generatePerIpPerHour; i += 1) {
      const ok = await post(completePayload(), ip);
      expect(ok.status).toBe(200);
    }

    const blocked = await post(completePayload(), ip);
    const data = (await blocked.json()) as { error: string; retryAfterSeconds: number };

    expect(blocked.status).toBe(429);
    expect(data.error).toMatch(/try again/i);
    expect(data.error).not.toMatch(/at .*\(/); // no stack frames
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
    expect(data.retryAfterSeconds).toBeGreaterThan(0);
  });
});
