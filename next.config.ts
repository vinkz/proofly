import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  // 'self', not 'none'. The free tools and the wizard preview a generated PDF
  // in an iframe — a blob: URL on the generate step, and the sample document
  // straight from /api. 'none' forbids framing by anybody including us, so both
  // previews rendered blank while the download of the very same bytes worked.
  // Third-party framing stays blocked, which is what this directive is for.
  "frame-ancestors 'self'",
  // Chrome and Edge render a PDF inside an iframe through their built-in viewer,
  // which is plugin content and therefore governed by object-src rather than
  // frame-src. 'none' silently blocks it. Scoped to our own origin and to blob:
  // URLs this page created — never a remote plugin source.
  "object-src 'self' blob:",
  // accounts.google.com is Google Identity Services, which powers the "Continue
  // with Google" button on /login and /signup/step1. Without it the GIS script
  // is blocked, loadGis() rejects, and the button reports "Google sign-in
  // unavailable" — so the whole Google path has been dead in production while
  // looking present. Paths are Google's own documented CSP values, which are
  // narrower than allowing the origin outright.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://accounts.google.com/gsi/client",
  // GIS also fetches its own stylesheet; without this the button renders unstyled.
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://api.stripe.com https://m.stripe.network https://accounts.google.com/gsi/",
  "frame-src 'self' blob: https://js.stripe.com https://hooks.stripe.com https://accounts.google.com/gsi/",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Matches frame-ancestors 'self' above. DENY blocks same-origin framing too,
  // which is what stopped our own pages previewing our own PDFs.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      // Real traffic, landing on a 404. Four people reached `/reequest` against
      // thirteen who reached `/request` — roughly a quarter of that flow — so a
      // link with a typo in it is circulating somewhere we cannot edit.
      { source: '/reequest', destination: '/request', permanent: true },
      // Someone typing the free tools from memory and stopping short.
      { source: '/free', destination: '/free-tools', permanent: true },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://eu-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/array/:path*',
        destination: 'https://eu-assets.i.posthog.com/array/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://eu.i.posthog.com/:path*',
      },
    ];
  },
  // Required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },
});
