import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';

export const metadata: Metadata = {
  title: 'certnow | CP12s in minutes',
  description:
    'Mobile-first CP12 software for UK gas engineers. Build, sign, and send gas safety certificates from site in minutes.',
};

const featureList = [
  {
    title: 'Auto-schedule the next CP12',
    body: 'Next year’s follow-up can be carried forward from the same certificate flow so repeat work does not disappear after the PDF is sent.',
  },
  {
    title: 'Linked Gas Warning Notice drafts',
    body: 'Unsafe appliance follow-up stays tied to the same job, with the warning notice draft ready from the CP12 record.',
  },
  {
    title: 'Speak readings instead of typing',
    body: 'Use the built-in voice readings flow to capture combustion values and push them back into the wizard.',
  },
];

const proofPoints = [
  'Built for UK gas engineers',
  'Mobile-first CP12 workflow',
  'PDF output ready before you leave site',
];

const heroPhones = [
  {
    title: 'People and location',
    image: '/landing/cp12-wizard-step-1.png',
    alt: 'certnow CP12 wizard people and location screen',
    className:
      'landing-phone-float absolute left-0 top-10 z-10 w-[12.5rem] -rotate-[8deg] sm:left-6 sm:w-[14rem] lg:left-10 lg:top-8 lg:w-[15rem]',
    imageClassName: 'object-cover object-top',
  },
  {
    title: 'Appliance checks',
    image: '/landing/cp12-wizard-step-2.png',
    alt: 'certnow CP12 wizard appliance checks screen',
    className:
      'landing-phone-float-slow absolute left-1/2 top-0 z-20 w-[14.5rem] -translate-x-1/2 sm:w-[16.5rem] lg:w-[18rem]',
    imageClassName: 'object-cover object-top',
  },
  {
    title: 'Issue flow',
    image: '/landing/cp12-wizard-step-3.png',
    alt: 'certnow CP12 wizard review and issue screen',
    className:
      'landing-phone-float-delay absolute right-0 top-16 z-10 w-[12.5rem] rotate-[8deg] sm:right-6 sm:w-[14rem] lg:right-10 lg:top-12 lg:w-[15rem]',
    imageClassName: 'object-cover object-top',
  },
];

function PhoneFrame({
  image,
  alt,
  className,
  imageClassName,
}: {
  image: string;
  alt: string;
  className: string;
  imageClassName?: string;
}) {
  return (
    <div className={className}>
      <div className="rounded-[2.2rem] border border-black/10 bg-[#111827] p-2 shadow-[0_24px_60px_rgba(17,24,39,0.18)]">
        <div className="mx-auto mb-2 h-1.5 w-20 rounded-full bg-white/15" />
        <div className="overflow-hidden rounded-[1.8rem] border border-black/5 bg-white">
          <div className="relative aspect-[393/852] bg-[#f3f4f6]">
            <Image
              src={image}
              alt={alt}
              fill
              className={imageClassName ?? 'object-cover object-top'}
              sizes="(max-width: 768px) 220px, 280px"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function RootPage() {
  const supabase = await supabaseServerReadOnly();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  return (
    <main className="min-h-screen bg-[var(--muted)] text-[var(--brand)]">
      <section className="px-4 pb-12 pt-6 md:px-6 md:pb-16 md:pt-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center text-center">
          <header className="flex w-full max-w-5xl items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[var(--surface)]/90 px-4 py-3 shadow-sm backdrop-blur">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-extrabold text-[var(--brand)] tracking-tight">certnow</span>
              <span className="hidden text-xs font-medium text-gray-500 sm:inline">Field compliance</span>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center rounded-full border border-white/20 bg-white/70 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-white"
            >
              Log in
            </Link>
          </header>

          <div className="mt-10 flex w-full max-w-4xl flex-col items-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
              Mobile-first field compliance
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-[var(--brand)] sm:text-5xl">
              CP12s in minutes, from the same phone flow you already use on site.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600">
              certnow is built for UK gas engineers who want to finish the certificate before leaving the property, not later that night at a desk.
            </p>

            <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/signup/step1"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--action)] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand)]"
              >
                Start signup
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 bg-white px-6 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                Existing users log in
              </Link>
            </div>

            <div className="mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {proofPoints.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>

            <div className="relative mt-12 h-[25rem] w-full max-w-[24rem] sm:h-[30rem] sm:max-w-[32rem] lg:h-[32rem] lg:max-w-[48rem]">
              {heroPhones.map((phone) => (
                <PhoneFrame key={phone.title} {...phone} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 md:px-6 md:py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">Why engineers use it</p>
          <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight text-[var(--brand)] sm:text-4xl">
            Same language as the app. Less admin after the visit.
          </h2>

          <div className="mt-10 grid w-full gap-4 md:grid-cols-3">
            {featureList.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white px-5 py-6 text-center shadow-sm"
              >
                <h3 className="text-lg font-semibold text-[var(--brand)]">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-gray-600">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-4 md:px-6 md:py-8">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-8 rounded-[2rem] border border-white/10 bg-white p-5 shadow-sm md:grid-cols-[1.1fr_0.9fr] md:p-8">
          <div className="text-center md:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">What the customer gets</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-[var(--brand)]">
              A real completed CP12, not just a form flow.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-gray-600">
              The wizard ends in a proper certificate output you can preview, save, and send. That finished document is part of the product, not a separate admin job afterwards.
            </p>
          </div>

          <div className="overflow-hidden rounded-[1.5rem] border border-gray-100 bg-[#eef2f7] p-3">
            <div className="relative aspect-[1800/1272] overflow-hidden rounded-[1.1rem] bg-white shadow-sm">
              <Image
                src="/landing/cp12-completed-pdf.png"
                alt="completed CP12 PDF output"
                fill
                className="object-cover object-center"
                sizes="(max-width: 768px) 100vw, 560px"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 pt-4 md:px-6 md:pb-20">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center rounded-[2rem] border border-white/10 bg-white px-6 py-10 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">Ready to try it</p>
          <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight text-[var(--brand)] sm:text-4xl">
            Start the next CP12 on your phone and leave with the PDF done.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-gray-600">
            Use the same mobile flow for the certificate, the follow-up, and the final document preview.
          </p>

          <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/signup/step1"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--action)] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand)]"
            >
              Create account
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 bg-[var(--muted)] px-6 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
