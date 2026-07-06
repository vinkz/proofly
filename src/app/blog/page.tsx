import Link from 'next/link';
import type { Metadata } from 'next';
import { format } from 'date-fns';

import { Badge } from '@/components/ui/badge';
import { getAllPosts, SITE_URL } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog | CertNow',
  description:
    'Guides on gas safety compliance for UK Gas Safe engineers and landlords — CP12s, boiler services, renewals, and running a paperwork-free trade business.',
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: 'CertNow blog',
    description:
      'Guides on gas safety compliance for UK Gas Safe engineers and landlords — CP12s, boiler services, renewals, and running a paperwork-free trade business.',
    url: `${SITE_URL}/blog`,
    siteName: 'CertNow',
    type: 'website',
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary',
    title: 'CertNow blog',
    description:
      'Guides on gas safety compliance for UK Gas Safe engineers and landlords — CP12s, boiler services, renewals, and running a paperwork-free trade business.',
  },
};

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <div className="mx-auto w-full max-w-[640px] px-5 pb-16">
      {/* Hero — landing-page hero pattern */}
      <section className="pb-9 pt-11 text-center">
        <p className="mb-[14px] text-[11px] uppercase tracking-[1.5px] text-[var(--color-text-eyebrow)]">
          CertNow blog
        </p>
        <h1 className="text-[30px] font-medium leading-[1.15] tracking-[-0.5px] text-[var(--color-text-primary)]">
          Gas safety, <span className="text-[var(--color-action)]">without the paperwork.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-[320px] text-[15px] leading-[1.65] text-[var(--color-text-secondary)]">
          Practical guides on CP12s, boiler services, and staying compliant — for Gas Safe
          engineers and the landlords they work for.
        </p>
      </section>

      {posts.length === 0 ? (
        <p className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-[18px] text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
          No posts yet — check back soon.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-[18px] transition-colors hover:bg-[var(--color-background-tertiary)]"
            >
              <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--color-text-tertiary)]">
                <time dateTime={post.date.toISOString().slice(0, 10)}>
                  {format(post.date, 'd MMM yyyy')}
                </time>
                <span aria-hidden>·</span>
                <span>{post.readMinutes} min read</span>
              </div>
              <h2 className="text-[15px] font-medium text-[var(--color-text-primary)]">
                {post.title}
              </h2>
              <p className="mt-1 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
                {post.description}
              </p>
              {post.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {post.tags.map((tag) => (
                    <Badge key={tag} variant="muted">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
