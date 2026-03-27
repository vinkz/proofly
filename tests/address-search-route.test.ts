import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/address-search/route';

describe('address-search route', () => {
  const originalApiKey = process.env.IDEAL_POSTCODES_API_KEY;

  beforeEach(() => {
    process.env.IDEAL_POSTCODES_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalApiKey === undefined) {
      delete process.env.IDEAL_POSTCODES_API_KEY;
      return;
    }
    process.env.IDEAL_POSTCODES_API_KEY = originalApiKey;
  });

  it('requires a minimum search query length', async () => {
    const response = await GET(new Request('http://localhost/api/address-search?q=sw'));
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain('at least 3 characters');
  });

  it('returns the provider unauthorized error with a 401 status', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await GET(new Request('http://localhost/api/address-search?q=10%20Downing'));
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(payload.error).toContain('API key');
    expect(payload.error).toContain('Unauthorized');
  });

  it('returns normalized autocomplete suggestions on success', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            hits: [
              { id: 'paf_1', suggestion: '10 Downing Street, Westminster, London, SW1A 2AA' },
              { id: 'paf_1', suggestion: '10 Downing Street, Westminster, London, SW1A 2AA' },
              { id: 'paf_2', suggestion: '11 Downing Street, Westminster, London, SW1A 2AA' },
            ],
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const response = await GET(new Request('http://localhost/api/address-search?q=10%20Downing'));
    const payload = (await response.json()) as {
      suggestions: Array<{ id: string; address: string; label: string }>;
    };

    expect(response.status).toBe(200);
    expect(payload.suggestions).toEqual([
      { id: 'paf_1', address: '10 Downing Street, Westminster, London, SW1A 2AA', label: '10 Downing Street, Westminster, London, SW1A 2AA' },
      { id: 'paf_2', address: '11 Downing Street, Westminster, London, SW1A 2AA', label: '11 Downing Street, Westminster, London, SW1A 2AA' },
    ]);
  });

  it('returns normalized resolved address details on success', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            id: 'paf_824800',
            line_1: '10 Downing Street',
            line_2: 'Flat 2',
            post_town: 'London',
            postcode: 'sw1a2aa',
            sub_building_name: 'Flat 2',
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const response = await GET(new Request('http://localhost/api/address-search?id=paf_824800'));
    const payload = (await response.json()) as {
      address: { line1: string; line2: string; city: string; postcode: string };
    };

    expect(response.status).toBe(200);
    expect(payload.address).toMatchObject({
      line1: '10 Downing Street',
      line2: 'Flat 2',
      city: 'London',
      postcode: 'SW1A 2AA',
    });
  });
});
