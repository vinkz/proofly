import Link from 'next/link';

type ArticleCTAProps = {
  variant: 'engineer' | 'landlord';
};

const copy = {
  engineer: {
    eyebrow: 'For Gas Safe engineers',
    title: 'Finish the CP12 before you reach the van',
    body: 'CertNow turns the certificate into a step-by-step wizard you complete on site — sign, issue the PDF, and send it to the landlord in one flow. £12.99/month, unlimited certificates.',
    href: '/signup/step1',
    cta: 'Start free trial',
    note: '14-day trial · No card required',
  },
  landlord: {
    eyebrow: 'For landlords',
    title: 'Get your gas safety certificate sorted',
    body: 'Send your engineer the property and tenant details once, and your CP12 lands on a permanent link — with renewal reminders before it expires. Free for landlords, no account needed.',
    href: '/request-job',
    cta: 'Request a gas safety check',
    note: 'Works with the engineer you already use',
  },
} as const;

/**
 * Signup pitch card for dropping into blog MDX:
 *   <ArticleCTA variant="engineer" />
 */
export function ArticleCTA({ variant }: ArticleCTAProps) {
  const c = copy[variant];
  return (
    <aside className="not-prose my-8 rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] p-6">
      <p className="mb-2 text-[11px] uppercase tracking-[1.5px] text-[var(--color-text-eyebrow)]">
        {c.eyebrow}
      </p>
      <p className="text-[19px] font-medium leading-[1.3] tracking-[-0.3px] text-[var(--color-text-primary)]">
        {c.title}
      </p>
      <p className="mt-2 text-[14px] leading-[1.65] text-[var(--color-text-secondary)]">{c.body}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href={c.href}
          className="inline-flex h-11 items-center justify-center rounded-[22px] bg-[var(--color-cta)] px-5 text-[14px] font-medium text-[var(--color-cta-fg)]"
        >
          {c.cta}
        </Link>
        <p className="text-[12px] text-[var(--color-text-tertiary)]">{c.note}</p>
      </div>
    </aside>
  );
}
