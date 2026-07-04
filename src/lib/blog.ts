import fs from 'node:fs';
import path from 'node:path';

import matter from 'gray-matter';
import { z } from 'zod';

/** Canonical public origin for SEO URLs (canonical, OG, sitemap, JSON-LD). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://certnow.uk').replace(
  /\/+$/,
  '',
);

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

const faqEntrySchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

const frontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  date: z.coerce.date(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be kebab-case'),
  author: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  faq: z.array(faqEntrySchema).default([]),
});

export type BlogFaqEntry = z.infer<typeof faqEntrySchema>;

export type BlogPost = z.infer<typeof frontmatterSchema> & {
  /** MDX body without frontmatter. */
  content: string;
  /** Estimated reading time in whole minutes (minimum 1). */
  readMinutes: number;
  /** h2 headings, in document order, for the table of contents. */
  headings: BlogHeading[];
};

export type BlogHeading = { id: string; text: string };

/** GitHub-style slug for heading anchors — must stay in sync with the MDX h2 renderer. */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const WORDS_PER_MINUTE = 220;

export function estimateReadMinutes(content: string): number {
  const words = content
    // Drop fenced code blocks so config samples don't inflate the estimate.
    .replace(/```[\s\S]*?```/g, ' ')
    // Drop JSX tags such as <ArticleCTA variant="engineer" />.
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export function extractHeadings(content: string): BlogHeading[] {
  const headings: BlogHeading[] = [];
  let inFence = false;
  for (const line of content.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) {
      // Strip inline markdown emphasis/code markers for clean TOC labels.
      const text = match[1].replace(/[*_`]/g, '').trim();
      headings.push({ id: slugifyHeading(text), text });
    }
  }
  return headings;
}

function parsePost(filePath: string): BlogPost {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(raw);
  const parsed = frontmatterSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `Invalid blog frontmatter in ${path.basename(filePath)}: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`,
    );
  }
  return {
    ...parsed.data,
    content,
    readMinutes: estimateReadMinutes(content),
    headings: extractHeadings(content),
  };
}

/** All posts, newest first. Returns [] when content/blog does not exist. */
export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  const posts = fs
    .readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => parsePost(path.join(BLOG_DIR, file)));

  const seen = new Set<string>();
  for (const post of posts) {
    if (seen.has(post.slug)) {
      throw new Error(`Duplicate blog slug "${post.slug}" in content/blog`);
    }
    seen.add(post.slug);
  }

  return posts.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function getPostBySlug(slug: string): BlogPost | null {
  return getAllPosts().find((post) => post.slug === slug) ?? null;
}
