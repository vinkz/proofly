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
 * ⚠️ STATE, 2026-07-27: set to false — the tool is indexable — by an explicit
 * owner decision taken BEFORE the Gas Safe sign-off it was originally gated on.
 * The template and the per-category field-applicability rules in
 * ./applianceConfig.ts still carry NEEDS GAS-SAFE VALIDATION notes; the
 * combustion rule for gas fires and water heaters is the outstanding one. It is
 * recorded here so nobody later reads `false` as evidence that the review
 * happened. When a registered engineer does sign the template off, clear the
 * notes in applianceConfig.ts and delete this paragraph.
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
