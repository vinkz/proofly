import 'server-only';

/**
 * Stamp a document as a sample.
 *
 * The one place a watermark belongs. Real output from the free tools must never
 * carry one — a crippled document is worse than no tool — but a sample must
 * never be mistakable for a real record either, which is the same principle
 * pointing the other way.
 *
 * Applied after rendering so a sample goes through exactly the same renderer as
 * a real document and cannot drift from the template.
 */
export async function watermarkAsSample(bytes: Uint8Array): Promise<Uint8Array> {
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
    page.drawText('Example only — not a valid record', {
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
