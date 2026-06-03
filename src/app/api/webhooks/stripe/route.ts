import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

import { stripe } from '@/lib/stripe';
import { supabaseServerServiceRole } from '@/lib/supabaseServer';

type UntypedQuery = {
  update: (payload: Record<string, unknown>) => UntypedQuery;
  eq: (column: string, value: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
};
type UntypedSupabase = { from: (table: string) => UntypedQuery };

function mapSubscriptionStatus(status: Stripe.Subscription.Status) {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'past_due') return 'past_due';
  if (status === 'canceled' || status === 'unpaid') return 'canceled';
  return 'incomplete';
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const currentPeriodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;
  if (typeof currentPeriodEnd === 'number') return new Date(currentPeriodEnd * 1000).toISOString();
  return null;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error('[Stripe webhook] signature verification failed:', error);
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  const supabase = (await supabaseServerServiceRole()) as unknown as UntypedSupabase;

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = String(subscription.customer);
        const interval = subscription.items.data[0]?.price.recurring?.interval ?? null;
        const periodEnd = getSubscriptionPeriodEnd(subscription);

        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_status: mapSubscriptionStatus(subscription.status),
            subscription_interval: interval === 'year' ? 'year' : 'month',
            subscription_period_end: periodEnd,
            stripe_subscription_id: subscription.id,
          })
          .eq('stripe_customer_id', customerId);
        if (error) throw new Error(error.message);

        console.log('[Stripe webhook] subscription updated:', customerId, subscription.status);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = String(subscription.customer);
        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_status: 'canceled',
            subscription_interval: null,
            subscription_period_end: null,
            stripe_subscription_id: null,
          })
          .eq('stripe_customer_id', customerId);
        if (error) throw new Error(error.message);

        console.log('[Stripe webhook] subscription deleted:', customerId);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = String(invoice.customer);
        const { error } = await supabase
          .from('profiles')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_customer_id', customerId);
        if (error) throw new Error(error.message);

        console.log('[Stripe webhook] payment failed:', customerId);
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error('[Stripe webhook] handler error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
