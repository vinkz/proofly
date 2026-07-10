import { redirect } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

import { getSupabaseUser, supabaseServerReadOnly } from '@/lib/supabaseServer';
import {
  getBusinessPulse,
  getHealthChecks,
  getMoney,
  getSentryIssues,
  getTraffic,
  isAdminEmail,
  type HealthCheck,
  type PulseStat,
  type SentryPanel,
  type TrafficPanel,
} from '@/server/mission-control';
import { Card, CardContent } from '@/components/ui/card';
import { AutoRefresh } from './_components/auto-refresh';

export const dynamic = 'force-dynamic';

const timeAgo = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : formatDistanceToNow(date, { addSuffix: true });
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[1.5px] text-[var(--color-text-eyebrow)]">
      {children}
    </p>
  );
}

function StatTile({ label, stat }: { label: string; stat: PulseStat }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-[24px] font-medium leading-none text-[var(--color-text-primary)]">
          {stat.last24h}
        </p>
        <p className="mt-1.5 text-[13px] text-[var(--color-text-secondary)]">{label}</p>
        <p className="text-[12px] text-[var(--color-text-tertiary)]">{stat.last7d} in 7 days</p>
      </CardContent>
    </Card>
  );
}

function ErrorsPanel({ sentry }: { sentry: SentryPanel }) {
  if (!sentry.configured) {
    return (
      <Card>
        <CardContent className="pt-4">
          <p className="text-[15px] font-medium text-[var(--color-text-primary)]">
            Error tracking is not connected yet
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
            <li>
              Create a free account at sentry.io and add a project (platform: Next.js, name:
              certnow).
            </li>
            <li>Copy the DSN shown during setup.</li>
            <li>
              In Sentry, create a user auth token (Settings → Auth Tokens) with
              project:read and event:read scopes.
            </li>
            <li>
              In Vercel, add env vars: NEXT_PUBLIC_SENTRY_DSN and SENTRY_DSN (the DSN),
              SENTRY_ORG (org slug), SENTRY_PROJECT (project slug), SENTRY_AUTH_TOKEN (the
              token).
            </li>
            <li>Redeploy — errors then stream into this panel automatically.</li>
          </ol>
        </CardContent>
      </Card>
    );
  }

  if (sentry.error !== null) {
    return (
      <Card>
        <CardContent className="pt-4">
          <p className="text-[13px] text-[var(--color-red)]">
            Could not load errors from Sentry: {sentry.error}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (sentry.issues.length === 0) {
    return (
      <Card>
        <CardContent className="pt-4">
          <p className="text-[13px] text-[var(--color-text-secondary)]">
            No unresolved errors in the last 24 hours.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <ul className="divide-y-[0.5px] divide-[var(--color-border-tertiary)]">
        {sentry.issues.map((issue) => (
          <li key={issue.id}>
            <a href={issue.permalink} target="_blank" rel="noreferrer" className="block px-[18px] py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--color-text-primary)]">
                  {issue.title}
                </p>
                <span className="shrink-0 rounded-full bg-[var(--color-red-bg)] px-2.5 py-1 text-[11px] font-medium leading-none text-[var(--color-red)]">
                  ×{issue.count}
                </span>
              </div>
              {issue.culprit ? (
                <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-tertiary)]">
                  {issue.culprit}
                </p>
              ) : null}
              <p className="mt-0.5 text-[12px] text-[var(--color-text-tertiary)]">
                {issue.userCount} user{issue.userCount === 1 ? '' : 's'} affected · last seen{' '}
                {timeAgo(issue.lastSeen)}
              </p>
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TrafficPanel({ traffic }: { traffic: TrafficPanel }) {
  if (!traffic.configured) {
    return (
      <Card>
        <CardContent className="pt-4">
          <p className="text-[15px] font-medium text-[var(--color-text-primary)]">
            Traffic analytics is not connected yet
          </p>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Event capture is already live — this panel just needs a read-only key to pull the
            numbers back in.
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
            <li>
              In PostHog: Settings → Personal API keys → Create key, with the{' '}
              <span className="font-medium">Query Read</span> scope.
            </li>
            <li>
              In Vercel, add env var POSTHOG_PERSONAL_API_KEY (the key). Optional:
              POSTHOG_PROJECT_ID (defaults to 220662) and POSTHOG_API_HOST (defaults to
              https://eu.posthog.com).
            </li>
            <li>Redeploy — traffic then loads into this panel automatically.</li>
          </ol>
        </CardContent>
      </Card>
    );
  }

  if (traffic.error !== null) {
    return (
      <Card>
        <CardContent className="pt-4">
          <p className="text-[13px] text-[var(--color-red)]">
            Could not load traffic from PostHog: {traffic.error}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <StatTile label="Pageviews" stat={traffic.stats.pageviews} />
        <StatTile label="Unique visitors" stat={traffic.stats.visitors} />
        <StatTile label="Signups completed" stat={traffic.stats.signups} />
        <StatTile label="Jobs created" stat={traffic.stats.jobs} />
      </div>
      <a
        href={traffic.dashboardUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-block text-[12px] font-medium text-[var(--color-action)]"
      >
        Open funnel dashboard in PostHog →
      </a>
    </>
  );
}

const HEALTH_TONES: Record<HealthCheck['status'], { pill: string; label: string }> = {
  ok: { pill: 'bg-[var(--color-action-bg)] text-[var(--color-action)]', label: 'OK' },
  warn: { pill: 'bg-[var(--color-amber-bg)] text-[var(--color-amber)]', label: 'Setup' },
  down: { pill: 'bg-[var(--color-red-bg)] text-[var(--color-red)]', label: 'Down' },
};

export default async function AdminMissionControlPage() {
  const supabase = await supabaseServerReadOnly();
  const user = await getSupabaseUser(supabase);
  if (!user) redirect('/login');
  if (!isAdminEmail(user.email)) redirect('/dashboard');

  const [sentry, pulse, money, traffic] = await Promise.all([
    getSentryIssues(),
    getBusinessPulse(),
    getMoney(),
    getTraffic(),
  ]);
  const health = getHealthChecks({ sentry, pulse, money, traffic });
  const mrr = money.mrrPence === null ? null : (money.mrrPence / 100).toFixed(2);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-12 pt-2">
      <AutoRefresh />

      <header className="pt-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
          Mission control
        </p>
        <h1 className="text-[18px] font-medium text-[var(--color-text-primary)]">CertNow live view</h1>
        <p className="text-[12px] text-[var(--color-text-tertiary)]">
          Auto-refreshes every minute · updated{' '}
          {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </header>

      <section className="space-y-2.5">
        <SectionLabel>Errors · last 24h</SectionLabel>
        <ErrorsPanel sentry={sentry} />
      </section>

      <section className="space-y-2.5">
        <SectionLabel>Traffic · 24h / 7d</SectionLabel>
        <TrafficPanel traffic={traffic} />
      </section>

      <section className="space-y-2.5">
        <SectionLabel>Pulse · last 24h</SectionLabel>
        {pulse.error ? (
          <Card>
            <CardContent className="pt-4">
              <p className="text-[13px] text-[var(--color-red)]">Database error: {pulse.error}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <StatTile label="New signups" stat={pulse.signups} />
            <StatTile label="Jobs created" stat={pulse.jobs} />
            <StatTile label="Certificates issued" stat={pulse.certificates} />
            <Card>
              <CardContent className="pt-4">
                <p className="text-[24px] font-medium leading-none text-[var(--color-text-primary)]">
                  {pulse.pendingRequests}
                </p>
                <p className="mt-1.5 text-[13px] text-[var(--color-text-secondary)]">
                  Pending requests
                </p>
                <p className="text-[12px] text-[var(--color-text-tertiary)]">awaiting engineers</p>
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      <section className="space-y-2.5">
        <SectionLabel>Money</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5">
          <Card>
            <CardContent className="pt-4">
              <p className="text-[24px] font-medium leading-none text-[var(--color-text-primary)]">
                {mrr === null ? '—' : `£${mrr}`}
              </p>
              <p className="mt-1.5 text-[13px] text-[var(--color-text-secondary)]">MRR</p>
              <p className="text-[12px] text-[var(--color-text-tertiary)]">
                {money.stripeConfigured ? 'live from Stripe' : 'connect Stripe key'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-[24px] font-medium leading-none text-[var(--color-text-primary)]">
                {money.activeSubs}
              </p>
              <p className="mt-1.5 text-[13px] text-[var(--color-text-secondary)]">Active subs</p>
              <p className="text-[12px] text-[var(--color-text-tertiary)]">
                {money.pastDue} past due
                {money.failedPayments7d !== null ? ` · ${money.failedPayments7d} failed (7d)` : ''}
              </p>
            </CardContent>
          </Card>
        </div>
        {money.stripeError ? (
          <p className="text-[12px] text-[var(--color-red)]">Stripe: {money.stripeError}</p>
        ) : null}
        {money.dbError ? (
          <p className="text-[12px] text-[var(--color-red)]">Database: {money.dbError}</p>
        ) : null}
      </section>

      <section className="space-y-2.5">
        <SectionLabel>Watchlist</SectionLabel>
        <Card>
          <CardContent className="pt-4">
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
              Trials ending within 3 days
            </p>
            {pulse.trialsEndingSoon.length === 0 ? (
              <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">None right now.</p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {pulse.trialsEndingSoon.map((trial, index) => (
                  <li key={index} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="truncate text-[var(--color-text-primary)]">{trial.name}</span>
                    <span className="shrink-0 text-[var(--color-amber)]">
                      ends {timeAgo(trial.trialEndsAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Latest signups</p>
            {pulse.recentSignups.length === 0 ? (
              <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">No signups yet.</p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {pulse.recentSignups.map((signup, index) => (
                  <li key={index} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="truncate text-[var(--color-text-primary)]">{signup.name}</span>
                    <span className="shrink-0 text-[var(--color-text-tertiary)]">
                      {timeAgo(signup.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-2.5">
        <SectionLabel>System</SectionLabel>
        <Card>
          <ul className="divide-y-[0.5px] divide-[var(--color-border-tertiary)]">
            {health.map((check) => (
              <li key={check.label} className="flex items-center justify-between gap-3 px-[18px] py-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-[var(--color-text-primary)]">
                    {check.label}
                  </p>
                  <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">
                    {check.detail}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none ${HEALTH_TONES[check.status].pill}`}
                >
                  {HEALTH_TONES[check.status].label}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
