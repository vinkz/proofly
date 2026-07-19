import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { GET } from '@/app/tiktok/route';

describe('TikTok campaign redirect', () => {
  it('redirects to the dashboard and preserves attribution parameters', () => {
    const request = new NextRequest(
      'https://certnow.uk/tiktok?utm_source=tiktok&utm_medium=social&utm_campaign=engineers',
    );

    const response = GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://certnow.uk/dashboard?utm_source=tiktok&utm_medium=social&utm_campaign=engineers',
    );
  });
});
