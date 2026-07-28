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

  // --- Free, no-signup CP12 generator -------------------------------------
  // The funnel these four form is the point of the tool: the gap between
  // free_cp12_generated and free_cp12_email_submitted is the drop-off at the
  // email wall, and is the number to watch. Keep them in this order.
  /** Fires on the first edit to the free CP12 form. Once per session. */
  freeCp12FormStarted: 'free_cp12_form_started',
  /** Fires when the free CP12 PDF renders successfully and is previewed. */
  freeCp12Generated: 'free_cp12_generated',
  /** Fires when an email is submitted at the download step. Never carries the address. */
  freeCp12EmailSubmitted: 'free_cp12_email_submitted',
  /** Fires when the PDF has been emailed and saved to the visitor's device. */
  freeCp12DownloadCompleted: 'free_cp12_download_completed',

  // --- Free, no-signup boiler service record generator ---------------------
  // Same four-step funnel as the CP12 tool so the two acquisition surfaces can
  // be compared directly. Watch the generated -> email_submitted gap here too.
  /** Fires on the first edit to the free boiler service form. Once per session. */
  freeBoilerServiceFormStarted: 'free_boiler_service_form_started',
  /** Fires when the record renders successfully and is previewed. */
  freeBoilerServiceGenerated: 'free_boiler_service_generated',
  /** Fires when an email is submitted at the download step. Never carries the address. */
  freeBoilerServiceEmailSubmitted: 'free_boiler_service_email_submitted',
  /** Fires when the record has been emailed and saved to the visitor's device. */
  freeBoilerServiceDownloadCompleted: 'free_boiler_service_download_completed',

  // --- Free gas rate calculator --------------------------------------------
  // Only two events: the calculator produces no document, so it has no email
  // wall and therefore no drop-off to measure. Its job is traffic and trust —
  // judge it on visits and on how many go on to open a document tool.
  /** Fires on the first input to the calculator. Once per session. */
  freeGasRateStarted: 'free_gas_rate_started',
  /** Fires when a calculation is asked for and produces a result. */
  freeGasRateCalculated: 'free_gas_rate_calculated',
  /** Fires when a free tool's cross-link to another free tool is followed. */
  freeToolCrossLinkClicked: 'free_tool_cross_link_clicked',
  /**
   * Fires when the example CP12 is opened before starting the form. Watch these
   * against the matching form_started: if people open the sample and leave, the
   * template is the problem, not the form length.
   */
  freeCp12SampleViewed: 'free_cp12_sample_viewed',
  /** Same, for the boiler service record. */
  freeBoilerServiceSampleViewed: 'free_boiler_service_sample_viewed',
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
