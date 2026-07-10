import * as Sentry from '@sentry/nextjs';
import posthog from 'posthog-js';

const sampleRate = Number.parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0.1');
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: Number.isFinite(sampleRate) ? sampleRate : 0.1,
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
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
