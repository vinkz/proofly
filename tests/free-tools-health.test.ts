import { describe, expect, it } from 'vitest';

import {
  getHealthChecks,
  type BusinessPulse,
  type FreeToolsPulse,
  type MoneyPanel,
  type SentryPanel,
  type TrafficPanel,
} from '@/server/mission-control';

/**
 * Lead capture fails silently on purpose — the visitor still gets their
 * certificate — so the only way a broken funnel surfaces is this health check
 * and the Sentry report in recordLead. Both need to actually fire.
 */
// Minimal healthy stand-ins for the other panels: this file is only about the
// free-tool check, and the rest must not influence it.
const OTHERS: {
  sentry: SentryPanel;
  pulse: BusinessPulse;
  money: MoneyPanel;
  traffic: TrafficPanel;
} = {
  sentry: { configured: false },
  pulse: {
    signups: { last24h: 0, last7d: 0 },
    jobs: { last24h: 0, last7d: 0 },
    certificates: { last24h: 0, last7d: 0 },
    pendingRequests: 0,
    trialsEndingSoon: [],
    recentSignups: [],
    error: null,
  },
  money: {
    activeSubs: 0,
    pastDue: 0,
    mrrPence: null,
    failedPayments7d: 0,
    stripeConfigured: false,
    stripeError: null,
    dbError: null,
  },
  traffic: { configured: false },
};

const freeTools = (over: Partial<FreeToolsPulse>): FreeToolsPulse => ({
  leads: { last24h: 0, last7d: 0 },
  bySource: [],
  lastLeadAt: null,
  total: 0,
  error: null,
  ...over,
});

const check = (over: Partial<FreeToolsPulse>) =>
  getHealthChecks({ ...OTHERS, freeTools: freeTools(over) }).find((c) => c.label === 'Free tool leads');

describe('free tool lead health check', () => {
  it('reports down when the leads table is unreachable', () => {
    const result = check({ error: 'relation "free_tool_leads" does not exist' });
    expect(result?.status).toBe('down');
    expect(result?.detail).toContain('free_tool_leads');
  });

  it('warns while nothing has ever been captured', () => {
    // The expected state before launch — distinguishable from a real failure.
    const result = check({});
    expect(result?.status).toBe('warn');
    expect(result?.detail).toMatch(/no lead captured yet/i);
  });

  it('reports ok once leads are landing, with the 24h count', () => {
    const result = check({ total: 42, leads: { last24h: 7, last7d: 30 } });
    expect(result?.status).toBe('ok');
    expect(result?.detail).toContain('42');
    expect(result?.detail).toContain('7');
  });

  it('is present in the check list regardless of state', () => {
    const labels = getHealthChecks({ ...OTHERS, freeTools: freeTools({}) }).map((c) => c.label);
    expect(labels).toContain('Free tool leads');
  });
});
