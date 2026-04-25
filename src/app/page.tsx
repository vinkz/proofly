import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';

export const metadata: Metadata = {
  title: 'certnow | complete CP12s on site',
  description:
    'Digital CP12 workflow for UK gas engineers. Complete the record on site, keep follow-up under control, and leave with a finished PDF ready to send.',
};

const featureList = [
  {
    title: 'Finish the record before you leave',
    body: "Don't rely on notes or memory. Complete the record as you go, on site.",
  },
  {
    title: 'Auto-filled follow ups',
    body: 'Warning notices and repeat visits are created from the job automatically, so nothing gets missed.',
  },
  {
    title: 'Fill in without slowing down',
    body: 'Use structured dropdowns and voice input to capture readings and details quickly, even mid-job.',
  },
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
              <span className="hidden text-xs font-medium text-gray-500 sm:inline">CP12 workflow</span>
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
              For UK gas engineers
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-[var(--brand)] sm:text-5xl">
              Field compliance done better.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600">
              CertNow helps UK gas engineers complete CP12s with minimal input, finishing documentation before you leave site.
            </p>

            <Link
              href="/signup/step1"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--action)] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand)]"
            >
              Try now
            </Link>

            <div className="relative mt-10 h-[25rem] w-full max-w-[24rem] sm:h-[30rem] sm:max-w-[32rem] lg:h-[32rem] lg:max-w-[48rem]">
              {heroPhones.map((phone) => (
                <PhoneFrame key={phone.title} {...phone} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-12 pt-20 md:px-6 md:pb-16 md:pt-24">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">Why engineers use it</p>

          <div className="mt-6 grid w-full gap-4 md:grid-cols-3">
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
              A finished CP12 securley stored and easily shared
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-gray-600">
              The visit ends with a proper certificate PDF, not a job that still needs typing up later. That gives the customer a faster handover and gives the engineer a dependable record from the same visit.
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
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">Professional standard</p>
          <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight text-[var(--brand)] sm:text-4xl">
            Start your next job now
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-gray-600">
            Prefill job and address details before arriving on-site
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
