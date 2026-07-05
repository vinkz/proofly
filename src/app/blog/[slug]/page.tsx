import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { MDXRemote } from 'next-mdx-remote/rsc';

import { getAllPosts, getPostBySlug, SITE_URL, type BlogPost } from '@/lib/blog';
import { mdxComponents } from '../_components/mdx-components';

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  const url = `${SITE_URL}/blog/${post.slug}`;
  return {
    title: `${post.title} | CertNow`,
    description: post.description,
    authors: [{ name: post.author }],
    keywords: post.tags,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      siteName: 'CertNow',
      type: 'article',
      locale: 'en_GB',
      publishedTime: post.date.toISOString(),
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: 'summary',
      title: post.title,
      description: post.description,
    },
  };
}

function buildJsonLd(post: BlogPost) {
  const url = `${SITE_URL}/blog/${post.slug}`;
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date.toISOString(),
    author: { '@type': 'Person', name: post.author },
    publisher: {
      '@type': 'Organization',
      name: 'CertNow',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/certnow-logo.svg` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    inLanguage: 'en-GB',
    keywords: post.tags.join(', '),
  };
  if (post.faq.length === 0) return [article];
  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: post.faq.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };
  return [article, faqPage];
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  return (
    <article className="mx-auto w-full max-w-[68ch] px-5 pb-16">
      {buildJsonLd(post).map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
        />
      ))}

      {/* Header */}
      <header className="pb-8 pt-11">
        <nav className="mb-[14px] text-[12px] text-[var(--color-text-tertiary)]">
          <Link
            href="/blog"
            className="transition-colors hover:text-[var(--color-text-secondary)]"
          >
            Blog
          </Link>
          <span aria-hidden> / </span>
          <span>{post.title}</span>
        </nav>
        <h1 className="text-[30px] font-medium leading-[1.15] tracking-[-0.5px] text-[var(--color-text-primary)]">
          {post.title}
        </h1>
        <p className="mt-4 text-[15px] leading-[1.65] text-[var(--color-text-secondary)]">
          {post.description}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--color-text-tertiary)]">
          <span>{post.author}</span>
          <span aria-hidden>·</span>
          <time dateTime={post.date.toISOString().slice(0, 10)}>
            {format(post.date, 'd MMMM yyyy')}
          </time>
          <span aria-hidden>·</span>
          <span>{post.readMinutes} min read</span>
        </div>
      </header>

      {/* Table of contents */}
      {post.headings.length > 1 && (
        <nav
          aria-label="Table of contents"
          className="mb-9 rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-[18px]"
        >
          <p className="mb-3 text-[11px] uppercase tracking-[1.5px] text-[var(--color-text-eyebrow)]">
            On this page
          </p>
          <ol className="flex flex-col gap-2">
            {post.headings.map((heading) => (
              <li key={heading.id}>
                <a
                  href={`#${heading.id}`}
                  className="text-[14px] leading-[1.5] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  {heading.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Body */}
      <MDXRemote source={post.content} components={mdxComponents} />

      {/* FAQ */}
      {post.faq.length > 0 && (
        <section aria-labelledby="faq-heading" className="mt-12">
          <h2
            id="faq-heading"
            className="mb-4 text-[24px] font-medium tracking-[-0.3px] text-[var(--color-text-primary)]"
          >
            Frequently asked questions
          </h2>
          <div className="flex flex-col gap-3">
            {post.faq.map((entry) => (
              <details
                key={entry.question}
                className="group rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-[18px]"
              >
                <summary className="cursor-pointer list-none text-[15px] font-medium text-[var(--color-text-primary)] [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-3">
                    {entry.question}
                    <span
                      aria-hidden
                      className="text-[var(--color-text-tertiary)] transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
                  {entry.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Back link */}
      <p className="mt-12 text-center">
        <Link href="/blog" className="text-[14px] text-[var(--color-action)] hover:underline">
          ← All articles
        </Link>
      </p>
    </article>
  );
}
