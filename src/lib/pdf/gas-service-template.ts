import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import type { Cp12Appliance } from '@/types/certificates';

const GS_X_OFFSET = 10;
const GS_Y_OFFSET = 8;

export const GAS_SERVICE_RECORD_COORDS = {
  fields: {
    property_address: { x: 28, y: 540, width: 380, size: 11 },
    postcode: { x: 438, y: 540, width: 160, size: 11 },
    service_date: { x: 628, y: 540, width: 170, size: 11 },
    customer_name: { x: 28, y: 480, width: 380, size: 11 },
    customer_address: { x: 438, y: 480, width: 360, size: 11 },
    engineer_name: { x: 28, y: 420, width: 270, size: 11 },
    gas_safe_number: { x: 338, y: 420, width: 140, size: 11 },
    company_name: { x: 508, y: 420, width: 290, size: 11 },
    issued_at: { x: 526, y: 28, width: 126, size: 10 },
    record_id: { x: 676, y: 28, width: 130, size: 10 },
    next_service_due: { x: 438, y: 100, width: 170, size: 10 },
  },
  textBlocks: {
    service_summary: { x: 28, y: 172, width: 380, lineHeight: 12, maxLines: 4 },
    recommendations: { x: 438, y: 172, width: 360, lineHeight: 12, maxLines: 4 },
    comments: { x: 28, y: 102, width: 380, lineHeight: 12, maxLines: 4 },
  },
  signatures: {
    engineer: { x: 28, y: 16, width: 220, height: 32 },
    customer: { x: 278, y: 16, width: 220, height: 32 },
  },
  table: {
    startY: 312,
    rowHeight: 28,
    maxRows: 4,
    columns: [
      { key: 'index', x: 26, width: 44 },
      { key: 'location', x: 74, width: 120 },
      { key: 'boiler_type', x: 204, width: 100 },
      { key: 'make_model', x: 304, width: 140 },
      { key: 'operating_pressure', x: 444, width: 80 },
      { key: 'flue_check', x: 524, width: 80 },
      { key: 'safety', x: 604, width: 208 },
    ],
  },
} as const;

export type RenderGasServiceRecordInput = {
  fieldMap: Record<string, unknown>;
  appliances: Cp12Appliance[];
  issuedAt: string;
  recordId?: string;
  previewMode?: boolean;
};

const toText = (val: unknown) => {
  if (val === null || val === undefined) return '';
  return String(val).trim();
};

function clampTextToWidth(text: string, width: number, font: PDFFont, size: number) {
  let value = text;
  const ellipsis = '…';
  while (value && font.widthOfTextAtSize(value, size) > width) {
    value = value.slice(0, -1);
  }
  if (value !== text && value.length > 2) {
    while (value && font.widthOfTextAtSize(`${value}${ellipsis}`, size) > width) {
      value = value.slice(0, -1);
    }
    value = `${value}${ellipsis}`;
  }
  return value;
}

function wrapTextToWidth(text: string, width: number, font: PDFFont, size: number, maxLines: number, lineHeight: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let current = '';
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = clampTextToWidth(word, width, font, size);
    }
  });
  if (current) lines.push(current);
  return lines.slice(0, maxLines).map((line, idx) => ({
    text: line,
    offsetY: idx * lineHeight,
  }));
}

async function embedSignatureImage(params: {
  page: PDFPage;
  pdfDoc: PDFDocument;
  url?: string;
  box: { x: number; y: number; width: number; height: number };
}) {
  const { page, pdfDoc, url, box } = params;
  if (!url) return;
  try {
    const response = await fetch(url);
    if (!response.ok) return;
    const arrayBuffer = await response.arrayBuffer();
    const mime = (response.headers.get('content-type') ?? '').toLowerCase();
    let image;
    if (mime.includes('png')) {
      image = await pdfDoc.embedPng(arrayBuffer);
    } else {
      image = await pdfDoc.embedJpg(arrayBuffer);
    }
    const dims = image.scaleToFit(box.width - 6, box.height - 6);
    const x = box.x + GS_X_OFFSET + (box.width - dims.width) / 2;
    const y = box.y + GS_Y_OFFSET + (box.height - dims.height) / 2;
    page.drawImage(image, { x, y, width: dims.width, height: dims.height });
  } catch {
    // swallow fetch/embed errors; template rendering continues
  }
}

