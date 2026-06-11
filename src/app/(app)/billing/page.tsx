import { getBillingPageData } from '@/server/billing-page';
import { manageSubscriptionAction, subscribeMonthlyAction, subscribeYearlyAction } from '@/server/billing';

type SearchParams = Promise<{ success?: string; canceled?: string }>;

export default async function BillingPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = searchParams ? await searchParams : {};
  const data = await getBillingPageData();

  const status = data.subscriptionStatus;
  const isActive = status === 'active';
  const isPastDue = status === 'past_due';
  const isCanceled = status === 'canceled' || status === 'incomplete_expired';
  const isIncomplete = status === 'incomplete';
  const isFree = !isActive && !isPastDue && !isCanceled && !isIncomplete;

  const showSubscribeOptions = !isActive && !isPastDue;
  const usedPct = Math.min(100, Math.round(((data.usage.used ?? 0) / (data.usage.limit ?? 10)) * 100));

  return (
    <div className="mx-auto w-full max-w-2xl space-y-[12px] px-4 py-6 sm:py-10">
      {/* Page header */}
      <div className="pb-2">
        <h1 className="text-[22px] font-medium leading-tight tracking-[-0.02em] text-[var(--color-text-primary)]">
          Billing
        </h1>
        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
          Manage your CertNow subscription and certificate usage.
        </p>
      </div>

      {/* Status banner */}
      {params.success === '1' && (
        <div className="flex items-center gap-2 rounded-[12px] bg-[var(--color-action-bg)] px-4 py-3">
          <span className="text-[13px] font-medium text-[var(--color-action)]">
            Subscription activated — you now have unlimited certificates.
          </span>
        </div>
      )}
      {params.canceled === '1' && (
        <div className="flex items-center gap-2 rounded-[12px] bg-[var(--color-amber-bg)] px-4 py-3">
          <span className="text-[13px] font-medium text-[var(--color-amber)]">
            Checkout cancelled — no changes were made.
          </span>
        </div>
      )}

      {/* Current plan card */}
      <section className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
        <div className="flex items-center justify-between border-b-[0.5px] border-[var(--color-border-tertiary)] px-4 py-[14px]">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
              Subscription
            </p>
            <h2 className="text-[15px] font-medium text-[var(--color-text-primary)]">Current plan</h2>
          </div>

          {isActive && (
            <span className="rounded-full bg-[var(--color-action-bg)] px-3 py-1 text-[11px] font-medium text-[var(--color-action)]">
              Active
            </span>
          )}
          {isPastDue && (
            <span className="rounded-full bg-[var(--color-red-bg)] px-3 py-1 text-[11px] font-medium text-[var(--color-red)]">
              Payment failed
            </span>
          )}
          {isCanceled && (
            <span className="rounded-full bg-[var(--color-border-secondary)] px-3 py-1 text-[11px] font-medium text-[var(--color-text-tertiary)]">
              Canceled
            </span>
          )}
          {isIncomplete && (
            <span className="rounded-full bg-[var(--color-amber-bg)] px-3 py-1 text-[11px] font-medium text-[var(--color-amber)]">
              Incomplete
            </span>
          )}
          {isFree && (
            <span className="rounded-full bg-[var(--color-amber-bg)] px-3 py-1 text-[11px] font-medium text-[var(--color-amber)]">
              Free plan
            </span>
          )}
        </div>

        <div className="flex flex-col gap-[14px] p-4">
          {isActive && (
            <>
              <div className="space-y-[4px]">
                <p className="text-[14px] font-medium text-[var(--color-text-primary)]">
                  Unlimited certificates
                  {data.subscriptionInterval === 'year' ? ' · Annual' : data.subscriptionInterval === 'month' ? ' · Monthly' : ''}
                </p>
                {data.periodEnd && (
                  <p className="text-[12px] text-[var(--color-text-secondary)]">
                    Renews {data.periodEnd}
                  </p>
                )}
              </div>
              <form action={manageSubscriptionAction}>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] bg-transparent px-[14px] py-[6px] text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-background-tertiary)]"
                >
                  Manage subscription
                </button>
              </form>
            </>
          )}

          {isPastDue && (
            <>
              <div className="space-y-[4px]">
                <p className="text-[14px] font-medium text-[var(--color-red)]">
                  Your last payment failed.
                </p>
                <p className="text-[12px] text-[var(--color-text-secondary)]">
                  Update your payment method to continue issuing certificates.
                </p>
              </div>
              <form action={manageSubscriptionAction}>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-[var(--color-red-bg)] px-[14px] py-[6px] text-[12px] font-medium text-[var(--color-red)] transition-colors hover:brightness-95"
                >
                  Update payment method
                </button>
              </form>
            </>
          )}

          {!isActive && !isPastDue && (
            <>
              <div className="space-y-[6px]">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] text-[var(--color-text-secondary)]">
                    {data.usage.used} of {data.usage.limit} certificates used in {data.usage.month}
                  </p>
                  <span className="text-[12px] font-medium text-[var(--color-text-tertiary)]">
                    {usedPct}%
                  </span>
                </div>
                <div className="h-[5px] overflow-hidden rounded-full bg-[var(--color-background-tertiary)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-action)] transition-all"
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                {isCanceled && (
                  <p className="text-[12px] text-[var(--color-text-tertiary)]">
                    Your subscription was canceled. You can resubscribe below.
                  </p>
                )}
                {isIncomplete && (
                  <p className="text-[12px] text-[var(--color-text-tertiary)]">
                    Your checkout was not completed. Please try subscribing again.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Pricing plans */}
      {showSubscribeOptions && (
        <section className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
          <div className="border-b-[0.5px] border-[var(--color-border-tertiary)] px-4 py-[14px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
              Plans
            </p>
            <h2 className="text-[15px] font-medium text-[var(--color-text-primary)]">
              Choose a plan
            </h2>
          </div>

          <div className="flex flex-col gap-[10px] p-4 sm:flex-row">
            {/* Monthly plan */}
            <div className="flex flex-1 flex-col gap-[10px] rounded-[12px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
              <div>
                <p className="text-[12px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
                  Monthly
                </p>
                <p className="mt-1 text-[22px] font-semibold leading-none tracking-tight text-[var(--color-text-primary)]">
                  {data.prices.monthly.amount}
                  <span className="text-[13px] font-normal text-[var(--color-text-secondary)]">
                    /{data.prices.monthly.interval}
                  </span>
                </p>
              </div>
              <p className="text-[12px] text-[var(--color-text-secondary)]">
                Unlimited certificates. Cancel anytime.
              </p>
              <form action={subscribeMonthlyAction} className="mt-auto pt-1">
                <button
                  type="submit"
                  className="flex w-full items-center justify-center rounded-full bg-[var(--color-text-primary)] px-[16px] py-[8px] text-[13px] font-medium text-[var(--color-text-inverse)] transition-colors hover:opacity-90"
                >
                  Subscribe monthly
                </button>
              </form>
            </div>

            {/* Yearly plan */}
            <div className="flex flex-1 flex-col gap-[10px] rounded-[12px] border-[0.5px] border-[var(--color-action)] bg-[var(--color-action-bg)] p-4">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-medium uppercase tracking-[0.5px] text-[var(--color-action)]">
                    Annual
                  </p>
                  <span className="rounded-full bg-[var(--color-action)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-action-fg)]">
                    Best value
                  </span>
                </div>
                <p className="mt-1 text-[22px] font-semibold leading-none tracking-tight text-[var(--color-text-primary)]">
                  {data.prices.yearly.amount}
                  <span className="text-[13px] font-normal text-[var(--color-text-secondary)]">
                    /{data.prices.yearly.interval}
                  </span>
                </p>
              </div>
              <p className="text-[12px] font-medium text-[var(--color-action)]">
                {data.prices.yearly.saving}
              </p>
              <form action={subscribeYearlyAction} className="mt-auto pt-1">
                <button
                  type="submit"
                  className="flex w-full items-center justify-center rounded-full bg-[var(--color-action)] px-[16px] py-[8px] text-[13px] font-medium text-[var(--color-action-fg)] transition-colors hover:brightness-95"
                >
                  Subscribe annually
                </button>
              </form>
            </div>
          </div>

          <div className="px-4 pb-4">
            <p className="text-center text-[11px] text-[var(--color-text-tertiary)]">
              Payments processed securely by Stripe. Cancel anytime from your customer portal.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
