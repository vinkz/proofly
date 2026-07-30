import { describe, expect, it } from 'vitest';

import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { FREE_CP12_ROUTE } from '@/lib/cp12/free-tool';
import { FREE_TOOLS, FREE_TOOLS_ROUTE, indexableFreeTools, noindexedFreeToolRoutes } from '@/lib/free-tools';

/**
 * robots.txt and the sitemap are generated from the same catalogue, so a tool
 * can never be advertised in one and forbidden in the other — a contradiction
 * search engines report as a crawl error.
 */
const disallowed = () => {
  const rules = robots().rules;
  const rule = Array.isArray(rules) ? rules[0] : rules;
  const list = rule.disallow;
  return Array.isArray(list) ? list : [list].filter(Boolean);
};

const sitemapUrls = () => sitemap().map((entry) => new URL(entry.url).pathname);

describe('free tool discoverability', () => {
  it('every noindexed tool is disallowed in robots.txt', () => {
    for (const route of noindexedFreeToolRoutes()) {
      expect(disallowed()).toContain(route);
    }
  });

  it('no tool is both in the sitemap and disallowed', () => {
    const blocked = new Set(disallowed());
    for (const path of sitemapUrls()) {
      expect(blocked.has(path)).toBe(false);
    }
  });

  it('every indexable tool is in the sitemap', () => {
    const urls = sitemapUrls();
    for (const tool of indexableFreeTools()) {
      expect(urls).toContain(tool.route);
    }
  });

  it('keeps the owner-approved free CP12 route indexable', () => {
    expect(indexableFreeTools().some((tool) => tool.route === FREE_CP12_ROUTE)).toBe(true);
    expect(disallowed()).not.toContain(FREE_CP12_ROUTE);
    expect(sitemapUrls()).toContain(FREE_CP12_ROUTE);
  });

  it('no noindexed tool is in the sitemap', () => {
    const urls = sitemapUrls();
    for (const route of noindexedFreeToolRoutes()) {
      expect(urls).not.toContain(route);
    }
  });

  it('the hub is only listed when at least one tool is public', () => {
    const urls = sitemapUrls();
    expect(urls.includes(FREE_TOOLS_ROUTE)).toBe(indexableFreeTools().length > 0);
  });

  it('only tools that produce a document capture an email', () => {
    // A calculator has no document and no natural capture moment; putting a
    // wall in front of arithmetic would only teach engineers the tools are bait.
    const calculators = FREE_TOOLS.filter((tool) => /calculator/i.test(tool.name));
    expect(calculators.length).toBeGreaterThan(0);
    for (const tool of calculators) {
      expect(tool.capturesEmail).toBe(false);
    }
  });
});
