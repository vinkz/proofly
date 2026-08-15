import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { safeInternalPath } from '@/lib/safe-redirect';

const SITE = 'https://certnow.uk';

/** What the browser will actually do with a value we let through. */
const resolve = (path: string | null) => (path === null ? null : new URL(path, SITE).href);

describe('safeInternalPath', () => {
  it('rejects the backslash escape that reached production', () => {
    // `startsWith('/') && !startsWith('//')` passed this, and it resolves to
    // https://evil.com/ because the URL parser treats \ as / for https.
    expect(new URL('/\\evil.com', SITE).href).toBe('https://evil.com/');
    expect(safeInternalPath('/\\evil.com', null)).toBeNull();
  });

  it('rejects every other way out of the origin', () => {
    for (const attack of [
      '//evil.com',
      '/\\/evil.com',
      '/\\\\evil.com',
      'https://evil.com',
      '\\\\evil.com',
      'javascript:alert(1)',
      '/path\\..\\evil',
    ]) {
      expect(safeInternalPath(attack, null), attack).toBeNull();
    }
  });

  it('rejects control characters, which the parser strips before resolving', () => {
    expect(safeInternalPath('/\t/evil.com', null)).toBeNull();
    expect(safeInternalPath('/\n/evil.com', null)).toBeNull();
    expect(safeInternalPath('/\u0000evil', null)).toBeNull();
  });

  it('nothing it accepts can leave the origin', () => {
    const probes = [
      '/dashboard',
      '/jobs/123',
      '/wizard/create/cp12?jobId=1',
      '/free-cp12#section',
      '/%5Cevil.com',
      '  /dashboard  ',
      '//evil.com',
      '/\\evil.com',
      'https://evil.com',
      42,
      null,
      undefined,
    ];
    for (const probe of probes) {
      const allowed = safeInternalPath(probe, null);
      if (allowed === null) continue;
      expect(resolve(allowed), String(probe)).toMatch(/^https:\/\/certnow\.uk\//);
    }
  });

  it('keeps ordinary paths, trimmed', () => {
    expect(safeInternalPath('/dashboard', null)).toBe('/dashboard');
    expect(safeInternalPath('  /jobs/12  ', null)).toBe('/jobs/12');
    expect(safeInternalPath('/a?b=1&c=2#d', null)).toBe('/a?b=1&c=2#d');
  });

  it('returns the callerfallback for anything it will not accept', () => {
    expect(safeInternalPath(undefined, '/dashboard')).toBe('/dashboard');
    expect(safeInternalPath('//evil.com', '/dashboard')).toBe('/dashboard');
    expect(safeInternalPath(42, null)).toBeNull();
  });
});

/**
 * The bug was not the check, it was that the check existed in seven copies and
 * every copy was wrong. These pin that the redirect-taking call sites use the
 * shared one.
 *
 * Deliberately not listed: require-auth reads the current pathname from request
 * headers rather than a query parameter, and its value is sanitised again by
 * whoever consumes it; server/billing concatenates onto a full origin instead
 * of resolving against it, so the authority is already fixed and a backslash
 * cannot move it (verified: `https://certnow.uk` + `/\\evil.com` stays on
 * certnow.uk).
 */
const REDIRECT_CALL_SITES = [
  'src/app/auth/callback/route.ts',
  'src/app/login/login-client.tsx',
  'src/server/auth.ts',
  'src/app/(app)/invoices/[invoiceId]/page.tsx',
  'src/app/(app)/invoices/new/page.tsx',
];

describe('call sites use the shared check', () => {
  it.each(REDIRECT_CALL_SITES)('%s imports safeInternalPath', (file) => {
    expect(readFileSync(file, 'utf8')).toMatch(/safeInternalPath/);
  });

  it.each(REDIRECT_CALL_SITES)('%s no longer rolls its own', (file) => {
    const source = readFileSync(file, 'utf8');
    expect(source).not.toMatch(/startsWith\('\/\/'\)/);
  });
});
