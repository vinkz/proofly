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
 * robots.txt. It is true because the CP12 template and the per-category
 * field-applicability rules in ./applianceConfig.ts are still pending sign-off
 * from a registered Gas Safe engineer (see the NEEDS GAS-SAFE VALIDATION notes
 * there). The tool must not be publicly discoverable until that sign-off lands.
 *
 * Flip this one constant to false to make the route indexable. Nothing else
 * needs to change.
 */
export const FREE_CP12_NOINDEX = true;

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
