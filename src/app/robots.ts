import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/blog';
import { FREE_CP12_NOINDEX, FREE_CP12_ROUTE } from '@/lib/cp12/free-tool';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Mirrors the page's own robots metadata; both read the one flag.
          ...(FREE_CP12_NOINDEX ? [FREE_CP12_ROUTE] : []),
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
