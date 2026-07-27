import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FreeBoilerServicePayloadInput } from '@/lib/boiler-service/freeBoilerServicePayload';

/**
 * The free boiler service tool.
 *
 * Unlike the CP12, a service record has no statutory content list — the only
 * hard requirements are engineer competence, appliance identity and the Reg
 * 26(9) safety examination outcomes (audit/gas-service-field-analysis.md). So
 * the tests assert that short spine blocks, and that Benchmark conventions
 * (service tasks, combustion readings, customer details) explicitly do not.
 */
type Insert = Record<string, unknown>;
const inserted: Array<{ table: string; row: Insert }> = [];
const sentEmails: Array<{ to: string | string[]; subject: string; attachments?: unknown[] }> = [];

vi.mock('@/lib/supabaseServer', () => ({
  supabaseServerServiceRole: async () => ({
    from(table: string) {
      return {
        insert(row: Insert) {
          inserted.push({ table, row });
          return Promise.resolve({ error: null });
        },
        select: () => ({ eq: () => ({ gte: () => Promise.resolve({ count: 0, error: null }) }) }),
      };
    },
  }),
}));

vi.mock('@/lib/resend', () => ({
  isEmailConfigured: () => true,
  sendEmail: async (input: { to: string | string[]; subject: string; attachments?: unknown[] }) => {
    sentEmails.push(input);
    return { status: 'sent' as const, id: 'email-1' };
  },
}));

const { POST: generate } = await import('@/app/api/free-boiler-service/generate/route');
const { POST: download } = await import('@/app/api/free-boiler-service/download/route');

/** Only the required spine — deliberately nothing else. */
const minimal = (): FreeBoilerServicePayloadInput => ({
  service_date: '2026-07-27',
  job_address_line1: '9 Property Road',
  job_postcode: 'SE1 9SG',
  engineer_name: 'Alex Engineer',
  gas_safe_number: '123456',
  boiler_make: 'Vaillant',
  boiler_model: 'EcoTec Plus 832',
  boiler_location: 'Kitchen',
  appliance_flueing_safe: 'pass',
  appliance_ventilation_safe: 'pass',
  operating_pressure: '20 mbar',
  heat_input: '24 kW',
  appliance_safe: 'Yes',
  engineer_signature: 'data:image/png;base64,iVBORw0KGgo=',
});

let ipCounter = 0;
const freshIp = () => `203.0.113.${(ipCounter += 1)}`;

const post = (handler: typeof generate, body: unknown, ip = freshIp()) =>
  handler(
    new Request('http://localhost/api/free-boiler-service', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify(body),
    }),
  );

describe('free boiler service generate route', () => {
  beforeEach(() => {
    inserted.length = 0;
    sentEmails.length = 0;
  });

  it('renders a real PDF from the required spine alone', async () => {
    const response = await post(generate, minimal());
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('X-Robots-Tag')).toContain('noindex');

    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it('does not require the Benchmark conventions', async () => {
    // No service tasks, no combustion readings, no customer, no comments.
    const payload = minimal();
    expect(payload.service_burner_cleaned).toBeUndefined();
    expect(payload.high_co_ppm).toBeUndefined();
    expect(payload.customer_name).toBeUndefined();

    const response = await post(generate, payload);
    expect(response.status).toBe(200);
  });

  it('requires the engineer signature', async () => {
    const payload = minimal();
    payload.engineer_signature = '';

    const response = await post(generate, payload);
    const data = (await response.json()) as { issues: string[] };
    expect(response.status).toBe(422);
    expect(data.issues.join(' ')).toMatch(/signature/i);
  });

  it.each([
    ['appliance_flueing_safe', /Flue safety/i],
    ['appliance_ventilation_safe', /Ventilation/i],
    ['operating_pressure', /Operating pressure/i],
    ['heat_input', /Heat input/i],
    ['appliance_safe', /Safe-functioning/i],
  ])('requires the Reg 26(9) outcome %s', async (key, expected) => {
    const payload = minimal() as Record<string, unknown>;
    payload[key] = '';

    const response = await post(generate, payload);
    const data = (await response.json()) as { issues: string[] };
    expect(response.status).toBe(422);
    expect(data.issues.join(' ')).toMatch(expected);
  });

  it('requires engineer and appliance identity', async () => {
    for (const key of ['engineer_name', 'gas_safe_number', 'boiler_make', 'boiler_model', 'boiler_location']) {
      const payload = minimal() as Record<string, unknown>;
      payload[key] = '';
      const response = await post(generate, payload);
      expect(response.status, `${key} should block`).toBe(422);
    }
  });

  it('requires the premises address', async () => {
    const payload = minimal();
    payload.job_address_line1 = '';
    payload.job_postcode = '';

    const response = await post(generate, payload);
    const data = (await response.json()) as { issues: string[] };
    expect(response.status).toBe(422);
    expect(data.issues.join(' ')).toMatch(/Property address/i);
  });

  it('never touches the database while generating', async () => {
    await post(generate, minimal());
    expect(inserted).toEqual([]);
  });
});

describe('free boiler service download route', () => {
  beforeEach(() => {
    inserted.length = 0;
    sentEmails.length = 0;
  });

  it('emails the record and writes one lead row tagged to this tool', async () => {
    const response = await post(download, { email: 'Engineer@Example.com', payload: minimal() });
    expect(response.status).toBe(200);

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].attachments).toHaveLength(1);

    expect(inserted).toHaveLength(1);
    expect(inserted[0].table).toBe('free_tool_leads');
    expect(inserted[0].row.email).toBe('engineer@example.com');
    // Distinguishable from the CP12 tool's leads.
    expect(inserted[0].row.source).toBe('free_boiler_service');
  });

  it('stores nothing about the appliance or the property', async () => {
    await post(download, { email: 'engineer@example.com', payload: minimal() });

    const serialised = JSON.stringify(inserted[0].row).toLowerCase();
    for (const leak of ['vaillant', 'ecotec', 'kitchen', 'se1', '123456', 'alex', 'property']) {
      expect(serialised).not.toContain(leak);
    }
  });

  it('rejects a malformed email without sending or storing anything', async () => {
    const response = await post(download, { email: 'nope', payload: minimal() });
    expect(response.status).toBe(400);
    expect(sentEmails).toHaveLength(0);
    expect(inserted).toHaveLength(0);
  });

  it('applies the issue gate before emailing', async () => {
    const payload = minimal();
    payload.engineer_name = '';

    const response = await post(download, { email: 'engineer@example.com', payload });
    expect(response.status).toBe(422);
    expect(sentEmails).toHaveLength(0);
    expect(inserted).toHaveLength(0);
  });
});
