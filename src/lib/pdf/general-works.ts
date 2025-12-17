import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type GeneralWorksPdfInput = {
  fieldMap: Record<string, unknown>;
  photos: { category: string; file_url: string }[];
  issuedAt: string;
  previewMode?: boolean;
};

export async function renderGeneralWorksPdf({ fieldMap, photos, issuedAt, previewMode = false }: GeneralWorksPdfInput) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 36;
  const stroke = { borderColor: rgb(0.82, 0.85, 0.88), borderWidth: 1 };

  const subscriptMap: Record<string, string> = {
    '₀': '0',
    '₁': '1',
    '₂': '2',
    '₃': '3',
    '₄': '4',
    '₅': '5',
    '₆': '6',
    '₇': '7',
    '₈': '8',
    '₉': '9',
  };
  const toAscii = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const raw = String(value);
    let ascii = '';
    for (const char of raw) {
      if (subscriptMap[char]) {
        ascii += subscriptMap[char];
      } else if (char.charCodeAt(0) < 128) {
        ascii += char;
      } else {
        ascii += '?';
      }
    }
    return ascii.trim();
  };

  const getVal = (key: string, fallback = '') => {
    const val = toAscii(fieldMap[key]);
    if (val) return val;
    if (previewMode) return fallback;
    return '';
  };

  const createPage = () => pdfDoc.addPage([pageWidth, pageHeight]);
  let page = createPage();
  let y = pageHeight - margin;

  const ensureSpace = (minY: number, onBreak?: () => void) => {
    if (y <= minY) {
      page = createPage();
      y = pageHeight - margin;
      if (onBreak) onBreak();
    }
  };

  const drawHeading = (text: string, size = 12) => {
    page.drawText(text, { x: margin, y, size, font: bold });
    y -= size + 6;
  };

  const drawField = (label: string, value: string, width: number, height = 26) => {
    page.drawText(label, { x: margin, y, size: 9, font: bold });
    y -= height;
    page.drawRectangle({ x: margin, y, width, height, ...stroke, color: rgb(1, 1, 1) });
    if (value) {
      page.drawText(value, { x: margin + 6, y: y + 8, size: 10, font });
    } else if (previewMode) {
      page.drawText('Not provided', { x: margin + 6, y: y + 8, size: 10, font, color: rgb(0.6, 0.62, 0.66) });
    }
    y -= 10;
  };

  const drawFieldRow = (entries: { label: string; value: string; width: number; height?: number }[], extraSpacing = 4) => {
    const rowY = y;
    entries.forEach((entry, idx) => {
      const x = margin + (idx > 0 ? entries.slice(0, idx).reduce((acc, cur) => acc + cur.width + 12, 0) : 0);
      page.drawText(entry.label, { x, y: rowY, size: 9, font: bold });
      const boxY = rowY - (entry.height ?? 26);
      page.drawRectangle({
        x,
        y: boxY,
        width: entry.width,
        height: entry.height ?? 26,
        ...stroke,
        color: rgb(1, 1, 1),
      });
      const display = entry.value || (previewMode ? 'Not provided' : '');
      if (display) {
        page.drawText(display, { x: x + 6, y: boxY + 8, size: 10, font });
      }
    });
    y = rowY - (entries[0].height ?? 26) - extraSpacing;
  };

  const drawParagraph = (label: string, value: string, height = 60) => {
    page.drawText(label, { x: margin, y, size: 9, font: bold });
    y -= height;
    page.drawRectangle({ x: margin, y, width: pageWidth - margin * 2, height, ...stroke, color: rgb(1, 1, 1) });
    if (value) {
      const lines = value.split(/\r?\n/).filter(Boolean);
      let textY = y + height - 14;
      lines.forEach((line) => {
        page.drawText(line, { x: margin + 6, y: textY, size: 10, font });
        textY -= 12;
      });
    } else if (previewMode) {
      page.drawText('Not provided', { x: margin + 6, y: y + height / 2 - 4, size: 10, font, color: rgb(0.6, 0.62, 0.66) });
    }
    y -= 10;
  };

  drawHeading('General Works Report', 18);
  const logoSize = 16;
  // Slightly larger brand block so we can drop in custom logos later.
  page.drawText('certnow', { x: margin, y, size: logoSize, font: bold });
  page.drawText(`Issued: ${new Date(issuedAt).toLocaleString()}`, { x: pageWidth - margin - 200, y, size: 10, font });
  y -= logoSize + 8;

  drawHeading('Property / Customer');
  drawField('Property address', getVal('property_address', 'Not provided'), pageWidth - margin * 2);
  drawFieldRow(
    [
      { label: 'Postcode', value: getVal('postcode', ''), width: 160 },
      { label: 'Work date', value: getVal('work_date', ''), width: 180 },
    ],
    8,
  );
  drawFieldRow(
    [
      { label: 'Customer name', value: getVal('customer_name', ''), width: 200 },
      { label: 'Customer email', value: getVal('customer_email', ''), width: 200 },
      { label: 'Customer phone', value: getVal('customer_phone', ''), width: 160 },
    ],
    8,
  );

  ensureSpace(520, () => drawHeading('General Works Report — Continued'));
  drawHeading('Engineer & Company');
  drawFieldRow(
    [
      { label: 'Engineer name', value: getVal('engineer_name', 'Not provided'), width: 220 },
      { label: 'Company name', value: getVal('company_name', ''), width: 260 },
    ],
    10,
  );

  ensureSpace(420, () => drawHeading('General Works Report — Continued'));
  drawHeading('Work details');
  drawParagraph('Work summary', getVal('work_summary', 'Not provided'), 50);
  drawParagraph('Work completed', getVal('work_completed', 'Not provided'), 80);
  drawParagraph('Parts used', getVal('parts_used', previewMode ? '' : ''), 50);

  ensureSpace(300, () => drawHeading('General Works Report — Continued'));
  const defectsVal = toAscii(fieldMap.defects_found);
  drawFieldRow(
    [
      { label: 'Defects found', value: defectsVal || (previewMode ? 'Not provided' : ''), width: 180 },
      { label: 'Defect details', value: getVal('defects_details', ''), width: pageWidth - margin * 2 - 192 },
    ],
    10,
  );
  drawParagraph('Recommendations', getVal('recommendations', ''), 50);

  ensureSpace(220, () => drawHeading('General Works Report — Continued'));
  drawHeading('Invoice & follow up');
  drawFieldRow(
    [
      { label: 'Invoice amount', value: getVal('invoice_amount', ''), width: 180 },
      { label: 'Payment status', value: getVal('payment_status', ''), width: 180 },
      { label: 'Follow-up required', value: getVal('follow_up_required', ''), width: 140 },
      { label: 'Follow-up date', value: getVal('follow_up_date', ''), width: 140 },
    ],
    10,
  );

  ensureSpace(160, () => drawHeading('General Works Report — Continued'));
  drawHeading('Photos');
  if (photos.length) {
    const grouped = photos.reduce<Record<string, number>>((acc, photo) => {
      const key = toAscii(photo.category) || 'other';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    Object.entries(grouped).forEach(([category, count]) => {
      page.drawText(`${category}: ${count} photo(s)`, { x: margin, y, size: 10, font });
      y -= 14;
    });
  } else {
    page.drawText(previewMode ? 'No photos added yet' : 'No photos attached', { x: margin, y, size: 10, font, color: rgb(0.4, 0.42, 0.46) });
    y -= 14;
  }

  ensureSpace(80, () => drawHeading('General Works Report — Continued'));
  drawHeading('Signatures');
  drawFieldRow(
    [
      { label: 'Engineer signature', value: getVal('engineer_signature', 'On file'), width: pageWidth / 2 - margin },
      { label: 'Customer signature', value: getVal('customer_signature', 'On file'), width: pageWidth / 2 - margin },
    ],
    12,
  );
  page.drawText(`Issued at: ${new Date(issuedAt).toLocaleString()}`, { x: margin, y, size: 9, font });

  return pdfDoc.save();
}
