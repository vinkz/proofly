import * as Sentry from '@sentry/nextjs';
import posthog from 'posthog-js';

const sampleRate = Number.parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0.1');
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Benign browser noise, not real faults — they carry no stack and are not
// actionable. "ResizeObserver loop..." fires when the browser defers resize
// notifications to the next frame (commonly from third-party widgets like Google
// Identity Services, whose internal ResizeObserver we can't change). Dropping
// them keeps Sentry/PostHog error tracking signal-to-noise high.
const BENIGN_ERROR_PATTERNS = [
  'ResizeObserver loop completed with undelivered notifications',
  'ResizeObserver loop limit exceeded',
];

const isBenignBrowserError = (message: unknown): boolean =>
  typeof message === 'string' && BENIGN_ERROR_PATTERNS.some((pattern) => message.includes(pattern));

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: Number.isFinite(sampleRate) ? sampleRate : 0.1,
  ignoreErrors: BENIGN_ERROR_PATTERNS,
});

// PostHog — client-side analytics. Absent key is a clean no-op (local dev /
// previews without a key are unaffected). Initialised here because Next.js
// only loads instrumentation-client from src/ in a src/-directory project.
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: '/ingest',
    ui_host: 'https://eu.posthog.com',
    defaults: '2026-01-30',
    persistence: 'memory',
    capture_pageview: false,
    capture_pageleave: true,
    capture_exceptions: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '*',
    },
    respect_dnt: true,
    autocapture: true,
    debug: process.env.NODE_ENV === 'development',
    before_send: (event) => {
      // Drop benign browser-noise exceptions (see BENIGN_ERROR_PATTERNS) so they
      // don't show up as errors in PostHog error tracking.
      if (event && event.event === '$exception') {
        const properties = event.properties ?? {};
        const exceptionList = properties.$exception_list as Array<{ value?: unknown }> | undefined;
        const messages = [
          properties.$exception_message,
          ...(Array.isArray(exceptionList) ? exceptionList.map((entry) => entry?.value) : []),
        ];
        if (messages.some(isBenignBrowserError)) return null;
      }
      return event;
    },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
