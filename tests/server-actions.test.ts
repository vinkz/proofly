import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const supabaseServerActionMock = vi.hoisted(() => vi.fn());
const supabaseServerReadOnlyMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseServer', () => ({
  supabaseServerAction: supabaseServerActionMock,
  supabaseServerReadOnly: supabaseServerReadOnlyMock,
}));

const openaiMock = {
  responses: {
    create: vi.fn().mockResolvedValue({ output_text: 'Mock summary' }),
  },
};

vi.mock('@/lib/openai', () => ({
  getOpenAIClient: vi.fn(() => openaiMock),
}));

import { createJob, updateChecklistItem, createReportSignedUrl } from '@/server/jobs';

const baseSupabase = () => ({
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  storage: {
    from: vi.fn(),
  },
});

describe('server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createJob throws when unauthorized', async () => {
    const supabase = baseSupabase();
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    supabaseServerActionMock.mockResolvedValue(supabase);

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
    const templateFilter = vi.fn().mockReturnValue({ single: templateSingle });
    const templateSelect = vi.fn().mockReturnValue({ filter: templateFilter });

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

    supabaseServerActionMock.mockResolvedValue(supabase);

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

  it('updateChecklistItem skips when nothing to update', async () => {
    const supabase = baseSupabase();
    const updateMock = vi.fn();
    supabase.from.mockReturnValue({ update: updateMock });
    supabaseServerActionMock.mockResolvedValue(supabase);

    await expect(updateChecklistItem({ jobId: '00000000-0000-0000-0000-000000000000', itemId: 'item-1' })).resolves.toBeUndefined();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('createReportSignedUrl throws when report missing', async () => {
    const supabase = baseSupabase();
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    supabase.from.mockImplementation((table: string) => {
      if (table === 'reports') {
        return {
          select: vi.fn().mockReturnThis(),
          filter: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    supabase.storage.from.mockReturnValue({ createSignedUrl: vi.fn() });
    supabaseServerActionMock.mockResolvedValue(supabase);

    await expect(createReportSignedUrl('b4ddf2a3-0d7d-4c02-a218-1bcfdc7c9e07')).rejects.toThrow('Report not found');
  });
});
