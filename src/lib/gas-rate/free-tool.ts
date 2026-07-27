/**
 * Configuration for the public gas rate calculator.
 *
 * Unlike the CP12 and boiler service tools this one produces no document, so it
 * has no email capture, no rate limiting and no server endpoint at all — the
 * calculation is pure and runs in the browser. That also settles the concern
 * behind the auth gate on /api/tools/gas-rate: there is no unauthenticated
 * compute to give away, because there is no compute on our side.
 */

/**
 * ⚠️ THE single switch for discoverability of the free gas rate calculator.
 *
 * Nothing blocks this one. A gas rate calculation is arithmetic against a
 * published formula — there is no template and no prescribed content to be
 * signed off, unlike the CP12.
 */
export const FREE_GAS_RATE_NOINDEX = false;

/** Public path of the calculator. Kept here so robots.ts cannot drift from it. */
export const FREE_GAS_RATE_ROUTE = '/free-gas-rate';