function drawBoilerServiceRecordStaticLayout(page: PDFPage, font: PDFFont, bold: PDFFont) {
  // Header
  page.drawText('Boiler Service Record', {
    x: 28 + GS_X_OFFSET,
    y: 560 + GS_Y_OFFSET,
    size: 14,
    font: bold,
    color: rgb(0, 0, 0),
  });

  // Customer / property boxes
  page.drawRectangle({
    x: 24 + GS_X_OFFSET,
    y: 468 + GS_Y_OFFSET,
    width: 400,
    height: 80,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
    color: undefined,
  });
  page.drawText('Customer / Landlord', {
    x: 28 + GS_X_OFFSET,
    y: 540 + GS_Y_OFFSET,
    size: 9,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText('Property Address', {
    x: 28 + GS_X_OFFSET,
    y: 524 + GS_Y_OFFSET,
    size: 9,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawRectangle({
    x: 432 + GS_X_OFFSET,
    y: 468 + GS_Y_OFFSET,
    width: 360,
    height: 80,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
    color: undefined,
  });
  page.drawText('Correspondence Address', {
    x: 438 + GS_X_OFFSET,
    y: 540 + GS_Y_OFFSET,
    size: 9,
    font,
    color: rgb(0, 0, 0),
  });

  // Engineer info
  page.drawRectangle({
    x: 24 + GS_X_OFFSET,
    y: 408 + GS_Y_OFFSET,
    width: 744,
    height: 52,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
    color: undefined,
  });
  page.drawText('Gas Safe Engineer Details', {
    x: 28 + GS_X_OFFSET,
    y: 444 + GS_Y_OFFSET,
    size: 9,
    font,
    color: rgb(0, 0, 0),
  });

  // Appliance table grid
  const table = GAS_SERVICE_RECORD_COORDS.table;
  const tableTopY = table.startY + 18;
  const tableBottomY = table.startY - table.rowHeight * table.maxRows;
  page.drawLine({
    start: { x: 24 + GS_X_OFFSET, y: tableTopY + GS_Y_OFFSET },
    end: { x: 748 + GS_X_OFFSET, y: tableTopY + GS_Y_OFFSET },
    thickness: 1,
  });
  for (let i = 0; i <= table.maxRows; i++) {
    const y = table.startY - i * table.rowHeight;
    page.drawLine({
      start: { x: 24 + GS_X_OFFSET, y: y + GS_Y_OFFSET },
      end: { x: 748 + GS_X_OFFSET, y: y + GS_Y_OFFSET },
      thickness: 0.5,
    });
  }
  page.drawLine({
    start: { x: 24 + GS_X_OFFSET, y: tableTopY + GS_Y_OFFSET },
    end: { x: 24 + GS_X_OFFSET, y: tableBottomY + GS_Y_OFFSET },
    thickness: 1,
  });
  table.columns.forEach((col) => {
    const x = col.x + col.width + 2;
    page.drawLine({
      start: { x: x + GS_X_OFFSET, y: tableTopY + GS_Y_OFFSET },
      end: { x: x + GS_X_OFFSET, y: tableBottomY + GS_Y_OFFSET },
      thickness: 0.5,
    });
  });
  page.drawLine({
    start: { x: 748 + GS_X_OFFSET, y: tableTopY + GS_Y_OFFSET },
    end: { x: 748 + GS_X_OFFSET, y: tableBottomY + GS_Y_OFFSET },
    thickness: 1,
  });

  table.columns.forEach((col) => {
    page.drawText(col.key.toUpperCase(), {
      x: col.x + 2 + GS_X_OFFSET,
      y: tableTopY + 4 + GS_Y_OFFSET,
      size: 7,
      font,
      color: rgb(0, 0, 0),
    });
  });

  // Text block outlines
  const blocks = GAS_SERVICE_RECORD_COORDS.textBlocks;
  page.drawRectangle({
    x: blocks.service_summary.x - 4 + GS_X_OFFSET,
    y: blocks.service_summary.y - 8 + GS_Y_OFFSET,
    width: blocks.service_summary.width + 8,
    height: blocks.service_summary.lineHeight * blocks.service_summary.maxLines + 12,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
    color: undefined,
  });
  page.drawText('Service Summary', {
    x: blocks.service_summary.x + GS_X_OFFSET,
    y: blocks.service_summary.y + blocks.service_summary.lineHeight * blocks.service_summary.maxLines + 2 + GS_Y_OFFSET,
    size: 9,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawRectangle({
    x: blocks.recommendations.x - 4 + GS_X_OFFSET,
    y: blocks.recommendations.y - 8 + GS_Y_OFFSET,
    width: blocks.recommendations.width + 8,
    height: blocks.recommendations.lineHeight * blocks.recommendations.maxLines + 12,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
    color: undefined,
  });
  page.drawText('Recommendations / Further Work', {
    x: blocks.recommendations.x + GS_X_OFFSET,
    y: blocks.recommendations.y + blocks.recommendations.lineHeight * blocks.recommendations.maxLines + 2 + GS_Y_OFFSET,
    size: 9,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawRectangle({
    x: blocks.comments.x - 4 + GS_X_OFFSET,
    y: blocks.comments.y - 8 + GS_Y_OFFSET,
    width: blocks.comments.width + 8,
    height: blocks.comments.lineHeight * blocks.comments.maxLines + 12,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
    color: undefined,
  });
  page.drawText('Comments', {
    x: blocks.comments.x + GS_X_OFFSET,
    y: blocks.comments.y + blocks.comments.lineHeight * blocks.comments.maxLines + 2 + GS_Y_OFFSET,
    size: 9,
    font,
    color: rgb(0, 0, 0),
  });

  // Signatures
  const sigs = GAS_SERVICE_RECORD_COORDS.signatures;
  page.drawRectangle({
    x: sigs.engineer.x + GS_X_OFFSET,
    y: sigs.engineer.y + GS_Y_OFFSET,
    width: sigs.engineer.width,
    height: sigs.engineer.height,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
    color: undefined,
  });
  page.drawText('Engineer Signature', {
    x: sigs.engineer.x + GS_X_OFFSET,
    y: sigs.engineer.y + sigs.engineer.height + 4 + GS_Y_OFFSET,
    size: 8,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawRectangle({
    x: sigs.customer.x + GS_X_OFFSET,
    y: sigs.customer.y + GS_Y_OFFSET,
    width: sigs.customer.width,
    height: sigs.customer.height,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
    color: undefined,
  });
  page.drawText('Customer Signature', {
    x: sigs.customer.x + GS_X_OFFSET,
    y: sigs.customer.y + sigs.customer.height + 4 + GS_Y_OFFSET,
    size: 8,
    font,
    color: rgb(0, 0, 0),
  });
}

export async function renderGasServiceRecordTemplatePdf({
  fieldMap,
  appliances,
  issuedAt,
  recordId,
}: RenderGasServiceRecordInput) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  drawBoilerServiceRecordStaticLayout(page, font, bold);

  const writeField = (key: keyof typeof GAS_SERVICE_RECORD_COORDS.fields, value?: string) => {
    const coords = GAS_SERVICE_RECORD_COORDS.fields[key];
    if (!coords) return;
    const safe = clampTextToWidth(value ?? '', coords.width, font, coords.size);
    if (!safe) return;
    page.drawText(safe, {
      x: coords.x + GS_X_OFFSET,
      y: coords.y + GS_Y_OFFSET,
      size: coords.size,
      font,
      color: rgb(0, 0, 0),
    });
  };

  const writeBlock = (key: keyof typeof GAS_SERVICE_RECORD_COORDS.textBlocks, value?: string) => {
    const block = GAS_SERVICE_RECORD_COORDS.textBlocks[key];
    if (!block || !value) return;
    const lines = wrapTextToWidth(value, block.width, font, 10, block.maxLines, block.lineHeight);
    lines.forEach((line) => {
      page.drawText(line.text, {
        x: block.x + GS_X_OFFSET,
        y: block.y + GS_Y_OFFSET - line.offsetY,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
    });
  };

  writeField('property_address', toText(fieldMap.property_address ?? fieldMap.address));
  writeField('postcode', toText(fieldMap.postcode));
  writeField('service_date', toText((fieldMap as any).service_date ?? fieldMap.inspection_date ?? fieldMap.scheduled_for));
  writeField('customer_name', toText(fieldMap.customer_name));
  writeField('customer_address', toText((fieldMap as any).customer_address ?? fieldMap.address));
  writeField('engineer_name', toText(fieldMap.engineer_name));
  writeField('gas_safe_number', toText(fieldMap.gas_safe_number));
  writeField('company_name', toText(fieldMap.company_name));
  writeField('issued_at', new Date(issuedAt).toLocaleDateString());
  writeField('record_id', recordId ?? '');
  writeField('next_service_due', toText((fieldMap as any).next_service_due));

  writeBlock('service_summary', toText((fieldMap as any).service_summary));
  writeBlock('recommendations', toText((fieldMap as any).recommendations));
  writeBlock('comments', toText((fieldMap as any).comments));

  const table = GAS_SERVICE_RECORD_COORDS.table;
  const rows = (appliances ?? []).slice(0, table.maxRows);
  rows.forEach((app, idx) => {
    const rowY = table.startY - idx * table.rowHeight;
    const textY = rowY + 8;
    const cells: Record<string, string> = {
      index: `${idx + 1}`,
      location: toText(app.location),
      boiler_type: toText((app as any).boiler_type ?? app.appliance_type),
      make_model: toText(app.make_model ?? (app as any).appliance_make_model),
      operating_pressure: toText(app.operating_pressure),
      flue_check: toText((app as any).flue_check ?? app.flue_condition),
      safety: toText(app.safety_rating ?? app.classification_code),
    };
    table.columns.forEach((col) => {
      const raw = cells[col.key] ?? '';
      if (!raw) return;
      const safe = clampTextToWidth(raw, col.width, font, 10);
      page.drawText(safe, {
        x: col.x + GS_X_OFFSET,
        y: textY + GS_Y_OFFSET,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
    });
  });

  await embedSignatureImage({
    page,
    pdfDoc,
    url: toText(fieldMap.engineer_signature),
    box: GAS_SERVICE_RECORD_COORDS.signatures.engineer,
  });
  await embedSignatureImage({
    page,
    pdfDoc,
    url: toText(fieldMap.customer_signature),
    box: GAS_SERVICE_RECORD_COORDS.signatures.customer,
  });

  return pdfDoc.save();
}
