import 'server-only';

import Stripe from 'stripe';

export const STRIPE_MONTHLY_PRICE_ID = process.env.STRIPE_MONTHLY_PRICE_ID ?? '';
export const STRIPE_YEARLY_PRICE_ID = process.env.STRIPE_YEARLY_PRICE_ID ?? '';

// Defined in @/lib/plan so client components and email copy can import it too;
// re-exported here so server-side billing callers keep their existing import.
export { FREE_TIER_MONTHLY_LIMIT } from '@/lib/plan';

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not set');

  stripeClient ??= new Stripe(secretKey, {
    apiVersion: '2026-05-27.dahlia',
    typescript: true,
  });

  return stripeClient;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripe(), prop, receiver);
  },
});
