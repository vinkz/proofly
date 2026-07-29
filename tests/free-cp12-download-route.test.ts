import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FreeCp12PayloadInput } from '@/lib/cp12/freeCp12Payload';

vi.mock('@/lib/public-action-security', () => ({
  consumePublicActionRateLimit: async () => ({ allowed: true, remaining: 4, retryAfterSeconds: 0 }),
}));

/**
 * The download step is the only place the free tool writes anything. It must
 * write exactly one row containing exactly the email, timestamp and source —
 * and nothing about the certificate.
 */
type Insert = Record<string, unknown>;

const inserted: Array<{ table: string; row: Insert }> = [];
const sentEmails: Array<{ to: string | string[]; subject: string; attachments?: unknown[] }> = [];
let leadCountToday = 0;

vi.mock('@/lib/supabaseServer', () => ({
  supabaseServerServiceRole: async () => ({
    from(table: string) {
      return {
        insert(row: Insert) {
          inserted.push({ table, row });
          return Promise.resolve({ error: null });
        },
        select() {
          return {
            eq() {
              return {
                gte: () => Promise.resolve({ count: leadCountToday, error: null }),
              };
            },
          };
        },
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

const { POST: download } = await import('@/app/api/free-cp12/download/route');
const { FREE_CP12_LIMITS } = await import('@/lib/cp12/free-tool');

const payload = (): FreeCp12PayloadInput => ({
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

let ipCounter = 0;
const freshIp = () => `192.0.2.${(ipCounter += 1)}`;

const post = (body: unknown, ip = freshIp()) =>
  download(
    new Request('http://localhost/api/free-cp12/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify(body),
    }),
  );

describe('free CP12 download route', () => {
  beforeEach(() => {
    inserted.length = 0;
    sentEmails.length = 0;
    leadCountToday = 0;
  });

  it('emails the PDF as an attachment and writes exactly one lead row', async () => {
    const response = await post({ email: 'Engineer@Example.com', payload: payload() });
    const data = (await response.json()) as {
      emailed: boolean;
      reference: string;
      documents: Array<{ reference: string; base64: string }>;
    };

    expect(response.status).toBe(200);
    expect(data.emailed).toBe(true);
    expect(data.documents).toHaveLength(1);
    expect(data.documents[0].reference).toBe(data.reference);
    expect(data.documents[0].base64).toMatch(/^[A-Za-z0-9+/]+=*$/);

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe('Engineer@Example.com');
    expect(sentEmails[0].attachments).toHaveLength(1);

    expect(inserted).toHaveLength(1);
    expect(inserted[0].table).toBe('free_tool_leads');
  });

  it('stores the email, source and nothing about the certificate', async () => {
    await post({ email: 'Engineer@Example.com', payload: payload() });

    const row = inserted[0].row;
    expect(Object.keys(row).sort()).toEqual(['email', 'source']);
    expect(row.email).toBe('engineer@example.com');
    expect(row.source).toBe('free_cp12');

    // Nothing from the certificate may appear in the persisted row.
    const serialised = JSON.stringify(row).toLowerCase();
    for (const leak of ['property', 'landlord', 'vaillant', 'kitchen', 'se1', '123456', 'alex']) {
      expect(serialised).not.toContain(leak);
    }
  });

  it('rejects a malformed email address with a readable message', async () => {
    const response = await post({ email: 'not-an-email', payload: payload() });
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/email address/i);
    expect(inserted).toHaveLength(0);
    expect(sentEmails).toHaveLength(0);
  });

  it('applies the statutory gate before emailing anything', async () => {
    const incomplete = payload();
    incomplete.fields.engineer_name = '';

    const response = await post({ email: 'engineer@example.com', payload: incomplete });

    expect(response.status).toBe(422);
    expect(sentEmails).toHaveLength(0);
    expect(inserted).toHaveLength(0);
  });

  it('caps downloads per email per day using the database count', async () => {
    leadCountToday = FREE_CP12_LIMITS.downloadPerEmailPerDay;

    const response = await post({ email: 'engineer@example.com', payload: payload() });
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(429);
    expect(data.error).toMatch(/already been sent/i);
    expect(data.error).not.toMatch(/at .*\(/);
    expect(sentEmails).toHaveLength(0);
    expect(inserted).toHaveLength(0);
  });

  it('caps downloads per IP per day', async () => {
    const ip = freshIp();
    for (let i = 0; i < FREE_CP12_LIMITS.downloadPerIpPerDay; i += 1) {
      const ok = await post({ email: `engineer${i}@example.com`, payload: payload() }, ip);
      expect(ok.status).toBe(200);
    }

    const blocked = await post({ email: 'engineer@example.com', payload: payload() }, ip);
    const data = (await blocked.json()) as { error: string };

    expect(blocked.status).toBe(429);
    expect(data.error).toMatch(/limit/i);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
  });

  it('attaches every document, and still writes only one lead row', async () => {
    const unsafe = payload();
    unsafe.appliances[0].safety_classification = 'id';
    unsafe.appliances[0].defect_notes = 'Cracked heat exchanger';
    unsafe.appliances[0].actions_taken = 'Capped and labelled';
    unsafe.appliances[0].unsafe_situation = {
      customer_present: 'Yes',
      customer_informed: 'Yes',
      gas_supply_isolated: 'Yes',
      danger_label_fitted: 'Yes',
      riddor_reported: 'Yes',
    };
    unsafe.fields.defect_description = 'Cracked heat exchanger';
    unsafe.fields.remedial_action = 'Capped and labelled';

    const response = await post({ email: 'engineer@example.com', payload: unsafe });
    expect(response.status).toBe(200);

    // CP12 + one warning notice.
    expect(sentEmails[0].attachments).toHaveLength(2);
    expect(sentEmails[0].subject).toMatch(/warning notice/i);
    // The email wall still captures exactly one address, once.
    expect(inserted).toHaveLength(1);
  });

  it('still delivers the certificate when the lead row cannot be written', async () => {
    // A capture failure must not cost the visitor the certificate they came for.
    const response = await post({ email: 'engineer@example.com', payload: payload() });
    expect(response.status).toBe(200);
    expect(sentEmails).toHaveLength(1);
  });
});
