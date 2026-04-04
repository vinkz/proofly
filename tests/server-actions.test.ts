import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const supabaseServerActionMock = vi.hoisted(() => vi.fn());
const supabaseServerReadOnlyMock = vi.hoisted(() => vi.fn());
const supabaseServerServiceRoleMock = vi.hoisted(() => vi.fn());
const getNextJobCodeMock = vi.hoisted(() => vi.fn());
const upsertJobAddressForJobMock = vi.hoisted(() => vi.fn());
const upsertCustomerFromJobFieldsMock = vi.hoisted(() => vi.fn());
const persistJobFieldsMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseServer', () => ({
  supabaseServerAction: supabaseServerActionMock,
  supabaseServerReadOnly: supabaseServerReadOnlyMock,
  supabaseServerServiceRole: supabaseServerServiceRoleMock,
}));

vi.mock('@/server/id-chain', () => ({
  getNextJobCode: getNextJobCodeMock,
  buildClientRef: vi.fn(() => 'CN-000001-01'),
}));

vi.mock('@/server/address-service', () => ({
  upsertJobAddressForJob: upsertJobAddressForJobMock,
}));

vi.mock('@/server/customer-service', () => ({
  getCustomerById: vi.fn(),
  resolveCustomerFromId: vi.fn(),
  upsertCustomerFromJobFields: upsertCustomerFromJobFieldsMock,
}));

vi.mock('@/server/job-fields', () => ({
  persistJobFields: persistJobFieldsMock,
}));

const openaiMock = {
  responses: {
    create: vi.fn().mockResolvedValue({ output_text: 'Mock summary' }),
  },
};

vi.mock('@/lib/openai', () => ({
  getOpenAIClient: vi.fn(() => openaiMock),
}));

import { createJob, createSoloJob, updateChecklistItem, createReportSignedUrl } from '@/server/jobs';

const baseSupabase = () => ({
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  rpc: vi.fn(),
  storage: {
    from: vi.fn(),
  },
});

