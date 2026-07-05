import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/blog';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
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
