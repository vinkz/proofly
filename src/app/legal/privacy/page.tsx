import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { SITE_URL } from '@/lib/blog';

const UPDATED_DATE = '26 July 2026';
const PRIVACY_EMAIL = 'kelvin@certnow.uk';

export const metadata: Metadata = {
  title: 'Privacy notice | CertNow',
  description:
    'How CertNow collects, uses, shares and protects personal information, including information used for business outreach.',
  alternates: { canonical: `${SITE_URL}/legal/privacy` },
  openGraph: {
    title: 'Privacy notice | CertNow',
    description:
      'How CertNow collects, uses, shares and protects personal information, including information used for business outreach.',
    url: `${SITE_URL}/legal/privacy`,
    siteName: 'CertNow',
    type: 'website',
    locale: 'en_GB',
  },
};

const sections = [
  ['who-we-are', 'Who we are'],
  ['our-role', 'Our role'],
  ['information-we-collect', 'Information we collect'],
  ['how-we-use-information', 'How we use information'],
  ['business-outreach', 'Business outreach'],
  ['sharing', 'Who we share it with'],
  ['international-transfers', 'International transfers'],
  ['retention', 'How long we keep it'],
  ['security', 'Security and shared links'],
  ['your-rights', 'Your rights'],
  ['cookies-and-analytics', 'Cookies and analytics'],
  ['contact', 'Contact and complaints'],
] as const;

function PrivacySection({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t-[0.5px] border-[var(--color-border-secondary)] py-9">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="text-[11px] tabular-nums text-[var(--color-text-tertiary)]" aria-hidden>
          {number}
        </span>
        <h2 className="text-[24px] font-medium tracking-[-0.3px] text-[var(--color-text-primary)]">
          {title}
        </h2>
      </div>
      <div className="space-y-4 text-[15px] leading-[1.7] text-[var(--color-text-secondary)]">
        {children}
      </div>
    </section>
  );
}

function BulletList({ children }: { children: ReactNode }) {
  return (
    <ul className="ml-5 flex list-disc flex-col gap-2 marker:text-[var(--color-text-tertiary)]">
      {children}
    </ul>
  );
}

function InlineLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-[var(--color-action)] hover:underline">
      {children}
    </a>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <header className="border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)]">
        <div className="legal-hero-enter mx-auto max-w-[960px] px-5 pb-10 pt-12 sm:pb-12 sm:pt-14">
          <p className="mb-[14px] text-[11px] uppercase tracking-[1.5px] text-[var(--color-text-eyebrow)]">
            Privacy notice
          </p>
          <h1 className="max-w-[650px] text-[30px] font-medium leading-[1.15] tracking-[-0.5px] text-[var(--color-text-primary)] sm:text-[36px]">
            Your information, handled plainly.
          </h1>
          <p className="mt-4 max-w-[620px] text-[15px] leading-[1.65] text-[var(--color-text-secondary)]">
            This notice explains what CertNow collects, why we use it, who helps us process it,
            and the choices available to you.
          </p>
          <p className="mt-5 text-[12px] text-[var(--color-text-tertiary)]">
            Effective and last updated {UPDATED_DATE}
          </p>
        </div>
      </header>

      <div className="legal-content-enter mx-auto w-full max-w-[960px] px-5 pb-16 pt-8 lg:grid lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-14 lg:pt-12">
        <aside className="mb-10 lg:mb-0">
          <nav aria-label="Privacy notice sections" className="lg:sticky lg:top-24">
            <p className="mb-3 text-[11px] uppercase tracking-[1.5px] text-[var(--color-text-eyebrow)]">
              On this page
            </p>
            <ol className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:flex lg:flex-col">
              {sections.map(([id, label], index) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="group flex items-baseline gap-2 text-[13px] leading-[1.45] text-[var(--color-text-secondary)] transition-[color,transform] hover:translate-x-0.5 hover:text-[var(--color-text-primary)]"
                  >
                    <span className="text-[10px] tabular-nums text-[var(--color-text-tertiary)]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span>{label}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="min-w-0">
          <section
            aria-labelledby="privacy-at-a-glance"
            className="mb-9 border-y-[0.5px] border-[var(--color-border-secondary)] py-6"
          >
            <p
              id="privacy-at-a-glance"
              className="mb-4 text-[11px] uppercase tracking-[1.5px] text-[var(--color-text-eyebrow)]"
            >
              At a glance
            </p>
            <dl className="grid gap-5 sm:grid-cols-3">
              <div>
                <dt className="text-[13px] font-medium text-[var(--color-text-primary)]">Why</dt>
                <dd className="mt-1 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
                  To run CertNow, support users, keep the service secure and communicate about it.
                </dd>
              </div>
              <div>
                <dt className="text-[13px] font-medium text-[var(--color-text-primary)]">Sharing</dt>
                <dd className="mt-1 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
                  With service providers that help us operate. We do not sell personal information.
                </dd>
              </div>
              <div>
                <dt className="text-[13px] font-medium text-[var(--color-text-primary)]">Control</dt>
                <dd className="mt-1 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
                  You can object to direct marketing at any time and ask about your information.
                </dd>
              </div>
            </dl>
          </section>

          <PrivacySection id="who-we-are" number="01" title="Who we are">
            <p>
              CertNow operates the website at certnow.uk and provides digital workflows for UK gas
              engineers to prepare, issue, store and share job records, certificates and related
              documents. In this notice, “CertNow”, “we”, “us” and “our” refer to the operator of
              the CertNow service.
            </p>
            <p>
              For privacy questions or requests, email{' '}
              <InlineLink href={`mailto:${PRIVACY_EMAIL}?subject=Privacy%20request`}>
                {PRIVACY_EMAIL}
              </InlineLink>
              .
            </p>
            <p>
              The service is intended for business users and adults. It is not designed for use by
              children.
            </p>
          </PrivacySection>

          <PrivacySection id="our-role" number="02" title="Our role">
            <p>
              CertNow is a controller for information used to run our website, manage accounts,
              bill subscribers, secure and improve the service, provide support, and conduct our
              own business outreach.
            </p>
            <p>
              Gas engineers and their businesses normally decide why customer, landlord, property
              and job information is entered into CertNow. For that information, the engineer or
              business is normally the controller and CertNow provides the processing platform. If
              you are a landlord, tenant or customer asking about a job record, contacting the
              relevant engineer first is usually the fastest route. We will assist where we can.
            </p>
          </PrivacySection>

          <PrivacySection id="information-we-collect" number="03" title="Information we collect">
            <p>The information we process depends on how you use CertNow. It can include:</p>
            <BulletList>
              <li>
                <strong className="font-medium text-[var(--color-text-primary)]">
                  Account and profile information:
                </strong>{' '}
                name, email address, date of birth, profession, company details, telephone number,
                trade qualifications, Gas Safe identifiers and account settings.
              </li>
              <li>
                <strong className="font-medium text-[var(--color-text-primary)]">
                  Job and certificate information:
                </strong>{' '}
                property and landlord details, site contact information, access notes, appliance
                details, inspection results, safety classifications, signatures, photographs,
                certificates, service history and delivery records.
              </li>
              <li>
                <strong className="font-medium text-[var(--color-text-primary)]">
                  Invoice and billing information:
                </strong>{' '}
                invoice details, standard rates, bank-transfer details, subscription status and
                identifiers supplied by our payment provider. CertNow does not store full payment
                card details.
              </li>
              <li>
                <strong className="font-medium text-[var(--color-text-primary)]">
                  Public request information:
                </strong>{' '}
                details submitted through landlord request, property and job-prefill links,
                including contact information, property address, preferred dates and access notes.
              </li>
              <li>
                <strong className="font-medium text-[var(--color-text-primary)]">
                  Free tool information:
                </strong>{' '}
                the email address you give when you download a document from one of our free tools,
                with the time and which tool it came from. We do not store the certificate or
                record itself, or anything you typed into it.
              </li>
              <li>
                <strong className="font-medium text-[var(--color-text-primary)]">
                  Technical and usage information:
                </strong>{' '}
                IP address, browser and device information, page visits, feature events, security
                records, diagnostics, errors and performance data.
              </li>
              <li>
                <strong className="font-medium text-[var(--color-text-primary)]">
                  Optional voice input:
                </strong>{' '}
                short recordings submitted for transcription when the CP12 voice-entry feature is
                used. CertNow uses the returned transcript to identify readings and does not save
                the audio as a user-accessible recording.
              </li>
            </BulletList>
          </PrivacySection>

          <PrivacySection id="how-we-use-information" number="04" title="How we use information">
            <p>We use information for the following purposes and legal bases:</p>
            <div className="overflow-x-auto border-y-[0.5px] border-[var(--color-border-secondary)]">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr>
                    <th className="border-b-[0.5px] border-[var(--color-border-secondary)] py-3 pr-5 text-[12px] font-medium text-[var(--color-text-tertiary)]">
                      Purpose
                    </th>
                    <th className="border-b-[0.5px] border-[var(--color-border-secondary)] py-3 text-[12px] font-medium text-[var(--color-text-tertiary)]">
                      Usual legal basis
                    </th>
                  </tr>
                </thead>
                <tbody className="[&_tr:not(:last-child)]:border-b-[0.5px] [&_tr:not(:last-child)]:border-[var(--color-border-tertiary)]">
                  <tr>
                    <td className="py-3 pr-5 text-[13px] leading-[1.6]">
                      Create accounts and provide certificate, job, property, invoice and delivery
                      features
                    </td>
                    <td className="py-3 text-[13px] leading-[1.6]">
                      Performance of a contract and legitimate interests
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-5 text-[13px] leading-[1.6]">
                      Manage subscriptions, payments, records and support requests
                    </td>
                    <td className="py-3 text-[13px] leading-[1.6]">
                      Performance of a contract and legal obligations
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-5 text-[13px] leading-[1.6]">
                      Protect accounts, investigate misuse, diagnose faults and improve reliability
                    </td>
                    <td className="py-3 text-[13px] leading-[1.6]">
                      Legitimate interests in operating a secure, effective service
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-5 text-[13px] leading-[1.6]">
                      Send transactional messages and service updates
                    </td>
                    <td className="py-3 text-[13px] leading-[1.6]">
                      Performance of a contract and legitimate interests
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-5 text-[13px] leading-[1.6]">
                      Understand visits and feature use with privacy-restricted analytics
                    </td>
                    <td className="py-3 text-[13px] leading-[1.6]">
                      Legitimate interests in understanding and improving CertNow
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-5 text-[13px] leading-[1.6]">
                      Conduct limited, relevant business-to-business outreach
                    </td>
                    <td className="py-3 text-[13px] leading-[1.6]">
                      Legitimate interests, subject to applicable direct-marketing rules
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Where we rely on legitimate interests, we consider the necessity of the processing
              and balance it against the rights and reasonable expectations of the people affected.
              We do not use personal information for solely automated decisions that produce legal
              or similarly significant effects.
            </p>
          </PrivacySection>

          <PrivacySection id="business-outreach" number="05" title="Business outreach">
            <p>
              We conduct small-scale outreach to relevant UK businesses to introduce CertNow and
              request product feedback. We may collect a business name, town, website, public
              business email or business contact email, company type and status, Gas Safe
              verification, source URL, communication history and response status.
            </p>
            <p>
              Sources can include Google Business Profiles and Maps, a business’s own website,
              Companies House, the Gas Safe Register and other publicly accessible business
              directories. We use rule-based checks and human approval to decide whether a record
              is suitable for outreach. Those checks do not make a legal or similarly significant
              decision about anyone.
            </p>
            <p>
              Our cold-email workflow is intended for verified corporate subscribers. We do not
              treat sole traders, ordinary partnerships or unknown business types as eligible for
              unsolicited email unless an appropriate permission or exception applies. A typical
              sequence contains one introductory email and one follow-up if no reply is detected.
            </p>
            <div className="border-l-2 border-[var(--color-action)] bg-[var(--color-action-bg)] px-4 py-4">
              <p className="font-medium text-[var(--color-text-primary)]">
                You have an absolute right to object to the use of your personal information for
                direct marketing.
              </p>
              <p className="mt-1 text-[13px] leading-[1.6]">
                Reply “no thanks” to an outreach email or email{' '}
                <InlineLink href={`mailto:${PRIVACY_EMAIL}?subject=Do%20not%20contact`}>
                  {PRIVACY_EMAIL}
                </InlineLink>
                . We will stop the outreach and retain only the minimum suppression information
                needed to avoid contacting you again.
              </p>
            </div>
            <p>
              Outreach links may contain campaign parameters so we can understand whether a visit
              came from an email. We do not add an email-open tracking pixel to these messages.
            </p>
          </PrivacySection>

          <PrivacySection id="free-tools" number="06" title="Free tools">
            <p>
              We publish free tools that anyone can use without an account, including a CP12
              generator, a boiler service record generator and a gas rate calculator. They are
              deliberately built to keep as little as possible.
            </p>
            <p>
              Nothing you type into a free tool is stored. The property address, landlord details,
              appliance details, readings, classifications and your signature exist only for as
              long as it takes to produce your PDF, and are then discarded. We keep no copy of the
              document, which also means we cannot re-send one you have lost or reissue it later.
            </p>
            <p>
              When you ask us to email the finished document we store your email address, the time,
              and which tool you used. Nothing else. We use it to send you the document you asked
              for and to contact you about CertNow. Our legal basis is legitimate interests in
              promoting our own similar products to someone who has used one of them; you can
              object at any time and we will stop.
            </p>
            <p>
              The gas rate calculator asks for no email at all and runs entirely in your browser —
              the figures you enter are never sent to us.
            </p>
            <div className="border-l-2 border-[var(--color-action)] bg-[var(--color-action-bg)] px-4 py-4">
              <p className="font-medium text-[var(--color-text-primary)]">
                You can ask us to delete your free tool email address at any time.
              </p>
              <p className="mt-1 text-[13px] leading-[1.6]">
                Email{' '}
                <InlineLink href={`mailto:${PRIVACY_EMAIL}?subject=Free%20tool%20email%20removal`}>
                  {PRIVACY_EMAIL}
                </InlineLink>
                . Because we hold nothing but the address itself, removing it leaves no other
                record of your visit.
              </p>
            </div>
          </PrivacySection>

          <PrivacySection id="sharing" number="07" title="Who we share it with">
            <p>
              We use specialist providers to operate CertNow. Depending on the feature, these
              currently include:
            </p>
            <BulletList>
              <li>Supabase for authentication, database and file storage.</li>
              <li>Vercel for application hosting and delivery.</li>
              <li>Stripe for subscriptions and payment processing.</li>
              <li>Resend and Google Gmail for transactional and business email.</li>
              <li>Airtable and Make for the controlled business-outreach workflow.</li>
              <li>PostHog EU Cloud for restricted product analytics and masked session replay.</li>
              <li>Sentry for error reporting and performance diagnostics.</li>
              <li>Ideal Postcodes for address search and formatting.</li>
              <li>OpenAI for optional voice transcription of spoken appliance readings.</li>
            </BulletList>
            <p>
              We may also share information with professional advisers, regulators, courts, law
              enforcement or another organisation where required by law, needed to protect rights
              and safety, or connected with a genuine business reorganisation. We do not sell
              personal information.
            </p>
          </PrivacySection>

          <PrivacySection id="international-transfers" number="08" title="International transfers">
            <p>
              Some providers may process information outside the UK. Where UK data-protection law
              requires safeguards, we use providers and arrangements designed to protect the
              information, such as applicable adequacy regulations, the UK International Data
              Transfer Agreement or the UK Addendum to standard contractual clauses. You can
              contact us for more information about the safeguards relevant to your information.
            </p>
          </PrivacySection>

          <PrivacySection id="retention" number="09" title="How long we keep it">
            <p>
              We keep information only for as long as it is reasonably needed for the purpose for
              which it was collected, including providing the service, maintaining certificate and
              property history, meeting accounting or legal duties, resolving disputes, preventing
              fraud and establishing or defending legal claims.
            </p>
            <BulletList>
              <li>
                Account and profile information is normally kept while the account is active and
                for a limited period afterwards for support, security and legal purposes.
              </li>
              <li>
                Issued certificates, job documents and property history may need to be retained for
                longer because they form compliance and service records.
              </li>
              <li>
                Billing and invoice records are kept for the period required by applicable
                accounting and tax rules.
              </li>
              <li>
                Outreach lead information is reviewed against the continuing campaign need.
                Suppression information can be retained for longer so that an objection continues
                to be respected.
              </li>
              <li>
                Free tool email addresses are kept while they remain useful for contacting you
                about CertNow, and are deleted on request. The documents produced by those tools
                are never stored at all.
              </li>
              <li>
                Security logs and backups are retained on rolling schedules and then deleted or
                overwritten.
              </li>
            </BulletList>
            <p>
              When information is no longer required, we delete it or anonymise it. Exact periods
              can vary according to record type, account status and legal requirements.
            </p>
          </PrivacySection>

          <PrivacySection id="security" number="10" title="Security and shared links">
            <p>
              We use technical and organisational measures designed to protect information,
              including authenticated account access, scoped database permissions, restricted
              service credentials, encrypted connections and tokenised public links.
            </p>
            <p>
              Property, certificate, job and prefill links can be shared without requiring the
              recipient to create an account. These links use hard-to-guess tokens, but anyone who
              receives a valid link may be able to view the information made available through it.
              Users should share them only with intended recipients and contact us if a link may
              have been exposed.
            </p>
            <p>
              No online service can guarantee absolute security. Please tell us promptly if you
              believe an account, document or link has been accessed improperly.
            </p>
          </PrivacySection>

          <PrivacySection id="your-rights" number="11" title="Your rights">
            <p>
              Depending on the circumstances and legal basis, you may have rights to access,
              correct, erase or restrict personal information, receive a portable copy, and object
              to processing. If processing is based on consent, you can withdraw that consent
              without affecting earlier lawful processing.
            </p>
            <p>
              Some rights are not absolute. For example, we may need to retain certain records to
              meet legal duties or establish or defend claims. We may ask for information needed to
              verify identity before completing a request.
            </p>
            <p>
              The right to object to processing for direct marketing is absolute. Use the contact
              details below or reply directly to the relevant email.
            </p>
          </PrivacySection>

          <PrivacySection id="cookies-and-analytics" number="12" title="Cookies and analytics">
            <p>
              CertNow uses essential session technology to keep signed-in users authenticated and
              secure. These functions are necessary for the service.
            </p>
            <p>
              Our PostHog configuration uses memory-only persistence rather than cookies, local
              storage or session storage. It respects browser Do Not Track settings. Session replay
              masks all input values and rendered text so that names, addresses, job details and
              certificate content are not intentionally captured in replay. Analytics events are
              designed not to include names, email addresses, telephone numbers or property
              addresses.
            </p>
            <p>
              External services opened from CertNow, such as Stripe’s hosted payment pages, may use
              their own necessary technologies under their own notices.
            </p>
          </PrivacySection>

          <PrivacySection id="contact" number="13" title="Contact and complaints">
            <p>
              To ask a question, exercise a privacy right or object to direct marketing, email{' '}
              <InlineLink href={`mailto:${PRIVACY_EMAIL}?subject=Privacy%20request`}>
                {PRIVACY_EMAIL}
              </InlineLink>
              . Please use “Privacy request” in the subject line.
            </p>
            <p>
              We would like the opportunity to resolve a concern directly. You also have the right
              to complain to the UK Information Commissioner’s Office through{' '}
              <InlineLink href="https://ico.org.uk/make-a-complaint/">
                ico.org.uk/make-a-complaint
              </InlineLink>
              .
            </p>
            <p>
              We may update this notice as CertNow, our providers or the law changes. Material
              changes will be highlighted through the service or another appropriate channel, and
              the date at the top will be updated.
            </p>
            <div className="pt-3">
              <Button asChild variant="action" className="h-11 px-5 text-[14px]">
                <a href={`mailto:${PRIVACY_EMAIL}?subject=Privacy%20request`}>Contact CertNow</a>
              </Button>
            </div>
          </PrivacySection>
        </article>
      </div>
    </>
  );
}
