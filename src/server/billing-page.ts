'use server';

import 'server-only';

import { FREE_TIER_MONTHLY_LIMIT } from '@/lib/stripe';
import { getSupabaseUser, supabaseServerReadOnly, supabaseServerServiceRole } from '@/lib/supabaseServer';

type UntypedQuery = {
  select: (columns?: string, options?: { count?: 'exact'; head?: boolean }) => UntypedQuery;
  eq: (column: string, value: unknown) => UntypedQuery;
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null; count?: number | null }>;
  then: Promise<{ data: unknown; error: { message: string } | null; count?: number | null }>['then'];
};
type UntypedSupabase = { from: (table: string) => UntypedQuery };

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const getCurrentBillingMonth = () => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
};

export async function getBillingPageData() {
  const readClient = await supabaseServerReadOnly();
  const user = await getSupabaseUser(readClient);
  if (!user) throw new Error('Unauthorized');

  const supabase = (await supabaseServerServiceRole()) as unknown as UntypedSupabase;
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, subscription_interval, subscription_period_end, stripe_customer_id, full_name')
    .eq('id', user.id)
    .maybeSingle();
  const row = (profile ?? {}) as {
    subscription_status?: string | null;
    subscription_interval?: string | null;
    subscription_period_end?: string | null;
    stripe_customer_id?: string | null;
    full_name?: string | null;
  };

  const billingMonth = getCurrentBillingMonth();
  const { count } = await supabase
    .from('certificate_usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('billing_month', billingMonth);

  const monthName = new Date().toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  return {
    subscriptionStatus: row.subscription_status ?? 'free',
    subscriptionInterval: row.subscription_interval ?? null,
    periodEnd: row.subscription_period_end ? formatDate(row.subscription_period_end) : null,
    hasStripeCustomer: Boolean(row.stripe_customer_id),
    usage: {
      used: count ?? 0,
      limit: FREE_TIER_MONTHLY_LIMIT,
      month: monthName,
    },
    prices: {
      monthly: { amount: '£8.99', interval: 'month' },
      yearly: {
        amount: '£79',
        interval: 'year',
        saving: 'Save £28.88 vs monthly',
      },
    },
  };
}
