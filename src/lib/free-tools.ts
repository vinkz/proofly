/**
 * The catalogue of public, no-signup tools.
 *
 * One list, consumed by the hub page, the landing page, the cross-links on each
 * tool, robots.ts and the sitemap — so a tool cannot be listed in one place and
 * missing from another, and its discoverability cannot drift from its flag.
 */
import { FREE_CP12_NOINDEX, FREE_CP12_ROUTE } from '@/lib/cp12/free-tool';
import { FREE_BOILER_SERVICE_NOINDEX, FREE_BOILER_SERVICE_ROUTE } from '@/lib/boiler-service/free-tool';
import { FREE_GAS_RATE_NOINDEX, FREE_GAS_RATE_ROUTE } from '@/lib/gas-rate/free-tool';

export const FREE_TOOLS_ROUTE = '/free-tools';

/**
 * The hub is discoverable only if at least one tool is. Listing a page of
 * links to noindexed pages is the sort of thing that gets a site treated as
 * thin content, and it would leak the CP12 route before its sign-off.
 */
export const FREE_TOOLS_HUB_NOINDEX =
  FREE_CP12_NOINDEX && FREE_BOILER_SERVICE_NOINDEX && FREE_GAS_RATE_NOINDEX;

export type FreeTool = {
  route: string;
  name: string;
  /** One line, in the engineer's terms — what they get, not what it is. */
  blurb: string;
  /** Shown on cards so the commitment is obvious before they click. */
  effort: string;
  noindex: boolean;
  /** Calculators produce no document, so they never ask for an email. */
  capturesEmail: boolean;
};

export const FREE_TOOLS: FreeTool[] = [
  {
    route: FREE_CP12_ROUTE,
    name: 'CP12 generator',
    blurb: 'A complete Landlord Gas Safety Record as a PDF, covering every gas appliance type.',
    effort: '5 minutes · emailed to you',
    noindex: FREE_CP12_NOINDEX,
    capturesEmail: true,
  },
  {
    route: FREE_BOILER_SERVICE_ROUTE,
    name: 'Boiler service record',
    blurb: 'A gas appliance service record you can hand over or email the same day.',
    effort: '3 minutes · emailed to you',
    noindex: FREE_BOILER_SERVICE_NOINDEX,
    capturesEmail: true,
  },
  {
    route: FREE_GAS_RATE_ROUTE,
    name: 'Gas rate calculator',
    blurb: 'Heat input in kW from a timed meter test — metric or imperial, with the working shown.',
    effort: 'Instant · nothing to fill in',
    noindex: FREE_GAS_RATE_NOINDEX,
    capturesEmail: false,
  },
];

/** The tools a search engine — and the hub page — should be shown. */
export const indexableFreeTools = () => FREE_TOOLS.filter((tool) => !tool.noindex);

/** Routes that must be disallowed in robots.txt. */
export const noindexedFreeToolRoutes = () =>
  FREE_TOOLS.filter((tool) => tool.noindex).map((tool) => tool.route);