describe('server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getNextJobCodeMock.mockResolvedValue('CN-000001');
    upsertJobAddressForJobMock.mockResolvedValue({ ok: true });
    upsertCustomerFromJobFieldsMock.mockResolvedValue({ ok: true });
    persistJobFieldsMock.mockResolvedValue(undefined);
  });

  it('createJob throws when unauthorized', async () => {
    const supabase = baseSupabase();
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    supabaseServerServiceRoleMock.mockResolvedValue(supabase);

    await expect(
      createJob({ client_name: 'Test', address: '123', template_id: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toThrow(
      'Unauthorized',
    );
  });

  it('createJob seeds checklist rows with user ownership', async () => {
    const supabase = baseSupabase();
    const templateId = '123e4567-e89b-12d3-a456-426614174000';
    const user = { id: 'user-123' };
    supabase.auth.getUser.mockResolvedValue({ data: { user }, error: null });

    const templateSingle = vi.fn().mockResolvedValue({
      data: {
        id: templateId,
        name: 'Template',
        items: [{ label: 'Inspect pipe' }],
        is_public: true,
        user_id: null,
        created_by: null,
      },
      error: null,
    });
    const templateSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ single: templateSingle }),
    });

    const jobSingle = vi.fn().mockResolvedValue({ data: { id: 'job-1' }, error: null });
    const jobSelect = vi.fn().mockReturnValue({ single: jobSingle });
    const jobInsert = vi.fn().mockReturnValue({ select: jobSelect });

    const checklistInsert = vi.fn().mockResolvedValue({ error: null });

    supabase.from.mockImplementation((table: string) => {
      if (table === 'templates') {
        return {
          select: templateSelect,
        };
      }
      if (table === 'jobs') {
        return {
          insert: jobInsert,
        };
      }
      if (table === 'job_items') {
        return {
          insert: checklistInsert,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    supabaseServerServiceRoleMock.mockResolvedValue(supabase);

    await createJob({
      client_name: 'Client',
      address: '42 Main St',
      template_id: templateId,
    });

    expect(checklistInsert).toHaveBeenCalledTimes(1);
    const payload = checklistInsert.mock.calls[0][0];
    expect(payload).toEqual([
      {
        job_id: 'job-1',
        template_item_id: null,
        label: 'Inspect pipe',
        result: 'pending',
        note: null,
        photos: null,
        position: null,
      },
    ]);
  });

  it('createSoloJob throws when unauthorized', async () => {
    const supabase = baseSupabase();
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    supabaseServerServiceRoleMock.mockResolvedValue(supabase);

    await expect(
      createSoloJob({
        clientMode: 'new',
        clientName: 'Client',
        clientPhone: '',
        clientEmail: '',
        propertyName: 'Flat 1',
        addressLine1: '42 Main St',
        city: 'London',
        postcode: 'E1 1AA',
        sitePhone: '',
        scheduledFor: '2026-04-01T09:00',
        jobType: 'service',
      }),
    ).rejects.toThrow('Unauthorized');
  });

  it('createSoloJob creates an upcoming job for an existing client', async () => {
    const supabase = baseSupabase();
    const user = { id: 'user-123' };
    supabase.auth.getUser.mockResolvedValue({ data: { user }, error: null });

    const existingClientMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'client-1',
        name: 'Client One',
        phone: '01234 567890',
        email: 'client@example.com',
        user_id: user.id,
      },
      error: null,
    });
    const existingClientEqUser = vi.fn().mockReturnValue({ maybeSingle: existingClientMaybeSingle });
    const existingClientEqId = vi.fn().mockReturnValue({ eq: existingClientEqUser });

    const jobSingle = vi.fn().mockResolvedValue({ data: { id: 'job-1' }, error: null });
    const jobSelect = vi.fn().mockReturnValue({ single: jobSingle });
    const jobInsert = vi.fn().mockReturnValue({ select: jobSelect });

    supabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: existingClientEqId,
          }),
        };
      }
      if (table === 'jobs') {
        return {
          insert: jobInsert,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    supabaseServerServiceRoleMock.mockResolvedValue(supabase);

    await expect(
      createSoloJob({
        clientMode: 'existing',
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        clientName: '',
        clientPhone: '',
        clientEmail: '',
        propertyName: 'Flat 1',
        addressLine1: '42 Main St',
        city: 'London',
        postcode: 'E1 1AA',
        sitePhone: '020 7946 0958',
        scheduledFor: '2026-04-01T09:00',
        jobType: 'service',
      }),
    ).resolves.toEqual({ jobId: 'job-1' });

    expect(jobInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'client-1',
        client_name: 'Client One',
        status: 'active',
        title: 'Service',
        scheduled_for: '2026-04-01T09:00',
        job_type: 'service',
      }),
    );
    expect(upsertJobAddressForJobMock).toHaveBeenCalledWith({
      jobId: 'job-1',
      fields: {
        line1: '42 Main St',
        town: 'London',
        postcode: 'E1 1AA',
      },
      sb: supabase,
      userId: 'user-123',
    });
    expect(persistJobFieldsMock).toHaveBeenCalledTimes(1);
  });

  it('createSoloJob stores canonical card fields for a non-CP12 job', async () => {
    const supabase = baseSupabase();
    const user = { id: 'user-123' };
    supabase.auth.getUser.mockResolvedValue({ data: { user }, error: null });

    const clientSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'client-3',
        name: 'Jordan Smith',
        phone: '07700 900456',
        email: null,
        organization: 'Smith Lettings',
        address: '9 Office Park, Floor 2, London, SE1 2BB',
        postcode: 'SE1 2BB',
      },
      error: null,
    });
    const clientSelect = vi.fn().mockReturnValue({ single: clientSingle });
    const clientInsert = vi.fn().mockReturnValue({ select: clientSelect });

    const jobSingle = vi.fn().mockResolvedValue({ data: { id: 'job-3' }, error: null });
    const jobSelect = vi.fn().mockReturnValue({ single: jobSingle });
    const jobInsert = vi.fn().mockReturnValue({ select: jobSelect });

    supabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          insert: clientInsert,
        };
      }
      if (table === 'jobs') {
        return {
          insert: jobInsert,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    supabaseServerServiceRoleMock.mockResolvedValue(supabase);

    await expect(
      createSoloJob({
        clientMode: 'new',
        clientName: 'Jordan Smith',
        clientPhone: '07700 900456',
        clientEmail: '',
        propertyName: 'Boiler room',
        addressLine1: '55 Station Road',
        city: 'London',
        postcode: 'E2 2AA',
        sitePhone: '020 7000 0000',
        scheduledFor: '2026-04-02T11:30',
        jobType: 'service',
        inspectionDate: '',
        jobAddressName: 'Boiler room',
        jobAddressLine1: '55 Station Road',
        jobAddressLine2: 'Rear entrance',
        jobAddressCity: 'London',
        jobAddressPostcode: 'E2 2AA',
        jobAddressTel: '020 7000 0000',
        landlordName: 'Jordan Smith',
        landlordCompany: 'Smith Lettings',
        landlordAddressLine1: '9 Office Park',
        landlordAddressLine2: 'Floor 2',
        landlordCity: 'London',
        landlordPostcode: 'SE1 2BB',
        landlordTel: '07700 900456',
      }),
    ).resolves.toEqual({ jobId: 'job-3' });

    expect(clientInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Jordan Smith',
        phone: '07700 900456',
        organization: 'Smith Lettings',
        address: '9 Office Park, Floor 2, London',
        postcode: 'SE1 2BB',
        user_id: 'user-123',
      }),
    );
    expect(upsertJobAddressForJobMock).toHaveBeenCalledWith({
      jobId: 'job-3',
      fields: {
        line1: '55 Station Road',
        line2: 'Rear entrance',
        town: 'London',
        postcode: 'E2 2AA',
      },
      sb: supabase,
      userId: 'user-123',
    });
    expect(persistJobFieldsMock).toHaveBeenCalledWith(
      supabase,
      'job-3',
      expect.arrayContaining([
        expect.objectContaining({ field_key: 'job_address_name', value: 'Boiler room' }),
        expect.objectContaining({ field_key: 'job_address_line1', value: '55 Station Road' }),
        expect.objectContaining({ field_key: 'job_address_line2', value: 'Rear entrance' }),
        expect.objectContaining({ field_key: 'job_address_city', value: 'London' }),
        expect.objectContaining({ field_key: 'job_postcode', value: 'E2 2AA' }),
        expect.objectContaining({ field_key: 'job_tel', value: '020 7000 0000' }),
        expect.objectContaining({ field_key: 'property_address_line2', value: 'Rear entrance' }),
      ]),
      'createSoloJob',
    );
  });

  it('createSoloJob stores canonical CP12 step 1 fields for a safety check without a client record', async () => {
    const supabase = baseSupabase();
    const user = { id: 'user-123' };
    supabase.auth.getUser.mockResolvedValue({ data: { user }, error: null });

    const clientSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'client-2',
        name: 'Sam Patel',
        phone: '07700 900123',
        email: null,
        organization: 'Patel Properties',
        address: '7 Owner Road, London',
        postcode: 'N1 1AA',
      },
      error: null,
    });
    const clientSelect = vi.fn().mockReturnValue({ single: clientSingle });
    const clientInsert = vi.fn().mockReturnValue({ select: clientSelect });

    const jobSingle = vi.fn().mockResolvedValue({ data: { id: 'job-2' }, error: null });
    const jobSelect = vi.fn().mockReturnValue({ single: jobSingle });
    const jobInsert = vi.fn().mockReturnValue({ select: jobSelect });

    supabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          insert: clientInsert,
        };
      }
      if (table === 'jobs') {
        return {
          insert: jobInsert,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    supabaseServerServiceRoleMock.mockResolvedValue(supabase);

    await expect(
      createSoloJob({
        clientMode: 'new',
        clientName: '',
        clientPhone: '',
        clientEmail: '',
        propertyName: '',
        addressLine1: '',
        city: '',
        postcode: '',
        sitePhone: '',
        scheduledFor: '2026-04-01T09:00',
        jobType: 'safety_check',
        inspectionDate: '2026-04-01',
        jobAddressName: 'Flat 2 - Tenant entrance',
        jobAddressLine1: '42 Main St',
        jobAddressLine2: 'Top floor',
        jobAddressCity: 'London',
        jobAddressPostcode: 'E1 1AA',
        jobAddressTel: '020 7946 0958',
        landlordName: 'Sam Patel',
        landlordCompany: 'Patel Properties',
        landlordAddressLine1: '7 Owner Road',
        landlordAddressLine2: '',
        landlordCity: 'London',
        landlordPostcode: 'N1 1AA',
        landlordTel: '07700 900123',
      }),
    ).resolves.toEqual({ jobId: 'job-2' });

    expect(jobInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'client-2',
        client_name: 'Sam Patel',
        title: 'CP12 for Sam Patel',
        job_type: 'safety_check',
        scheduled_for: '2026-04-01T09:00',
      }),
    );
    expect(upsertJobAddressForJobMock).toHaveBeenCalledWith({
      jobId: 'job-2',
      fields: {
        line1: '42 Main St',
        line2: 'Top floor',
        town: 'London',
        postcode: 'E1 1AA',
      },
      sb: supabase,
      userId: 'user-123',
    });
    expect(persistJobFieldsMock).toHaveBeenCalledWith(
      supabase,
      'job-2',
      expect.arrayContaining([
        expect.objectContaining({ field_key: 'inspection_date', value: '2026-04-01' }),
        expect.objectContaining({ field_key: 'job_address_name', value: 'Flat 2 - Tenant entrance' }),
        expect.objectContaining({ field_key: 'job_address_line1', value: '42 Main St' }),
        expect.objectContaining({ field_key: 'job_address_line2', value: 'Top floor' }),
        expect.objectContaining({ field_key: 'job_address_city', value: 'London' }),
        expect.objectContaining({ field_key: 'job_postcode', value: 'E1 1AA' }),
        expect.objectContaining({ field_key: 'job_tel', value: '020 7946 0958' }),
        expect.objectContaining({ field_key: 'landlord_name', value: 'Sam Patel' }),
        expect.objectContaining({ field_key: 'landlord_company', value: 'Patel Properties' }),
        expect.objectContaining({ field_key: 'landlord_address_line1', value: '7 Owner Road' }),
        expect.objectContaining({ field_key: 'landlord_city', value: 'London' }),
        expect.objectContaining({ field_key: 'landlord_postcode', value: 'N1 1AA' }),
        expect.objectContaining({ field_key: 'landlord_tel', value: '07700 900123' }),
      ]),
      'createSoloJob',
    );
  });

  it('updateChecklistItem skips when nothing to update', async () => {
    const supabase = baseSupabase();
    const updateMock = vi.fn();
    supabase.from.mockReturnValue({ update: updateMock });
    supabaseServerServiceRoleMock.mockResolvedValue(supabase);

    await expect(updateChecklistItem({ jobId: '00000000-0000-0000-0000-000000000000', itemId: 'item-1' })).resolves.toBeUndefined();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('createReportSignedUrl throws when report missing', async () => {
    const supabase = baseSupabase();
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    supabase.from.mockImplementation((table: string) => {
      if (table === 'reports') {
        const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ maybeSingle }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    supabase.storage.from.mockReturnValue({ createSignedUrl: vi.fn() });
    supabaseServerServiceRoleMock.mockResolvedValue(supabase);

    await expect(createReportSignedUrl('b4ddf2a3-0d7d-4c02-a218-1bcfdc7c9e07')).rejects.toThrow('Report not found');
  });
});
