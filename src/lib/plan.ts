/**
 * Plan limits shared between enforcement and copy.
 *
 * This deliberately lives outside `@/lib/stripe`, which is `server-only`:
 * marketing pages, the signup screen and the welcome email all need to state
 * the allowance, and a number they cannot import is a number that gets retyped.
 * Retyped numbers drift — the welcome email promised a 14-day trial for weeks
 * after the free monthly allowance replaced it.
 *
 * Anything that quotes the allowance to a user should import it from here.
 */

/** Certificates an unsubscribed account can issue per calendar month. */
export const FREE_TIER_MONTHLY_LIMIT = 10;
