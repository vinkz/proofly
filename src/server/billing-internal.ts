import 'server-only';

import { FREE_TIER_MONTHLY_LIMIT } from '@/lib/stripe';
import { supabaseServerServiceRole } from '@/lib/supabaseServer';

/**
 * Internal certificate-usage helpers shared between the billing server actions
 * (src/server/billing.ts) and certificate issuance (src/server/certificates.ts).
 *
 * These live outside any `'use server'` module on purpose: the userId-taking
 * variants (checkCertificateAllowanceForUser / recordCertificateUsageForUser)
 * must NOT be registered as callable Server Actions, or a caller could inflate
 * another user's usage counter or probe their subscription status. Callers that
 * need an auth-checked entry point use the wrappers in src/server/billing.ts.
 */

export type BillingProfile = {
  stripe_customer_id?: string | null;
  subscription_status?: string | null;
  subscription_interval?: string | null;
  subscription_period_end?: string | null;
  full_name?: string | null;
};

export type UntypedQuery = {
  select: (columns?: string, options?: { count?: 'exact'; head?: boolean }) => UntypedQuery;
  insert: (payload: Record<string, unknown>) => UntypedQuery;
  update: (payload: Record<string, unknown>) => UntypedQuery;
  eq: (column: string, value: unknown) => UntypedQuery;
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null; count?: number | null }>;
  single: () => Promise<{ data: unknown; error: { message: string } | null; count?: number | null }>;
  then: Promise<{ data: unknown; error: { message: string } | null; count?: number | null }>['then'];
};
export type UntypedSupabase = { from: (table: string) => UntypedQuery };

export const asUntyped = (value: unknown) => value as UntypedSupabase;

export function getCurrentBillingMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function hasActivePaidSubscription(profile: BillingProfile | null | undefined) {
  if (profile?.subscription_status !== 'active') return false;
  const periodEnd = profile.subscription_period_end;
  return !periodEnd || new Date(periodEnd) > new Date();
}

export async function countUsage(
  db: UntypedSupabase,
  userId: string,
  billingMonth = getCurrentBillingMonth(),
) {
  const { count } = await db
    .from('certificate_usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('billing_month', billingMonth);
  return count ?? 0;
}

export async function checkCertificateAllowanceForUserId(
  db: UntypedSupabase,
  userId: string,
  requiredCertificates = 1,
): Promise<{
  allowed: boolean;
  used: number;
  limit: number | null;
  subscriptionStatus: string;
}> {
  const { data } = await db
    .from('profiles')
    .select('subscription_status, subscription_period_end')
    .eq('id', userId)
    .maybeSingle();
  const profile = (data ?? null) as BillingProfile | null;
  const status = profile?.subscription_status ?? 'free';

  if (hasActivePaidSubscription(profile)) {
    return { allowed: true, used: 0, limit: null, subscriptionStatus: status };
  }

  const used = await countUsage(db, userId);
  return {
    allowed: used + requiredCertificates <= FREE_TIER_MONTHLY_LIMIT,
    used,
    limit: FREE_TIER_MONTHLY_LIMIT,
    subscriptionStatus: status,
  };
}

export async function recordCertificateUsageForUserId(
  db: UntypedSupabase,
  userId: string,
  jobId: string,
  certificateType: string,
): Promise<void> {
  const billingMonth = getCurrentBillingMonth();
  const { data: existing } = await db
    .from('certificate_usage')
    .select('id')
    .eq('user_id', userId)
    .eq('job_id', jobId)
    .eq('certificate_type', certificateType)
    .maybeSingle();

  if (existing) return;

  const { error } = await db.from('certificate_usage').insert({
    user_id: userId,
    job_id: jobId,
    certificate_type: certificateType,
    billing_month: billingMonth,
  });
  if (error) throw new Error(error.message);
}

/**
 * Trusted-server-context helpers. The caller has already established which user
 * the work belongs to (e.g. the owner of a job resolved server-side). These are
 * deliberately not exported from a `'use server'` module — see the file header.
 */
export async function checkCertificateAllowanceForUser(userId: string, requiredCertificates = 1) {
  const supabase = await supabaseServerServiceRole();
  return checkCertificateAllowanceForUserId(asUntyped(supabase), userId, requiredCertificates);
}

export async function recordCertificateUsageForUser(
  userId: string,
  jobId: string,
  certificateType: string,
): Promise<void> {
  const supabase = await supabaseServerServiceRole();
  await recordCertificateUsageForUserId(asUntyped(supabase), userId, jobId, certificateType);
}
