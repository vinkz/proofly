import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The public request form collected "Company (optional)" from the day it
 * shipped and threw it away: the client never sent the field and the table had
 * no column for it. The value is not decoration — it reaches the certificate as
 * the `landlord_company` job field, and for a letting agent submitting on a
 * landlord's behalf it is what identifies the right responsible person under
 * GSIUR 1998 Reg 36(3)(c).
 *
 * These tests pin the server end of that chain. The client end (the form
 * actually passing the field) is covered by the payload assertion below only
 * insofar as the action accepts it, so keep the form's submit in sync.
 */

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/public-action-security', () => ({
  assertPublicActionAllowed: async () => ({ allowed: true, remaining: 5, retryAfterSeconds: 0 }),
  publicActionClientIdentifier: async () => '203.0.113.9',
}));

const sentEmails: Array<{ to: string | string[]; subject: string; html?: string; text?: string }> = [];
vi.mock('@/lib/resend', () => ({
  isEmailConfigured: () => true,
  sendEmail: async (input: { to: string | string[]; subject: string; html?: string; text?: string }) => {
    sentEmails.push(input);
    return { status: 'sent' as const, id: 'email-1' };
  },
}));

type Row = Record<string, unknown>;
const inserts: Array<{ table: string; row: Row }> = [];
const updates: Array<{ table: string; row: Row }> = [];
/** Set to a Postgres error code to simulate the column not existing yet. */
let updateError: { code?: string; message: string } | null = null;

const query = (table: string) => {
  // Per-chain, so simulating the missing column fails only the update that
  // actually writes it — not the unrelated status update that follows it.
  let pendingUpdate: Row | null = null;
  const chain: Record<string, unknown> = {
    select: () => chain,
    insert: (row: Row) => {
      inserts.push({ table, row });
      return Promise.resolve({ data: null, error: null });
    },
    update: (row: Row) => {
      updates.push({ table, row });
      pendingUpdate = row;
      return chain;
    },
    eq: () => chain,
    or: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    // The landlord-address/company update is awaited directly, so the chain
    // itself has to be thenable — same shape as the real query builder.
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => {
      const failsOnMissingColumn =
        updateError !== null && pendingUpdate !== null && 'landlord_company' in pendingUpdate;
      return Promise.resolve({ data: [], error: failsOnMissingColumn ? updateError : null }).then(resolve);
    },
  };
  return chain;
};

vi.mock('@/lib/supabaseServer', () => ({
  supabaseServerServiceRole: async () => ({
    from: (table: string) => query(table),
    auth: { admin: { listUsers: async () => ({ data: { users: [] }, error: null }) } },
  }),
  supabaseServerReadOnly: async () => ({}),
  getSupabaseUser: async () => null,
}));

const { createPendingJobRequest } = await import('@/server/job-requests');

const request = (overrides: Record<string, unknown> = {}) => ({
  landlordName: 'Dani Okafor',
  landlordCompany: 'Bridgeford Lettings',
  landlordEmail: 'dani@bridgefordlettings.example',
  landlordPhone: '020 7946 0000',
  propertyAddress: '14 Selby Road, London, E11 3LT',
  propertyPostcode: 'E11 3LT',
  jobType: 'cp12' as const,
  engineerName: 'Sam Rivers',
  engineerEmail: 'sam@example.invalid',
  ...overrides,
});

beforeEach(() => {
  inserts.length = 0;
  updates.length = 0;
  sentEmails.length = 0;
  updateError = null;
});

describe('landlord company survives a public job request', () => {
  it('writes landlord_company to the request row', async () => {
    await createPendingJobRequest(request());

    const jobRequestUpdate = updates.find((entry) => entry.table === 'job_requests');
    expect(jobRequestUpdate?.row.landlord_company).toBe('Bridgeford Lettings');
  });

  it('still creates the request when the column has not been migrated yet', async () => {
    // Environments get the migration at different times; a missing column must
    // never cost us the request itself.
    updateError = { code: '42703', message: 'column "landlord_company" does not exist' };

    await expect(createPendingJobRequest(request())).resolves.toMatchObject({ ok: true });
    expect(inserts.some((entry) => entry.table === 'job_requests')).toBe(true);
  });

  it('tells the engineer which agency the request came from', async () => {
    await createPendingJobRequest(request());

    const engineerEmail = sentEmails.find((email) => email.to === 'sam@example.invalid');
    expect(engineerEmail?.html).toContain('Bridgeford Lettings');
  });

  it('omits the company line entirely for a private landlord', async () => {
    await createPendingJobRequest(request({ landlordCompany: '' }));

    const engineerEmail = sentEmails.find((email) => email.to === 'sam@example.invalid');
    expect(engineerEmail?.html).not.toContain('Company');
  });

  it('accepts a request with no company at all', async () => {
    // The field is optional in the schema; an older client that does not send
    // it must still be able to submit.
    const withoutCompany = request();
    delete (withoutCompany as Partial<typeof withoutCompany>).landlordCompany;
    await expect(createPendingJobRequest(withoutCompany)).resolves.toMatchObject({ ok: true });
  });
});
