import { describe, expect, it, vi } from 'vitest';

import { pdfSafeText } from '@/lib/pdf-text';

/**
 * The renderers draw with WinAnsi-encoded standard fonts, and pdf-lib throws on
 * any character it cannot encode. That exception failed the entire render, so
 * an engineer called Paweł or Šarūnas could fill in a whole certificate and get
 * nothing back — on the free tools and in the paid wizard alike.
 */
vi.mock('@/lib/supabaseServer', () => ({
  supabaseServerServiceRole: async () => {
    throw new Error('renderers must not need the database here');
  },
}));

describe('pdfSafeText', () => {
  it('leaves text the standard fonts can already draw completely untouched', () => {
    // Accented names common in the UK are inside WinAnsi and must not be folded.
    for (const value of ['Renée Ødegård', 'Ahmet Çelik', 'Müller & Sons', 'naïve café', '£1,234.56 — ok']) {
      expect(pdfSafeText(value)).toBe(value);
    }
  });

  it('folds letters that carry a stroke and do not decompose', () => {
    expect(pdfSafeText('Paweł Kowalski')).toBe('Pawel Kowalski');
    expect(pdfSafeText('Đorđe')).toBe('Dorde');
  });

  it('strips combining marks only from letters WinAnsi cannot hold', () => {
    // Š is a WinAnsi special (0x8A) so it survives; ū is not, so it folds.
    expect(pdfSafeText('Šarūnas')).toBe('Šarunas');
    expect(pdfSafeText('Ștefan Popescu')).toBe('Stefan Popescu');
    // Ł has no decomposition and is mapped; ó is Latin-1 and is kept.
    expect(pdfSafeText('Łukasz Wójcik')).toBe('Lukasz Wójcik');
  });

  it('falls back to a placeholder only where nothing can be represented', () => {
    expect(pdfSafeText('李伟')).toBe('??');
    // And does not take neighbouring text with it.
    expect(pdfSafeText('Flat 2 李 Road')).toBe('Flat 2 ? Road');
  });

  it('handles empty and nullish input', () => {
    expect(pdfSafeText(null)).toBe('');
    expect(pdfSafeText(undefined)).toBe('');
    expect(pdfSafeText('')).toBe('');
  });
});

describe('renderers survive names the standard fonts cannot encode', () => {
  const NASTY = 'Paweł Ștefan Šarūnas 李伟';

  it('renders a CP12 and its warning notice', async () => {
    const { buildCp12RenderInput } = await import('@/lib/cp12/buildCp12Render');
    const { FreeCp12PayloadSchema, freeCp12ToRenderSource } = await import('@/lib/cp12/freeCp12Payload');
    const { renderCp12CertificatePdf } = await import('@/server/pdf/renderCp12Certificate');

    const payload = FreeCp12PayloadSchema.parse({
      fields: {
        inspection_date: '2026-07-28',
        job_address_line1: NASTY,
        landlord_name: NASTY,
        engineer_name: NASTY,
        company_name: NASTY,
        defect_description: NASTY,
      },
      appliances: [{ appliance_type: 'boiler', location: NASTY, make: NASTY, model: NASTY }],
    });

    const bytes = await renderCp12CertificatePdf(
      buildCp12RenderInput(
        freeCp12ToRenderSource(payload, { recordId: 'R', certNumber: 'R', issuedAt: new Date('2026-07-28') }),
      ),
    );
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('renders a boiler service record', async () => {
    const { FreeBoilerServiceSchema, freeBoilerServiceToRenderInput } = await import(
      '@/lib/boiler-service/freeBoilerServicePayload'
    );
    const { renderGasServicePdf } = await import('@/server/pdf/renderGasServicePdf');

    const payload = FreeBoilerServiceSchema.parse({
      service_date: '2026-07-28',
      job_address_line1: NASTY,
      customer_name: NASTY,
      engineer_name: NASTY,
      boiler_make: NASTY,
      boiler_model: NASTY,
      boiler_location: NASTY,
      engineer_comments: NASTY,
    });

    const bytes = await renderGasServicePdf(
      freeBoilerServiceToRenderInput(payload, {
        recordId: 'R',
        certNumber: 'R',
        issuedAt: new Date('2026-07-28'),
      }),
    );
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('renders a gas warning notice', async () => {
    const { renderGasWarningNoticeV2Pdf } = await import('@/server/pdf/renderGasWarningNoticeV2');

    const bytes = await renderGasWarningNoticeV2Pdf({
      fields: {
        property_address: NASTY,
        customer_name: NASTY,
        appliance_location: NASTY,
        appliance_type: NASTY,
        make_model: NASTY,
        classification: 'IMMEDIATELY_DANGEROUS',
        unsafe_situation_description: NASTY,
        actions_taken: NASTY,
        engineer_name: NASTY,
        gas_safe_number: '123456',
        record_id: 'R',
      },
      issuedAt: '2026-07-28T00:00:00Z',
      recordId: 'R',
    });
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-');
  });
});
