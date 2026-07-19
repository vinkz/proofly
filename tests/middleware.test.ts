import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { middleware } from '../middleware';

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

const mockedCreateServerClient = vi.mocked(createServerClient);

describe('authentication middleware', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    mockedCreateServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as unknown as ReturnType<typeof createServerClient>);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it('sends anonymous dashboard visitors to the landing page with attribution intact', async () => {
    const request = new NextRequest(
      'https://certnow.uk/dashboard?utm_source=tiktok&utm_medium=dm',
    );

    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://certnow.uk/?utm_source=tiktok&utm_medium=dm',
    );
  });

  it('continues sending anonymous visitors to other protected pages through login', async () => {
    const request = new NextRequest('https://certnow.uk/jobs');

    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://certnow.uk/login?next=%2Fjobs');
  });
});
