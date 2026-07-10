/**
 * Analytics event contract for CertNow.
 *
 * These names are the source of truth for the marketing/conversion funnel in
 * PostHog. Changing a string here silently breaks the funnel and any saved
 * insights built on it — see ANALYTICS.md before touching them.
 *
 * IMPORTANT (GDPR): never put PII in event properties. No names, emails,
 * phone numbers, addresses, or landlord/tenant details. Categories and counts
 * only. PostHog runs cookieless (memory persistence) and masks all inputs in
 * session replay; keep events consistent with that posture.
 */
import posthog from 'posthog-js';

export const ANALYTICS_EVENTS = {
  /** Fires when a visitor reaches the first signup screen. */
  signupStarted: 'signup_started',
  /** Fires when an account is successfully created (email or Google). */
  signupCompleted: 'signup_completed',
  /** Fires when a user creates a job. The funnel uses the first occurrence. */
  jobCreated: 'job_created',
  /** Fires when a job certificate or report PDF is generated. */
  reportGenerated: 'report_generated',
  /** Fires when a shareable certificate link is created. */
  certificateShared: 'certificate_shared',
  /** Fires when an invoice PDF is generated. */
  invoicePdfGenerated: 'invoice_pdf_generated',
  /** Fires when an engineer successfully signs in with email/password or magic link. */
  userLoggedIn: 'user_logged_in',
  /** Fires when an engineer finishes the onboarding profile wizard. */
  onboardingCompleted: 'onboarding_completed',
  /** Fires when a certificate email is successfully sent to landlord/tenant. */
  certificateSent: 'certificate_sent',
  /** Fires when an engineer creates a new invoice for a job. */
  invoiceCreated: 'invoice_created',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/** Only non-PII, low-cardinality properties are allowed. */
type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

/**
 * Capture an event. No-ops safely when PostHog has not been initialised
 * (missing key, SSR, or ad-blocked), so callers never need to guard.
 */
export function track(event: AnalyticsEvent, properties?: AnalyticsProps): void {
  try {
    if (typeof window === 'undefined') return;
    if (!posthog.__loaded) return;
    posthog.capture(event, properties);
  } catch {
    // Analytics must never break a user flow.
  }
}
