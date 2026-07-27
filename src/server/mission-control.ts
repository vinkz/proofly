import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env, assertSupabaseEnv } from '@/lib/env';
import { isEmailConfigured } from '@/lib/resend';
import { getStripe } from '@/lib/stripe';

// Fallback so the page works before ADMIN_EMAILS is configured on Vercel.
const DEFAULT_ADMIN_EMAILS = ['kelvinhospodarz@gmail.com'];

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  const configured = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const admins = configured.length > 0 ? configured : DEFAULT_ADMIN_EMAILS;
  return admins.includes(email.toLowerCase());
}

// Untyped service-role client: the generated Database types lag behind the live
// schema (e.g. profiles.trial_ends_at / subscription_status), so typed selects
// on those columns would not compile.
function adminDb(): SupabaseClient {
  assertSupabaseEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

export type SentryIssue = {
  id: string;
  title: string;
  culprit: string | null;
  level: string;
  count: number;
  userCount: number;
  lastSeen: string;
  permalink: string;
};

export type SentryPanel =
  | { configured: false }
  | { configured: true; error: string; issues: null }
  | { configured: true; error: null; issues: SentryIssue[] };

export async function getSentryIssues(): Promise<SentryPanel> {
  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  const token = process.env.SENTRY_AUTH_TOKEN;
  if (!org || !project || !token) return { configured: false };

  try {
    const url =
      `https://sentry.io/api/0/projects/${org}/${project}/issues/` +
      `?query=${encodeURIComponent('is:unresolved')}&statsPeriod=24h&sort=date&limit=10`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) {
      return { configured: true, error: `Sentry API returned ${response.status}`, issues: null };
    }
    const payload = (await response.json()) as Array<{
      id: string;
      title: string;
      culprit?: string;
      level?: string;
      count?: string;
      userCount?: number;
      lastSeen?: string;
      permalink?: string;
    }>;
    return {
      configured: true,
      error: null,
      issues: payload.map((issue) => ({
        id: issue.id,
        title: issue.title,
        culprit: issue.culprit ?? null,
        level: issue.level ?? 'error',
        count: Number.parseInt(issue.count ?? '0', 10) || 0,
        userCount: issue.userCount ?? 0,
        lastSeen: issue.lastSeen ?? '',
        permalink: issue.permalink ?? '#',
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Sentry error';
    return { configured: true, error: message, issues: null };
  }
}

export type PulseStat = { last24h: number; last7d: number };

export type TrafficStats = {
  pageviews: PulseStat;
  visitors: PulseStat;
  signups: PulseStat;
  jobs: PulseStat;
};

export type TrafficPanel =
  | { configured: false }
  | { configured: true; error: string; stats: null; dashboardUrl: string }
  | { configured: true; error: null; stats: TrafficStats; dashboardUrl: string };

// PostHog project + API host. The ingest host (eu.i.posthog.com) differs from
// the app/API host (eu.posthog.com); default to the EU app host and let it be
// overridden for US/self-hosted. Reads via process.env (like getSentryIssues)
// since these are server-only and not part of the typed env.
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID ?? '220662';
const POSTHOG_API_HOST = (process.env.POSTHOG_API_HOST ?? 'https://eu.posthog.com').replace(/\/$/, '');
const POSTHOG_DASHBOARD_ID = process.env.POSTHOG_DASHBOARD_ID ?? '808798';

function posthogDashboardUrl() {
  return `${POSTHOG_API_HOST}/project/${POSTHOG_PROJECT_ID}/dashboard/${POSTHOG_DASHBOARD_ID}`;
}

const num = (value: unknown) => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

export async function getTraffic(): Promise<TrafficPanel> {
  const token = process.env.POSTHOG_PERSONAL_API_KEY;
  const dashboardUrl = posthogDashboardUrl();
  if (!token) return { configured: false };

  // One HogQL query returns all six-plus aggregates via conditional counts, so
  // the panel costs a single round-trip. person_id powers unique visitors.
  const hogql = `
    SELECT
      countIf(event = '$pageview' AND timestamp > now() - INTERVAL 1 DAY) AS pv24,
      countIf(event = '$pageview' AND timestamp > now() - INTERVAL 7 DAY) AS pv7,
      uniqIf(person_id, event = '$pageview' AND timestamp > now() - INTERVAL 1 DAY) AS uv24,
      uniqIf(person_id, event = '$pageview' AND timestamp > now() - INTERVAL 7 DAY) AS uv7,
      countIf(event = 'signup_completed' AND timestamp > now() - INTERVAL 1 DAY) AS su24,
      countIf(event = 'signup_completed' AND timestamp > now() - INTERVAL 7 DAY) AS su7,
      countIf(event = 'job_created' AND timestamp > now() - INTERVAL 1 DAY) AS jc24,
      countIf(event = 'job_created' AND timestamp > now() - INTERVAL 7 DAY) AS jc7
    FROM events
    WHERE timestamp > now() - INTERVAL 7 DAY
  `;

  try {
    const response = await fetch(`${POSTHOG_API_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query: hogql } }),
      cache: 'no-store',
    });
    if (!response.ok) {
      return {
        configured: true,
        error: `PostHog API returned ${response.status}`,
        stats: null,
        dashboardUrl,
      };
    }
    const payload = (await response.json()) as { results?: unknown[][] };
    const row = payload.results?.[0] ?? [];
    return {
      configured: true,
      error: null,
      stats: {
        pageviews: { last24h: num(row[0]), last7d: num(row[1]) },
        visitors: { last24h: num(row[2]), last7d: num(row[3]) },
        signups: { last24h: num(row[4]), last7d: num(row[5]) },
        jobs: { last24h: num(row[6]), last7d: num(row[7]) },
      },
      dashboardUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown PostHog error';
    return { configured: true, error: message, stats: null, dashboardUrl };
  }
}

export type TrialEndingSoon = {
  name: string;
  trialEndsAt: string;
};

export type RecentSignup = {
  name: string;
  createdAt: string;
};

export type BusinessPulse = {
  signups: PulseStat;
  jobs: PulseStat;
  certificates: PulseStat;
  pendingRequests: number;
  trialsEndingSoon: TrialEndingSoon[];
  recentSignups: RecentSignup[];
  error: string | null;
};

type CountQuery = PromiseLike<{ count: number | null; error: { message: string } | null }> & {
  gte(column: string, value: string): CountQuery;
  lte(column: string, value: string): CountQuery;
  eq(column: string, value: string): CountQuery;
  neq(column: string, value: string): CountQuery;
};

async function countRows(
  db: SupabaseClient,
  table: string,
  filter: (query: CountQuery) => CountQuery,
) {
  const base = db.from(table).select('id', { count: 'exact', head: true }) as unknown as CountQuery;
  const { count, error } = await filter(base);
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

const displayName = (row: { full_name?: string | null; company_name?: string | null }) =>
  row.full_name?.trim() || row.company_name?.trim() || 'Unnamed engineer';

export async function getBusinessPulse(): Promise<BusinessPulse> {
  const empty: BusinessPulse = {
    signups: { last24h: 0, last7d: 0 },
    jobs: { last24h: 0, last7d: 0 },
    certificates: { last24h: 0, last7d: 0 },
    pendingRequests: 0,
    trialsEndingSoon: [],
    recentSignups: [],
    error: null,
  };

  try {
    const db = adminDb();
    const [
      signups24h,
      signups7d,
      jobs24h,
      jobs7d,
      certs24h,
      certs7d,
      pendingRequests,
      trialsResult,
      signupsResult,
    ] = await Promise.all([
      countRows(db, 'profiles', (q) => q.gte('created_at', iso(DAY_MS))),
      countRows(db, 'profiles', (q) => q.gte('created_at', iso(7 * DAY_MS))),
      countRows(db, 'jobs', (q) => q.gte('created_at', iso(DAY_MS))),
      countRows(db, 'jobs', (q) => q.gte('created_at', iso(7 * DAY_MS))),
      countRows(db, 'certificates', (q) => q.gte('created_at', iso(DAY_MS))),
      countRows(db, 'certificates', (q) => q.gte('created_at', iso(7 * DAY_MS))),
      countRows(db, 'job_requests', (q) => q.eq('status', 'pending')),
      db
        .from('profiles')
        .select('full_name, company_name, trial_ends_at')
        .gte('trial_ends_at', new Date().toISOString())
        .lte('trial_ends_at', new Date(Date.now() + 3 * DAY_MS).toISOString())
        .neq('subscription_status', 'active')
        .order('trial_ends_at', { ascending: true })
        .limit(5),
      db
        .from('profiles')
        .select('full_name, company_name, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    if (trialsResult.error) throw new Error(`trials: ${trialsResult.error.message}`);
    if (signupsResult.error) throw new Error(`signups: ${signupsResult.error.message}`);

    return {
      signups: { last24h: signups24h, last7d: signups7d },
      jobs: { last24h: jobs24h, last7d: jobs7d },
      certificates: { last24h: certs24h, last7d: certs7d },
      pendingRequests,
      trialsEndingSoon: (trialsResult.data ?? []).map((row) => ({
        name: displayName(row),
        trialEndsAt: row.trial_ends_at as string,
      })),
      recentSignups: (signupsResult.data ?? []).map((row) => ({
        name: displayName(row),
        createdAt: row.created_at as string,
      })),
      error: null,
    };
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : 'Unknown database error' };
  }
}

export type FreeToolSourceStat = {
  source: string;
  last24h: number;
  last7d: number;
};

export type FreeToolsPulse = {
  leads: PulseStat;
  bySource: FreeToolSourceStat[];
  /** ISO timestamp of the most recent lead, or null if none has ever landed. */
  lastLeadAt: string | null;
  total: number;
  error: string | null;
};

/**
 * Lead capture for the public free tools.
 *
 * These rows are the only thing those tools persist, and the write path is
 * deliberately non-fatal — a visitor still gets their certificate if it fails.
 * That means a broken funnel is invisible from the outside, so it gets a panel
 * here as well as a Sentry report on failure.
 *
 * Counts and timestamps only. The email addresses are not surfaced: nothing in
 * the app reads them, and an admin dashboard is not a reason to start.
 */
export async function getFreeToolsPulse(): Promise<FreeToolsPulse> {
  const empty: FreeToolsPulse = {
    leads: { last24h: 0, last7d: 0 },
    bySource: [],
    lastLeadAt: null,
    total: 0,
    error: null,
  };

  try {
    const db = adminDb();
    const [last24h, last7d, total, recent] = await Promise.all([
      countRows(db, 'free_tool_leads', (q) => q.gte('created_at', iso(DAY_MS))),
      countRows(db, 'free_tool_leads', (q) => q.gte('created_at', iso(7 * DAY_MS))),
      countRows(db, 'free_tool_leads', (q) => q),
      db
        .from('free_tool_leads')
        .select('source, created_at')
        .gte('created_at', iso(7 * DAY_MS))
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);

    if (recent.error) throw new Error(`free_tool_leads: ${recent.error.message}`);
    const rows = (recent.data ?? []) as Array<{ source: string; created_at: string }>;

    const dayAgo = iso(DAY_MS);
    const bySource = new Map<string, FreeToolSourceStat>();
    for (const row of rows) {
      const stat = bySource.get(row.source) ?? { source: row.source, last24h: 0, last7d: 0 };
      stat.last7d += 1;
      if (row.created_at >= dayAgo) stat.last24h += 1;
      bySource.set(row.source, stat);
    }

    return {
      leads: { last24h, last7d },
      bySource: [...bySource.values()].sort((a, b) => b.last7d - a.last7d),
      lastLeadAt: rows[0]?.created_at ?? null,
      total,
      error: null,
    };
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : 'Unknown database error' };
  }
}

export type MoneyPanel = {
  activeSubs: number;
  pastDue: number;
  mrrPence: number | null;
  failedPayments7d: number | null;
  stripeConfigured: boolean;
  stripeError: string | null;
  dbError: string | null;
};

export async function getMoney(): Promise<MoneyPanel> {
  const panel: MoneyPanel = {
    activeSubs: 0,
    pastDue: 0,
    mrrPence: null,
    failedPayments7d: null,
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    stripeError: null,
    dbError: null,
  };

  try {
    const db = adminDb();
    const [activeSubs, pastDue] = await Promise.all([
      countRows(db, 'profiles', (q) => q.eq('subscription_status', 'active')),
      countRows(db, 'profiles', (q) => q.eq('subscription_status', 'past_due')),
    ]);
    panel.activeSubs = activeSubs;
    panel.pastDue = pastDue;
  } catch (error) {
    panel.dbError = error instanceof Error ? error.message : 'Unknown database error';
  }

  if (panel.stripeConfigured) {
    try {
      const stripe = getStripe();
      const [subscriptions, charges] = await Promise.all([
        stripe.subscriptions.list({ status: 'active', limit: 100 }),
        stripe.charges.list({ limit: 100, created: { gte: Math.floor((Date.now() - 7 * DAY_MS) / 1000) } }),
      ]);
      panel.mrrPence = subscriptions.data.reduce((total, subscription) => {
        return (
          total +
          subscription.items.data.reduce((subTotal, item) => {
            const amount = item.price.unit_amount ?? 0;
            const quantity = item.quantity ?? 1;
            const monthly = item.price.recurring?.interval === 'year' ? amount / 12 : amount;
            return subTotal + monthly * quantity;
          }, 0)
        );
      }, 0);
      panel.failedPayments7d = charges.data.filter((charge) => charge.status === 'failed').length;
    } catch (error) {
      panel.stripeError = error instanceof Error ? error.message : 'Unknown Stripe error';
    }
  }

  return panel;
}

export type HealthCheck = {
  label: string;
  status: 'ok' | 'warn' | 'down';
  detail: string;
};

export function getHealthChecks(input: {
  sentry: SentryPanel;
  pulse: BusinessPulse;
  money: MoneyPanel;
  traffic: TrafficPanel;
  freeTools: FreeToolsPulse;
}): HealthCheck[] {
  const checks: HealthCheck[] = [];

  if (!input.sentry.configured) {
    checks.push({ label: 'Error tracking', status: 'warn', detail: 'Sentry not connected yet' });
  } else if (input.sentry.error) {
    checks.push({ label: 'Error tracking', status: 'down', detail: input.sentry.error });
  } else {
    checks.push({ label: 'Error tracking', status: 'ok', detail: 'Sentry connected' });
  }

  if (!input.traffic.configured) {
    checks.push({ label: 'Analytics', status: 'warn', detail: 'POSTHOG_PERSONAL_API_KEY not set' });
  } else if (input.traffic.error) {
    checks.push({ label: 'Analytics', status: 'down', detail: input.traffic.error });
  } else {
    checks.push({ label: 'Analytics', status: 'ok', detail: 'PostHog connected' });
  }

  checks.push(
    input.pulse.error
      ? { label: 'Database', status: 'down', detail: input.pulse.error }
      : { label: 'Database', status: 'ok', detail: 'Supabase queries healthy' },
  );

  if (!input.money.stripeConfigured) {
    checks.push({ label: 'Billing', status: 'warn', detail: 'STRIPE_SECRET_KEY not set' });
  } else if (input.money.stripeError) {
    checks.push({ label: 'Billing', status: 'down', detail: input.money.stripeError });
  } else {
    checks.push({ label: 'Billing', status: 'ok', detail: 'Stripe API healthy' });
  }

  // Reads the free_tool_leads table specifically, so it fails if that table is
  // missing or unreachable even when the rest of the database is fine — the one
  // failure mode the tools themselves swallow on purpose.
  if (input.freeTools.error) {
    checks.push({ label: 'Free tool leads', status: 'down', detail: input.freeTools.error });
  } else if (input.freeTools.total === 0) {
    checks.push({
      label: 'Free tool leads',
      status: 'warn',
      detail: 'Table reachable, no lead captured yet',
    });
  } else {
    checks.push({
      label: 'Free tool leads',
      status: 'ok',
      detail: `${input.freeTools.total} captured, ${input.freeTools.leads.last24h} in 24h`,
    });
  }

  checks.push(
    isEmailConfigured()
      ? { label: 'Email', status: 'ok', detail: 'Resend configured' }
      : { label: 'Email', status: 'warn', detail: 'RESEND_API_KEY or EMAIL_FROM not set' },
  );

  return checks;
}
