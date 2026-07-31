/**
 * Configuration for the public, no-signup CP12 generator.
 *
 * Framework-free so the route, the API handlers and robots.ts can all read the
 * same values.
 */

/**
 * ⚠️ THE single switch for discoverability of the free CP12 tool.
 *
 * While true the route sends `noindex, nofollow` and is disallowed in
 * robots.txt. Flipping this one constant is the whole change; nothing else
 * needs to move.
 *
 * ⚠️ STATE, 2026-07-31: the product owner explicitly approved indexing without
 * a registered Gas Safe engineer review, and has since decided not to seek one
 * at all. Setting this to false controls discoverability only and must not be
 * read as evidence of compliance sign-off.
 *
 * The template and the field-applicability rules in ./applianceConfig.ts carry
 * `GAS-SAFE REVIEW` notes recording the same accepted risk — see that file's
 * header for what specifically was never reviewed. It is recorded in both
 * places so the risk stays visible to anyone reading either one.
 */
export const FREE_CP12_NOINDEX = false;

/** Public path of the free tool. Kept here so robots.ts cannot drift from it. */
export const FREE_CP12_ROUTE = '/free-cp12';

/** Written to free_tool_leads.source so leads can be attributed later. */
export const FREE_CP12_LEAD_SOURCE = 'free_cp12';

/**
 * Caps. Generous enough that a real engineer filling in one certificate never
 * meets them; tight enough that the endpoint is not a free PDF-rendering farm.
 */
export const FREE_CP12_LIMITS = {
  /** Renders per IP per hour (preview is cheap but not free). */
  generatePerIpPerHour: 30,
  /** Download+email per IP per day. */
  downloadPerIpPerDay: 10,
  /** Download+email per email address per day, counted in the database. */
  downloadPerEmailPerDay: 5,
} as const;
