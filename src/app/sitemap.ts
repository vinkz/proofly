import type { MetadataRoute } from 'next';

import { getAllPosts, SITE_URL } from '@/lib/blog';
import { FREE_TOOLS_HUB_NOINDEX, FREE_TOOLS_ROUTE, indexableFreeTools } from '@/lib/free-tools';

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();
  const newestPost = posts[0]?.date;

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/request`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: newestPost,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];

  const postPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: post.date,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  // Only tools whose own noindex flag is off. A page cannot be in the sitemap
  // and disallowed in robots.txt at the same time — that is a crawl error, and
  // driving both from the same catalogue makes it impossible.
  const toolPages: MetadataRoute.Sitemap = [
    ...(FREE_TOOLS_HUB_NOINDEX
      ? []
      : [{ url: `${SITE_URL}${FREE_TOOLS_ROUTE}`, changeFrequency: 'monthly' as const, priority: 0.9 }]),
    ...indexableFreeTools().map((tool) => ({
      url: `${SITE_URL}${tool.route}`,
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    })),
  ];

  return [...staticPages, ...toolPages, ...postPages];
}
