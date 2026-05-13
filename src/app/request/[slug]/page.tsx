import Image from 'next/image';
import { notFound } from 'next/navigation';

import { RequestJobClient } from '@/app/request-job/request-job-client';
import { getEngineerRequestProfileBySlug } from '@/server/job-requests';

export default async function EngineerRequestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const engineer = await getEngineerRequestProfileBySlug(slug);
  if (!engineer) notFound();
  const engineerName = engineer.engineerName ?? engineer.companyName ?? 'your engineer';

  return (
    <main className="min-h-screen bg-[var(--muted)] px-4 py-6 text-gray-900 sm:px-6">
      <section className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-2xl border border-white/10 bg-[var(--surface)]/90 p-6 shadow-md backdrop-blur">
          <Image src="/certnow-logo.svg" alt="certnow" width={150} height={34} priority />
          <h1 className="mt-4 text-3xl font-bold text-[var(--brand)]">
            Request a gas safety visit
          </h1>
          <p className="mt-2 text-sm text-muted-foreground/80">
            Fill in your property details below and {engineerName} will be in touch to confirm.
          </p>
          <p className="mt-1 text-sm text-muted-foreground/80">
            No account needed.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/95 p-6 shadow">
          <RequestJobClient scopedEngineer={engineer} />
        </div>
      </section>
    </main>
  );
}
