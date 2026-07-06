import Link from 'next/link';
import type { AnchorHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import type { MDXRemoteProps } from 'next-mdx-remote/rsc';

import { ArticleCTA } from '@/components/blog/article-cta';
import { slugifyHeading } from '@/lib/blog';

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return textOf((node.props as { children?: ReactNode }).children);
  }
  return '';
}

function MdxLink({ href = '', children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  // Inline-link convention from the landing page: plain action green, no
  // persistent underline; prose adds underline on hover (see DESIGN_TOKENS.md).
  const className = 'text-[var(--color-action)] hover:underline';
  if (href.startsWith('/') || href.startsWith('#')) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  );
}

/**
 * Prose styling for blog articles. Every value derives from DESIGN_TOKENS.md:
 * landing section h2, landing body copy, card hairlines, comparison-table rows.
 * h2 ids come from slugifyHeading so they match the table of contents.
 */
export const mdxComponents: NonNullable<MDXRemoteProps['components']> = {
  ArticleCTA,
  h2: ({ children }: HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      id={slugifyHeading(textOf(children))}
      className="mb-3 mt-10 scroll-mt-20 text-[24px] font-medium tracking-[-0.3px] text-[var(--color-text-primary)]"
    >
      {children}
    </h2>
  ),
  h3: ({ children }: HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mb-2 mt-7 text-base font-medium leading-tight text-[var(--color-text-primary)]">
      {children}
    </h3>
  ),
  p: ({ children }: HTMLAttributes<HTMLParagraphElement>) => (
    <p className="mb-4 text-[15px] leading-[1.65] text-[var(--color-text-secondary)]">{children}</p>
  ),
  a: MdxLink,
  strong: ({ children }: HTMLAttributes<HTMLElement>) => (
    <strong className="font-medium text-[var(--color-text-primary)]">{children}</strong>
  ),
  ul: ({ children }: HTMLAttributes<HTMLUListElement>) => (
    <ul className="mb-4 flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-[1.65] text-[var(--color-text-secondary)] marker:text-[var(--color-text-tertiary)]">
      {children}
    </ul>
  ),
  ol: ({ children }: HTMLAttributes<HTMLOListElement>) => (
    <ol className="mb-4 flex list-decimal flex-col gap-1.5 pl-5 text-[15px] leading-[1.65] text-[var(--color-text-secondary)] marker:text-[var(--color-text-tertiary)]">
      {children}
    </ol>
  ),
  li: ({ children }: HTMLAttributes<HTMLLIElement>) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }: HTMLAttributes<HTMLQuoteElement>) => (
    // Derived from the landing-page testimonial card: italic body inside a card.
    <blockquote className="mb-4 rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-[18px] text-[15px] italic leading-[1.65] text-[var(--color-text-primary)] [&>p]:mb-0 [&>p]:text-[15px] [&>p]:text-[var(--color-text-primary)]">
      {children}
    </blockquote>
  ),
  code: ({ children }: HTMLAttributes<HTMLElement>) => (
    <code className="rounded-[8px] bg-[var(--color-background-tertiary)] px-1.5 py-0.5 font-mono text-[13px] text-[var(--color-text-primary)]">
      {children}
    </code>
  ),
  pre: ({ children }: HTMLAttributes<HTMLPreElement>) => (
    <pre className="mb-4 overflow-x-auto rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-tertiary)] p-[18px] text-[13px] leading-[1.6] [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-8 border-t-[0.5px] border-[var(--color-border-secondary)]" />,
  table: ({ children }: HTMLAttributes<HTMLTableElement>) => (
    // Derived from the landing-page comparison table: hairline card, row rules.
    <div className="mb-4 overflow-x-auto rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)]">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  th: ({ children }: HTMLAttributes<HTMLTableCellElement>) => (
    <th className="border-b-[0.5px] border-[var(--color-border-tertiary)] px-4 py-3 text-[12px] font-medium text-[var(--color-text-tertiary)]">
      {children}
    </th>
  ),
  td: ({ children }: HTMLAttributes<HTMLTableCellElement>) => (
    <td className="border-b-[0.5px] border-[var(--color-border-tertiary)] px-4 py-3 text-[13px] leading-[1.6] text-[var(--color-text-secondary)] [&:first-child]:text-[var(--color-text-primary)]">
      {children}
    </td>
  ),
};
