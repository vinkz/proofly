import * as Sentry from '@sentry/nextjs';

const sampleRate = Number.parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0.1');
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: Number.isFinite(sampleRate) ? sampleRate : 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
