'use server';

import 'server-only';

import { revalidatePath } from 'next/cache';

import {
  FREE_TIER_MONTHLY_LIMIT,
  STRIPE_MONTHLY_PRICE_ID,
  STRIPE_YEARLY_PRICE_ID,
  stripe,
} from '@/lib/stripe';
import { getSupabaseUser, supabaseServerReadOnly, supabaseServerServiceRole } from '@/lib/supabaseServer';
import {
  asUntyped,
  checkCertificateAllowanceForUserId,
  countUsage,
  getCurrentBillingMonth,
  hasActivePaidSubscription,
  recordCertificateUsageForUserId,
  type BillingProfile,
} from '@/server/billing-internal';

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SHARE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'https://certnow.uk'
  ).replace(/\/$/, '');
}

function normalizeReturnUrl(returnUrl: string) {
  if (returnUrl.startsWith('/')) return `${getSiteUrl()}${returnUrl}`;
  const parsed = new URL(returnUrl);
  return parsed.toString();
}

async function getAuthedBillingContext() {
  const readClient = await supabaseServerReadOnly();
  const user = await getSupabaseUser(readClient);
  if (!user) throw new Error('Unauthorized');
  const supabase = await supabaseServerServiceRole();
  return { user, supabase, db: asUntyped(supabase) };
}

export async function checkCertificateAllowance(requiredCertificates = 1): Promise<{
  allowed: boolean;
  used: number;
  limit: number | null;
  subscriptionStatus: string;
}> {
  const { user, db } = await getAuthedBillingContext();
  return checkCertificateAllowanceForUserId(db, user.id, requiredCertificates);
}

export async function recordCertificateUsage(jobId: string, certificateType: string): Promise<void> {
  const { user, db } = await getAuthedBillingContext();
  await recordCertificateUsageForUserId(db, user.id, jobId, certificateType);
}

export async function getCertificateUsageSummary(): Promise<{
  used: number;
  limit: number | null;
  subscriptionStatus: string;
  subscriptionInterval: string | null;
  periodEnd: string | null;
  billingMonth: string;
}> {
  const { user, db } = await getAuthedBillingContext();
  const { data } = await db
    .from('profiles')
    .select('subscription_status, subscription_interval, subscription_period_end')
    .eq('id', user.id)
    .maybeSingle();
  const profile = (data ?? null) as BillingProfile | null;
  const status = profile?.subscription_status ?? 'free';
  const billingMonth = getCurrentBillingMonth();

  if (hasActivePaidSubscription(profile)) {
    return {
      used: 0,
      limit: null,
      subscriptionStatus: status,
      subscriptionInterval: profile?.subscription_interval ?? null,
      periodEnd: profile?.subscription_period_end ?? null,
      billingMonth,
    };
  }

  return {
    used: await countUsage(db, user.id, billingMonth),
    limit: FREE_TIER_MONTHLY_LIMIT,
    subscriptionStatus: status,
    subscriptionInterval: null,
    periodEnd: null,
    billingMonth,
  };
}

export async function createCheckoutSession(interval: 'month' | 'year', returnUrl: string): Promise<{ url: string }> {
  try {
    const { user, db } = await getAuthedBillingContext();
    const { data } = await db
      .from('profiles')
      .select('stripe_customer_id, full_name')
      .eq('id', user.id)
      .maybeSingle();
    const profile = (data ?? {}) as BillingProfile;
    let customerId = profile.stripe_customer_id ?? '';

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: profile.full_name ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      const { error } = await db
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
      if (error) throw new Error(error.message);
    }

    const priceId = interval === 'year' ? STRIPE_YEARLY_PRICE_ID : STRIPE_MONTHLY_PRICE_ID;
    if (!priceId) throw new Error(`STRIPE_${interval === 'year' ? 'YEARLY' : 'MONTHLY'}_PRICE_ID is not set`);

    const normalizedReturnUrl = normalizeReturnUrl(returnUrl);
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${normalizedReturnUrl}?success=1`,
      cancel_url: `${normalizedReturnUrl}?canceled=1`,
      metadata: { supabase_user_id: user.id },
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
    });

    if (!session.url) throw new Error('No checkout URL returned');
    return { url: session.url };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to create checkout session');
  }
}

export async function createPortalSession(returnUrl: string): Promise<{ url: string }> {
  try {
    const { user, db } = await getAuthedBillingContext();
    const { data } = await db
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();
    const profile = (data ?? {}) as BillingProfile;
    if (!profile.stripe_customer_id) throw new Error('No Stripe customer found');

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: normalizeReturnUrl(returnUrl),
    });

    return { url: session.url };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to create portal session');
  }
}

export async function subscribeMonthlyAction() {
  const { redirect } = await import('next/navigation');
  const session = await createCheckoutSession('month', '/billing');
  revalidatePath('/billing');
  redirect(session.url);
}

export async function subscribeYearlyAction() {
  const { redirect } = await import('next/navigation');
  const session = await createCheckoutSession('year', '/billing');
  revalidatePath('/billing');
  redirect(session.url);
}

export async function manageSubscriptionAction() {
  const { redirect } = await import('next/navigation');
  const session = await createPortalSession('/billing');
  revalidatePath('/billing');
  redirect(session.url);
}
