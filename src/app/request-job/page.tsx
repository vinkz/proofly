import Image from 'next/image';

import { RequestJobClient } from './request-job-client';

export default function RequestJobPage() {
  return (
    <main className="min-h-screen bg-[var(--color-background-secondary)] px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 px-0.5">
          <Image src="/certnow-logo.svg" alt="certnow" width={130} height={30} priority />
          <h1 className="mt-4 text-[22px] font-medium text-[var(--color-text-primary)]">
            Book a gas engineer
          </h1>
          <p className="mt-1 text-[14px] text-[var(--color-text-secondary)]">
            Request a gas safety check, boiler service, or both.
          </p>
        </div>
        <RequestJobClient />
      </div>
    </main>
  );
}
