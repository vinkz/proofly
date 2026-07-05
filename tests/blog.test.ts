import { describe, expect, it } from 'vitest';

import {
  estimateReadMinutes,
  extractHeadings,
  getAllPosts,
  getPostBySlug,
  slugifyHeading,
} from '@/lib/blog';

describe('slugifyHeading', () => {
  it('produces GitHub-style anchors', () => {
    expect(slugifyHeading('What a CP12 actually is')).toBe('what-a-cp12-actually-is');
    expect(slugifyHeading('The MOT-style rule')).toBe('the-mot-style-rule');
    expect(slugifyHeading("What's checked? (And why)")).toBe('whats-checked-and-why');
  });
});

describe('extractHeadings', () => {
  it('collects h2s only, in order', () => {
    const content = '# Title\n\n## First section\n\nText\n\n### Sub\n\n## Second section\n';
    expect(extractHeadings(content)).toEqual([
      { id: 'first-section', text: 'First section' },
      { id: 'second-section', text: 'Second section' },
    ]);
  });

  it('ignores headings inside code fences', () => {
    const content = '## Real\n\n```md\n## Not a heading\n```\n\n## Also real\n';
    expect(extractHeadings(content).map((h) => h.text)).toEqual(['Real', 'Also real']);
  });
});

describe('estimateReadMinutes', () => {
  it('is at least one minute for short content', () => {
    expect(estimateReadMinutes('A few words only.')).toBe(1);
  });

  it('scales with word count', () => {
    expect(estimateReadMinutes(Array(660).fill('word').join(' '))).toBe(3);
  });
});

describe('content/blog posts', () => {
  it('parses every post with valid frontmatter, sorted newest first', () => {
    const posts = getAllPosts();
    expect(posts.length).toBeGreaterThanOrEqual(3);
    for (const post of posts) {
      expect(post.title).toBeTruthy();
      expect(post.description).toBeTruthy();
      expect(post.author).toBeTruthy();
      expect(post.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(post.readMinutes).toBeGreaterThanOrEqual(1);
      expect(post.headings.length).toBeGreaterThan(0);
      for (const entry of post.faq) {
        expect(entry.question).toBeTruthy();
        expect(entry.answer).toBeTruthy();
      }
    }
    const dates = posts.map((p) => p.date.getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it('finds a post by slug and misses unknown slugs', () => {
    expect(getPostBySlug('what-is-a-cp12')?.title).toContain('CP12');
    expect(getPostBySlug('does-not-exist')).toBeNull();
  });
});
