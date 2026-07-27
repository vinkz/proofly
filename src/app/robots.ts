import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/blog';
import { FREE_TOOLS_HUB_NOINDEX, FREE_TOOLS_ROUTE, noindexedFreeToolRoutes } from '@/lib/free-tools';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Driven by each tool's own noindex flag via the shared catalogue, so
          // robots.txt cannot drift from the page's own robots metadata.
          ...noindexedFreeToolRoutes(),
          ...(FREE_TOOLS_HUB_NOINDEX ? [FREE_TOOLS_ROUTE] : []),
          '/api/',
          '/dashboard',
          '/jobs',
          '/clients',
          '/documents',
          '/invoices',
          '/requests',
          '/settings',
          '/onboarding',
          '/wizard',
          '/billing',
          '/prefill',
          '/preview',
          '/sign',
          '/j/',
          '/p/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
