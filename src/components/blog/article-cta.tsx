import Link from 'next/link';

import { Button } from '@/components/ui/button';

type ArticleCTAProps = {
  variant: 'engineer' | 'landlord';
};

const copy = {
  engineer: {
    eyebrow: 'For Gas Safe engineers',
    title: 'Finish the CP12 before you reach the van.',
    body: 'Fill in the certificate as you work: sign, issue the PDF, and send it to the landlord in one flow. Create 10 certificates free each month, or upgrade for unlimited use.',
    href: '/signup/step1',
    cta: 'Create free account',
    note: 'No card required · unlimited plan £8.99/month',
  },
  landlord: {
    eyebrow: 'For landlords',
    title: 'Get your gas safety certificate sorted.',
    body: 'Send your engineer the property and tenant details once, and your CP12 lands on a permanent link where you can respond to future renewal requests.',
    href: '/request',
    cta: 'Request a visit from your engineer',
    note: 'No account needed · takes under 2 minutes',
  },
} as const;

/**
 * Signup pitch for dropping into blog MDX:
 *   <ArticleCTA variant="engineer" />
 * Mirrors the landing page's closing CTA section (see DESIGN_TOKENS.md).
 */
export function ArticleCTA({ variant }: ArticleCTAProps) {
  const c = copy[variant];
  return (
    <aside className="not-prose my-10 rounded-[16px] bg-[var(--color-background-secondary)] px-5 py-8 text-center">
      <p className="mb-[14px] text-[11px] uppercase tracking-[1.5px] text-[var(--color-text-eyebrow)]">
        {c.eyebrow}
      </p>
      <p className="mb-[10px] text-[24px] font-medium tracking-[-0.3px] text-[var(--color-text-primary)]">
        {c.title}
      </p>
      <p className="mx-auto mb-6 max-w-[320px] text-[14px] leading-[1.6] text-[var(--color-text-secondary)]">
        {c.body}
      </p>
      <Button asChild variant="primary" className="h-12 w-full px-6 text-[15px]">
        <Link href={c.href}>{c.cta}</Link>
      </Button>
      <p className="mt-4 text-[12px] text-[var(--color-text-tertiary)]">{c.note}</p>
    </aside>
  );
}
