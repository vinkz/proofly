import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const initSource = readFileSync(join(ROOT, 'src/instrumentation-client.ts'), 'utf8');
const nextConfig = readFileSync(join(ROOT, 'next.config.ts'), 'utf8');

/**
 * Analytics must measure users, not the person building the product.
 *
 * The key lives in .env.local, so a local dev server had one and reported into
 * the production project: 53% of every event ever ingested came from
 * localhost:3000. /dashboard appeared to have 63 visitors against 13 real
 * accounts, and every funnel and rage-click number was partly measuring
 * development. Filtering after the fact does not undo it — the events are still
 * ingested, still billed, and still there in raw SQL.
 */
describe('PostHog does not capture local development', () => {
  it('guards initialisation on the hostname', () => {
    expect(initSource).toMatch(/if \(POSTHOG_KEY && !isLocalDevelopment\)/);
  });

  it('recognises every hostname a dev server is reachable on', () => {
    const pattern = initSource.match(/const LOCAL_HOSTNAMES = (\/.+\/);/)?.[1];
    expect(pattern, 'LOCAL_HOSTNAMES regex not found').toBeTruthy();
    // Rebuild the literal so the assertion tests the shipped pattern itself.
    const regex = new Function(`return ${pattern}`)() as RegExp;

    for (const host of ['localhost', '127.0.0.1', '0.0.0.0', '[::1]']) {
      expect(regex.test(host), `${host} should be treated as local`).toBe(true);
    }
    for (const host of ['certnow.uk', 'www.certnow.uk', 'proofly.vercel.app']) {
      expect(regex.test(host), `${host} must still be captured`).toBe(false);
    }
  });

  it('keys on hostname rather than NODE_ENV', () => {
    // `next build && next start` runs locally with NODE_ENV=production — which
    // is exactly how the PDF rendering gets tested — so a NODE_ENV check would
    // let the noisiest sessions through.
    const guard = initSource.slice(initSource.indexOf('const LOCAL_HOSTNAMES'));
    expect(guard).not.toMatch(/NODE_ENV[\s\S]*development[\s\S]*POSTHOG_KEY/);
    expect(initSource).toMatch(/window\.location\.hostname/);
  });
});

describe('paths real visitors reached are not left as 404s', () => {
  it('redirects the misspelled request link', () => {
    expect(nextConfig).toMatch(/source: '\/reequest', destination: '\/request'/);
  });

  it('redirects the truncated free tools link', () => {
    expect(nextConfig).toMatch(/source: '\/free', destination: '\/free-tools'/);
  });

  it('makes them permanent so the bad link stops being followed', () => {
    const redirects = nextConfig.slice(
      nextConfig.indexOf('async redirects()'),
      nextConfig.indexOf('async rewrites()'),
    );
    expect(redirects.match(/permanent: true/g)?.length).toBe(2);
  });
});

/**
 * The CSP has now broken two shipped features by omission — the PDF preview
 * (object-src) and Google sign-in (script-src) — both of which looked present
 * and failed silently. These pin the origins each integration needs, so
 * removing one fails here rather than in production.
 */
describe('the CSP allows the third-party integrations the app actually uses', () => {
  const directive = (name: string) => {
    const match = nextConfig.match(new RegExp(`"${name.replace('-', '-')} ([^"]*)"`));
    return match?.[1] ?? '';
  };

  it('allows Google Identity Services to load, style, frame and call home', () => {
    // Every one of these is required: the script boots GIS, the stylesheet
    // renders the button, the frame is the sign-in UI, the connection is the
    // credential exchange. Miss one and the button is dead or unstyled.
    expect(directive('script-src')).toContain('https://accounts.google.com/gsi/client');
    expect(directive('style-src')).toContain('https://accounts.google.com/gsi/style');
    expect(directive('frame-src')).toContain('https://accounts.google.com/gsi/');
    expect(directive('connect-src')).toContain('https://accounts.google.com/gsi/');
  });

  it('still lets our own pages preview our own PDFs', () => {
    expect(directive('object-src')).toContain('blob:');
    expect(directive('frame-ancestors')).toContain("'self'");
    expect(nextConfig).toMatch(/"X-Frame-Options", value: "SAMEORIGIN"/);
  });

  it('has not widened into a blanket allow', () => {
    // The fixes above are scoped on purpose. A wildcard here would pass the
    // assertions above while giving away what the policy exists to protect.
    for (const name of ['script-src', 'connect-src', 'frame-src', 'object-src']) {
      expect(directive(name), `${name} must not allow *`).not.toMatch(/(^|\s)\*($|\s)/);
    }
    expect(directive('frame-ancestors')).not.toContain("'none'");
  });
});
