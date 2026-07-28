import { describe, expect, it } from 'vitest';

import { renderSampleBoilerService } from '@/server/free-boiler-service-sample';
import { renderSampleCp12 } from '@/server/free-cp12-sample';

/**
 * The samples are what a sceptical visitor looks at before spending five
 * minutes on a form, so they have to actually render — and they have to be
 * unmistakably samples, which is the one place a watermark belongs. Real output
 * from these tools must never carry one.
 */
const load = async (bytes: Uint8Array) => {
  const { PDFDocument } = await import('pdf-lib');
  return PDFDocument.load(bytes);
};

describe('free tool sample documents', () => {
  it.each([
    ['CP12', renderSampleCp12],
    ['boiler service', renderSampleBoilerService],
  ])('%s sample renders a real PDF', async (_name, render) => {
    const bytes = await render();
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(1500);
    expect((await load(bytes)).getPageCount()).toBeGreaterThan(0);
  });

  it.each([
    ['CP12', renderSampleCp12],
    ['boiler service', renderSampleBoilerService],
  ])('%s sample is byte-stable, so it can be cached', async (_name, render) => {
    // Fixed input and a fixed issue date. If this drifts the samples stop being
    // cacheable and start costing a render per visitor.
    const [a, b] = await Promise.all([render(), render()]);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('the real free output carries no sample marking', async () => {
    const { buildCp12RenderInput } = await import('@/lib/cp12/buildCp12Render');
    const { FreeCp12PayloadSchema, freeCp12ToRenderSource } = await import('@/lib/cp12/freeCp12Payload');
    const { renderCp12CertificatePdf } = await import('@/server/pdf/renderCp12Certificate');

    const payload = FreeCp12PayloadSchema.parse({
      fields: { inspection_date: '2026-07-28', engineer_name: 'A. Example' },
      appliances: [{ appliance_type: 'boiler', location: 'Kitchen' }],
    });
    const real = await renderCp12CertificatePdf(
      buildCp12RenderInput(
        freeCp12ToRenderSource(payload, { recordId: 'R', certNumber: 'R', issuedAt: new Date('2026-07-28') }),
      ),
    );
    const sample = await renderSampleCp12();

    // The watermark adds drawing operations, so a sample is materially larger
    // than the same document without one.
    expect(sample.length).toBeGreaterThan(real.length);
  });
});
