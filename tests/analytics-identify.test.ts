import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * PostHog runs with `persistence: 'memory'`, so the distinct ID is never
 * written to the device and does not survive a page load. identify() was only
 * called at login, signup and Google auth, so an engineer's identity lasted
 * until their next full navigation and then vanished — every job, certificate
 * and invoice after that landed on a fresh anonymous person.
 *
 * Re-asserting identity on load fixes it without storing anything, so the
 * cookieless posture is unchanged. These pin both halves: that it happens
 * inside the authenticated layouts, and that it does not leak to anonymous
 * visitors on the free tools.
 */
const identify = readFileSync('src/components/analytics/identify-user.tsx', 'utf8');
const appLayout = readFileSync('src/app/(app)/layout.tsx', 'utf8');
const wizardLayout = readFileSync('src/app/(wizard)/layout.tsx', 'utf8');
const rootLayout = readFileSync('src/app/layout.tsx', 'utf8');

describe('IdentifyUser', () => {
  it('re-identifies from the server session rather than from stored state', () => {
    expect(identify).toMatch(/posthog\.identify\(userId/);
  });

  it('skips the call when PostHog already has the right person', () => {
    // Without this it would emit a redundant $identify on every remount.
    expect(identify).toMatch(/posthog\.get_distinct_id\(\) === userId\) return/);
  });

  it('does nothing before PostHog has loaded, and never throws', () => {
    expect(identify).toMatch(/if \(!posthog\.__loaded\) return/);
    expect(identify).toMatch(/catch \{/);
  });
});

describe('where it is mounted', () => {
  it('runs in the authenticated app layout', () => {
    expect(appLayout).toMatch(/<IdentifyUser userId=\{analyticsUser\.id\}/);
  });

  it('runs in the wizard layout, which already had the user', () => {
    expect(wizardLayout).toMatch(/<IdentifyUser userId=\{user\.id\}/);
  });

  it('does not run for anonymous visitors', () => {
    // The root layout wraps the free tools too. Identifying there would defeat
    // the point of the cookieless setup.
    expect(rootLayout).not.toMatch(/IdentifyUser/);
  });

  it('cannot lock anyone out of their own dashboard', () => {
    // RequireAuth gates the page; this lookup is analytics only, so a failure
    // has to degrade to "not identified", never to an error boundary.
    expect(appLayout).toMatch(/analyticsUser = null/);
  });
});
