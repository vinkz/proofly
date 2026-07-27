import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/blog';
import { FREE_CP12_NOINDEX, FREE_CP12_ROUTE } from '@/lib/cp12/free-tool';
import { FREE_BOILER_SERVICE_NOINDEX, FREE_BOILER_SERVICE_ROUTE } from '@/lib/boiler-service/free-tool';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Each mirrors its page's own robots metadata; both read the one flag
          // for their tool, and the two tools flip independently.
          ...(FREE_CP12_NOINDEX ? [FREE_CP12_ROUTE] : []),
          ...(FREE_BOILER_SERVICE_NOINDEX ? [FREE_BOILER_SERVICE_ROUTE] : []),
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
