"use client";

import { useState } from "react";
import Link from "next/link";

type Tab = "engineers" | "landlords";

function IconTool({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function IconBuilding({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
    </svg>
  );
}

function IconPlayerPlay({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function IconArrowRight({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function IconFileCheck({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="m9 15 2 2 4-4" />
    </svg>
  );
}

function IconBellRinging({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      <path d="M4 2C2.8 3.7 2 5.7 2 8" />
      <path d="M20 2c1.2 1.7 2 3.7 2 6" />
    </svg>
  );
}

function IconLink({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function IconRepeat({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function IconCheck({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const features = [
  {
    icon: <IconFileCheck />,
    title: "Done before you leave site",
    body: "Structured fields and voice input mean the CP12 is complete the moment you pack up — no typing up tonight.",
  },
  {
    icon: <IconBellRinging />,
    title: "Reminders sent automatically",
    body: "Landlords get renewal reminders at 8 and 4 weeks out. You get one too — so nothing falls through the cracks.",
  },
  {
    icon: <IconLink />,
    title: "A shareable link for every job",
    body: "Every completed job creates a permanent property link. Landlords see their certificate and renewal status without needing an account.",
  },
  {
    icon: <IconRepeat />,
    title: "Renewals fill themselves in",
    body: "Return jobs pull landlord, property, and appliance data from the last visit. Step 1 is already done when you arrive.",
  },
];

const steps = [
  {
    title: "Open the wizard on site",
    body: "Tap new job, pick CP12 or boiler service. Client and property details prefill from the last visit if it's a returning landlord.",
  },
  {
    title: "Fill in as you work",
    body: "Appliance details, readings, and safety checks are structured so you can tap through on site — no freetext, no guessing what's needed.",
  },
  {
    title: "Sign and issue",
    body: "Engineer and landlord sign on screen. CP12 is generated as a legally valid PDF and stored permanently.",
  },
  {
    title: "Landlord gets a link",
    body: "A shareable property link goes to the landlord with their certificate, next inspection date, and renewal request option when it's due.",
  },
];

const stats = [
  { value: "Under 10 min", label: "Average CP12 time" },
  { value: "100%", label: "Gas Safe compliant output" },
  { value: "0", label: "Lost certificates" },
  { value: "12 months", label: "Auto renewal cycle" },
];

const comparisonRows = [
  { label: "Unlimited certificates", others: false, us: true },
  { label: "Auto landlord reminders", others: false, us: true },
  { label: "Shareable property links", others: false, us: true },
  { label: "Renewals pre-filled", others: false, us: true },
  { label: "Certificate storage", others: true, us: true },
  { label: "Mobile-first wizard", others: false, us: true },
];

const pricingItems = [
  "Unlimited CP12 and boiler service certificates",
  "Gas Warning Notice included",
  "Automatic landlord reminders",
  "Permanent certificate storage",
  "Shareable property links",
  "Invoicing and handover bundle",
];

function EngineersContent() {
  return (
    <>
      {/* Hero */}
      <section className="px-5 pb-9 pt-11 text-center">
        <p className="mb-[14px] text-[11px] uppercase tracking-[1.5px] text-[var(--color-text-tertiary)]">
          For UK Gas Safe engineers
        </p>
        <h1 className="text-[30px] font-medium leading-[1.15] tracking-[-0.5px] text-[var(--color-text-primary)]">
          CP12s done on site.{" "}
          <span className="text-[#1a7a52]">Not the night after.</span>
        </h1>
        <p className="mx-auto mb-7 mt-4 max-w-[300px] text-[15px] leading-[1.65] text-[var(--color-text-secondary)]">
          Fill in the certificate as you work. Sign, send, and store — before you leave the job.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/signup/step1"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[26px] bg-[#111] px-6 text-[15px] font-medium text-white"
          >
            <IconPlayerPlay />
            Start free trial
          </Link>
          <Link
            href="#how-it-works"
            className="inline-flex h-11 items-center justify-center rounded-[22px] border-[0.5px] border-[var(--color-border-primary)] text-[14px] text-[var(--color-text-secondary)]"
          >
            See how it works
          </Link>
        </div>
        <p className="mt-3 text-[12px] text-[var(--color-text-tertiary)]">
          £12.99/month · No card required
        </p>
      </section>

      {/* Phone mockup */}
      <section className="px-5 pb-2">
        <div className="mx-auto max-w-[240px] rounded-[32px] bg-[#111] p-[14px_12px]">
          <div className="rounded-[22px] bg-[#f5f5f3] p-[14px_14px_18px]">
            {/* Top bar */}
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-extrabold tracking-tight text-[#111]">certnow</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-medium text-[#555]">
                Step 3 of 4
              </span>
            </div>
            {/* Progress bar */}
            <div className="mb-4 h-[3px] rounded-full bg-[#e0e0de]">
              <div className="h-full w-3/4 rounded-full bg-[#1a7a52]" />
            </div>
            {/* Section label */}
            <p className="mb-1 text-[8px] uppercase tracking-[1px] text-[#888]">Appliance checks</p>
            <p className="mb-3 text-[13px] font-medium text-[#111]">Appliance 1</p>
            {/* Check rows */}
            {["Burner pressure", "Gas rate", "Safety device"].map((item) => (
              <div key={item} className="mb-2 flex items-center justify-between">
                <span className="text-[11px] text-[#444]">{item}</span>
                <span className="rounded-full bg-[#edf7f2] px-2 py-0.5 text-[9px] font-medium text-[#1a7a52]">
                  Pass
                </span>
              </div>
            ))}
            {/* Status banner */}
            <div className="mt-3 flex items-center gap-2 rounded-[8px] bg-[#edf7f2] px-3 py-2">
              <div className="h-[6px] w-[6px] rounded-full bg-[#1a7a52]" />
              <span className="text-[9px] font-medium text-[#1a7a52]">All checks passed</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-[var(--color-background-secondary)] px-5 py-10">
        <p className="mb-5 text-[11px] uppercase tracking-[1.5px] text-[var(--color-text-tertiary)]">
          Why engineers use it
        </p>
        <div className="flex flex-col gap-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex gap-[14px] rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-[18px]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#edf7f2] text-[#1a7a52]">
                {f.icon}
              </div>
              <div>
                <p className="text-[15px] font-medium text-[var(--color-text-primary)]">{f.title}</p>
                <p className="mt-1 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-[var(--color-background-primary)] px-5 py-10">
        <p className="mb-6 text-[11px] uppercase tracking-[1.5px] text-[var(--color-text-tertiary)]">
          How it works
        </p>
        <div>
          {steps.map((step, i) => (
            <div key={step.title}>
              <div className="flex gap-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#111] text-[12px] font-medium text-white">
                  {i + 1}
                </div>
                <div className="pb-1">
                  <p className="text-[15px] font-medium text-[var(--color-text-primary)]">{step.title}</p>
                  <p className="mt-1 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">{step.body}</p>
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className="ml-[13px] my-1 h-4 w-px bg-[var(--color-border-secondary)]" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="bg-[var(--color-background-secondary)] px-5 py-10">
        <p className="mb-5 text-[11px] uppercase tracking-[1.5px] text-[var(--color-text-tertiary)]">
          By the numbers
        </p>
        <div className="mb-4 grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4 text-center"
            >
              <p className="text-[26px] font-medium text-[#1a7a52]">{s.value}</p>
              <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-[18px]">
          <p className="mb-[14px] text-[15px] italic leading-[1.65] text-[var(--color-text-primary)]">
            &ldquo;Used to spend an hour doing paperwork after jobs. Now the CP12 is signed and sent before I&apos;m back in the van.&rdquo;
          </p>
          <div className="flex items-center gap-3">
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#edf7f2] text-[12px] font-medium text-[#1a7a52]">
              JT
            </div>
            <div>
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">James T.</p>
              <p className="text-[12px] text-[var(--color-text-secondary)]">Gas Safe engineer, Manchester</p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="bg-[var(--color-background-primary)] px-5 py-10">
        <p className="mb-5 text-[11px] uppercase tracking-[1.5px] text-[var(--color-text-tertiary)]">
          How we compare
        </p>
        <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)]">
          {/* Header */}
          <div className="flex items-center border-b-[0.5px] border-[var(--color-border-tertiary)] px-4 py-3">
            <div className="flex-1" />
            <div className="w-[60px] text-center text-[12px] font-medium text-[var(--color-text-tertiary)]">Others</div>
            <div className="w-[60px] text-center text-[12px] font-medium text-[#1a7a52]">CertNow</div>
          </div>
          {comparisonRows.map((row, i) => (
            <div
              key={row.label}
              className={`flex items-center px-4 py-3 ${i < comparisonRows.length - 1 ? "border-b-[0.5px] border-[var(--color-border-tertiary)]" : ""}`}
            >
              <div className="flex-1 text-[13px] text-[var(--color-text-secondary)]">{row.label}</div>
              <div className="flex w-[60px] justify-center">
                {row.others ? (
                  <span className="text-[#1a7a52]"><IconCheck size={15} /></span>
                ) : (
                  <span className="text-[13px] text-[var(--color-text-tertiary)]">—</span>
                )}
              </div>
              <div className="flex w-[60px] justify-center">
                {row.us ? (
                  <span className="text-[#1a7a52]"><IconCheck size={15} /></span>
                ) : (
                  <span className="text-[13px] text-[var(--color-text-tertiary)]">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-[var(--color-background-secondary)] px-5 py-10">
        <p className="mb-5 text-[11px] uppercase tracking-[1.5px] text-[var(--color-text-tertiary)]">
          Simple pricing
        </p>
        <div className="rounded-[16px] bg-[#111] p-6">
          <p className="mb-2 text-[11px] uppercase tracking-[1px] text-[#888]">Solo engineer</p>
          <div className="mb-1 flex items-baseline gap-1">
            <span className="text-[38px] font-medium text-white">£12.99</span>
            <span className="text-[16px] text-[#888]">/month</span>
          </div>
          <p className="mb-5 text-[14px] leading-[1.6] text-[#aaa]">
            Unlimited certificates, reminders, and storage. Cancel any time.
          </p>
          <div className="mb-5">
            {pricingItems.map((item, i) => (
              <div
                key={item}
                className={`flex items-start gap-3 py-3 ${i < pricingItems.length - 1 ? "border-b-[0.5px] border-[#222]" : ""}`}
              >
                <span className="mt-[1px] shrink-0 text-[#1a7a52]"><IconCheck size={14} /></span>
                <span className="text-[13px] text-[#ccc]">{item}</span>
              </div>
            ))}
          </div>
          <Link
            href="/signup/step1"
            className="flex h-12 w-full items-center justify-center rounded-[26px] bg-[#1a7a52] text-[15px] font-medium text-white"
          >
            Start free trial
          </Link>
        </div>
        <p className="mt-4 text-center text-[12px] text-[var(--color-text-tertiary)]">
          No card required. Full access from day one.
        </p>
      </section>

      {/* Final CTA */}
      <section className="bg-[var(--color-background-secondary)] px-5 py-11 text-center">
        <h2 className="mb-[10px] text-[24px] font-medium tracking-[-0.3px] text-[var(--color-text-primary)]">
          Stop doing paperwork tonight.
        </h2>
        <p className="mx-auto mb-6 max-w-[320px] text-[14px] leading-[1.6] text-[var(--color-text-secondary)]">
          Join Gas Safe engineers who finish their CP12s on site and send a professional certificate before they drive away.
        </p>
        <Link
          href="/signup/step1"
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[28px] bg-[#111] text-[16px] font-medium text-white"
        >
          Start free trial — free to try
          <IconArrowRight />
        </Link>
        <p className="mt-4 text-[13px] text-[var(--color-text-secondary)]">
          Already have an account?{" "}
          <Link href="/login" className="text-[#1a7a52]">
            Sign in
          </Link>
        </p>
      </section>
    </>
  );
}

function LandlordsContent() {
  return (
    <section className="flex flex-col items-center px-5 py-[60px] text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-background-secondary)]">
        <IconBuilding size={24} />
      </div>
      <h2 className="mb-3 text-[18px] font-medium text-[var(--color-text-primary)]">
        Coming soon for landlords
      </h2>
      <p className="max-w-[300px] text-[14px] leading-[1.6] text-[var(--color-text-secondary)]">
        Your compliance dashboard is on its way. Engineers using CertNow will share your certificates here automatically.
      </p>
    </section>
  );
}

export function LandingTabs() {
  const [active, setActive] = useState<Tab>("engineers");

  return (
    <>
      {/* Tab bar */}
      <div className="sticky top-[56px] z-20 border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
        <div className="flex">
          {(["engineers", "landlords"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActive(tab)}
              className={`flex flex-1 h-12 items-center justify-center gap-[6px] text-[14px] transition-colors ${
                active === tab
                  ? "border-b-2 border-[#1a7a52] font-medium text-[#1a7a52]"
                  : "text-[var(--color-text-tertiary)]"
              }`}
            >
              {tab === "engineers" ? <IconTool /> : <IconBuilding />}
              {tab === "engineers" ? "For engineers" : "For landlords"}
            </button>
          ))}
        </div>
      </div>

      {active === "engineers" ? <EngineersContent /> : <LandlordsContent />}
    </>
  );
}
