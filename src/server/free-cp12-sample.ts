import 'server-only';

import { buildCp12RenderInput } from '@/lib/cp12/buildCp12Render';
import { FreeCp12PayloadSchema, freeCp12ToRenderSource } from '@/lib/cp12/freeCp12Payload';
import { renderCp12CertificatePdf } from '@/server/pdf/renderCp12Certificate';

/**
 * A filled-in example CP12, so an engineer can see what they will get before
 * spending five minutes typing.
 *
 * Rendered through the same mapping and renderer as a real certificate — a
 * mocked-up screenshot would drift from the template the moment either changed,
 * and this is the page that has to earn the five minutes.
 *
 * Everything in it is obviously fictitious, and the sample is watermarked. That
 * is the one place a watermark belongs: the real output must never carry one,
 * and a sample must never be mistakable for a real record.
 */
const SAMPLE = FreeCp12PayloadSchema.parse({
  fields: {
    inspection_date: '2026-07-14',
    job_address_line1: '14 Sample Street',
    job_address_city: 'Manchester',
    job_postcode: 'M1 2AB',
    landlord_name: 'Example Lettings Ltd',
    landlord_company: 'Example Lettings Ltd',
    landlord_address_line1: '2 Specimen Road',
    landlord_city: 'Manchester',
    landlord_postcode: 'M2 3CD',
    landlord_tel: '0161 496 0000',
    engineer_name: 'A. Example',
    gas_safe_number: '000000',
    engineer_id_card_number: 'ID-0000',
    company_name: 'Example Gas Services',
    company_phone: '0161 496 0001',
    company_email: 'hello@example.invalid',
    co_alarm_fitted: 'Yes',
    co_alarm_tested: 'Yes',
    emergency_control_accessible: 'Yes',
    gas_tightness_satisfactory: 'pass',
    pipework_visual_satisfactory: 'pass',
  },
  appliances: [
    {
      appliance_type: 'boiler',
      appliance_subtype: 'combi',
      location: 'Kitchen',
      make: 'Worcester Bosch',
      model: 'Greenstar 25i',
      flue_type: 'Room sealed',
      operating_pressure: '20 mbar',
      heat_input: '24 kW',
      safety_devices_correct: 'pass',
      ventilation_satisfactory: 'pass',
      flue_condition: 'pass',
      flue_performance_test: 'pass',
      gas_tightness_test: 'pass',
      appliance_serviced: 'Yes',
      high_co_ppm: '12',
      high_co2: '9.1',
      high_ratio: '0.0013',
      low_co_ppm: '4',
      low_co2: '4.2',
      low_ratio: '0.0009',
      safety_classification: 'safe',
      reg_26_9_confirmed: true,
    },
    {
      appliance_type: 'hob_cooker',
      location: 'Kitchen',
      make: 'Bosch',
      model: 'PGP6B6B60',
      safety_devices_correct: 'pass',
      ventilation_satisfactory: 'pass',
      cooker_stability: 'pass',
      gas_tightness_test: 'pass',
      appliance_serviced: 'Yes',
      safety_classification: 'safe',
      reg_26_9_confirmed: true,
    },
  ],
});

/** Diagonal SAMPLE watermark, drawn over every page after the content. */
async function watermark(bytes: Uint8Array): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, degrees, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.load(bytes);
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    page.drawText('SAMPLE', {
      x: width * 0.12,
      y: height * 0.34,
      size: 110,
      font,
      color: rgb(0.85, 0.85, 0.85),
      opacity: 0.45,
      rotate: degrees(38),
    });
    page.drawText('Example only — not a valid gas safety record', {
      x: width * 0.12,
      y: height * 0.3,
      size: 12,
      font,
      color: rgb(0.6, 0.6, 0.6),
      opacity: 0.9,
      rotate: degrees(38),
    });
  }

  return new Uint8Array(await pdf.save());
}

export async function renderSampleCp12(): Promise<Uint8Array> {
  const bytes = await renderCp12CertificatePdf(
    buildCp12RenderInput(
      freeCp12ToRenderSource(SAMPLE, {
        recordId: 'SAMPLE',
        certNumber: 'SAMPLE',
        // Fixed date so the sample is byte-stable and cacheable.
        issuedAt: new Date('2026-07-14T09:00:00Z'),
      }),
    ),
  );
  return watermark(bytes);
}
