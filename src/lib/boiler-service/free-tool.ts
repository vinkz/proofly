/**
 * Configuration for the public, no-signup boiler service record generator.
 *
 * Mirrors @/lib/cp12/free-tool. Kept separate so each tool's discoverability
 * and caps can be tuned independently — they answer to different constraints.
 */

/**
 * ⚠️ THE single switch for discoverability of the free boiler service tool.
 *
 * Note this tool is NOT blocked on the same thing the CP12 is. A service record
 * has no statutory content list — audit/gas-service-field-analysis.md is
 * explicit that the only hard requirements are engineer competence (GSIUR
 * Reg 3), appliance identity and the Reg 26(9) outcomes; everything else is
 * Benchmark convention. So there is no prescribed template awaiting Gas Safe
 * sign-off here, and this flag can be flipped independently of the CP12 one.
 */
export const FREE_BOILER_SERVICE_NOINDEX = false;

/** Public path of the free tool. Kept here so robots.ts cannot drift from it. */
export const FREE_BOILER_SERVICE_ROUTE = '/free-boiler-service';

/** Written to free_tool_leads.source so the two tools' leads stay distinguishable. */
export const FREE_BOILER_SERVICE_LEAD_SOURCE = 'free_boiler_service';

export const FREE_BOILER_SERVICE_LIMITS = {
  generatePerIpPerHour: 30,
  downloadPerIpPerDay: 10,
  downloadPerEmailPerDay: 5,
} as const;
