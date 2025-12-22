import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import type { Cp12Appliance } from '@/types/certificates';

export const CP12_TEMPLATE_COORDS = {
  fields: {
    property_address: { x: 28, y: 540, width: 380, size: 11 },
    postcode: { x: 438, y: 540, width: 160, size: 11 },
    inspection_date: { x: 628, y: 540, width: 170, size: 11 },
    landlord_name: { x: 28, y: 480, width: 380, size: 11 },
    landlord_address: { x: 438, y: 480, width: 360, size: 11 },
    engineer_name: { x: 28, y: 420, width: 270, size: 11 },
    gas_safe_number: { x: 338, y: 420, width: 140, size: 11 },
    company_name: { x: 508, y: 420, width: 290, size: 11 },
    issued_at: { x: 526, y: 28, width: 126, size: 10 },
    record_id: { x: 676, y: 28, width: 130, size: 10 },
    next_inspection_due: { x: 438, y: 100, width: 170, size: 10 },
    warning_notice_issued: { x: 638, y: 100, width: 170, size: 10 },
  },
  textBlocks: {
    defects: { x: 28, y: 172, width: 380, lineHeight: 12, maxLines: 4 },
    remedial_action: { x: 438, y: 172, width: 360, lineHeight: 12, maxLines: 4 },
    comments: { x: 28, y: 102, width: 380, lineHeight: 12, maxLines: 4 },
  },
  checks: {
    gas_tightness: { x: 32, y: 218 },
    co_alarm_fitted: { x: 302, y: 218 },
    co_alarm_tested: { x: 572, y: 218 },
    reg_26_9_confirmed: { x: 32, y: 186 },
  },
  signatures: {
    engineer: { x: 28, y: 16, width: 220, height: 32 },
    customer: { x: 278, y: 16, width: 220, height: 32 },
  },
  table: {
    startY: 312,
    rowHeight: 28,
    maxRows: 6,
    columns: [
      { key: 'index', x: 26, width: 44 },
      { key: 'location', x: 74, width: 90 },
      { key: 'appliance_type', x: 174, width: 62 },
      { key: 'make_model', x: 244, width: 72 },
      { key: 'flue_type', x: 324, width: 52 },
      { key: 'operating_pressure', x: 384, width: 52 },
      { key: 'heat_input', x: 444, width: 52 },
      { key: 'flue_condition', x: 504, width: 52 },
      { key: 'ventilation', x: 564, width: 52 },
      { key: 'combustion', x: 624, width: 68 },
      { key: 'safety', x: 704, width: 108 },
    ],
  },
} as const;

const CP12_X_OFFSET = 10;
const CP12_Y_OFFSET = 8;

type RenderCp12TemplateInput = {
  fieldMap: Record<string, unknown>;
  appliances: Cp12Appliance[];
  issuedAt: string;
  recordId?: string;
};

type Cp12ApplianceExtras = {
  description?: string;
  appliance_make_model?: string;
  combustion_reading?: string;
  co2_percent?: string;
};

const toText = (val: unknown) => {
  if (val === null || val === undefined) return '';
  return String(val).trim();
};

const isTruthy = (val: unknown) => {
  if (val === true) return true;
  if (typeof val === 'string') {
    const lower = val.toLowerCase();
    return ['yes', 'y', 'true', '1', 'ok', 'pass', 'satisfactory', 'safe'].some((token) => lower.includes(token));
  }
  return false;
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
    const x = box.x + CP12_X_OFFSET + (box.width - dims.width) / 2;
    const y = box.y + CP12_Y_OFFSET + (box.height - dims.height) / 2;
    page.drawImage(image, { x, y, width: dims.width, height: dims.height });
  } catch {
    // swallow fetch/embed errors; template rendering continues
  }
}

function drawCp12StaticLayout(page: PDFPage, font: PDFFont, bold: PDFFont) {
  // Header
  page.drawText('Gas Safety Record (CP12)', {
    x: 28 + CP12_X_OFFSET,
    y: 560 + CP12_Y_OFFSET,
    size: 14,
    font: bold,
    color: rgb(0, 0, 0),
  });

  // Property / Correspondence boxes
  page.drawRectangle({
    x: 24 + CP12_X_OFFSET,
    y: 468 + CP12_Y_OFFSET,
    width: 400,
    height: 80,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
    color: undefined,
  });
  page.drawText('Landlord / Owner', { x: 28 + CP12_X_OFFSET, y: 540 + CP12_Y_OFFSET, size: 9, font, color: rgb(0, 0, 0) });
  page.drawText('Property Address', { x: 28 + CP12_X_OFFSET, y: 524 + CP12_Y_OFFSET, size: 9, font, color: rgb(0, 0, 0) });

  page.drawRectangle({
    x: 432 + CP12_X_OFFSET,
    y: 468 + CP12_Y_OFFSET,
    width: 360,
    height: 80,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
    color: undefined,
  });
  page.drawText('Correspondence Address', { x: 438 + CP12_X_OFFSET, y: 540 + CP12_Y_OFFSET, size: 9, font, color: rgb(0, 0, 0) });

  // Engineer info
  page.drawRectangle({
    x: 24 + CP12_X_OFFSET,
    y: 408 + CP12_Y_OFFSET,
    width: 744,
    height: 52,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
    color: undefined,
  });
  page.drawText('Gas Safe Engineer Details', {
    x: 28 + CP12_X_OFFSET,
    y: 444 + CP12_Y_OFFSET,
    size: 9,
    font,
    color: rgb(0, 0, 0),
  });

  // Appliance table grid
  const table = CP12_TEMPLATE_COORDS.table;
  const tableTopY = table.startY + 18;
  const tableBottomY = table.startY - table.rowHeight * table.maxRows;
  page.drawLine({
    start: { x: 24 + CP12_X_OFFSET, y: tableTopY + CP12_Y_OFFSET },
    end: { x: 748 + CP12_X_OFFSET, y: tableTopY + CP12_Y_OFFSET },
    thickness: 1,
  });
  for (let i = 0; i <= table.maxRows; i++) {
    const y = table.startY - i * table.rowHeight;
    page.drawLine({
      start: { x: 24 + CP12_X_OFFSET, y: y + CP12_Y_OFFSET },
      end: { x: 748 + CP12_X_OFFSET, y: y + CP12_Y_OFFSET },
      thickness: 0.5,
    });
  }
  page.drawLine({
    start: { x: 24 + CP12_X_OFFSET, y: tableTopY + CP12_Y_OFFSET },
    end: { x: 24 + CP12_X_OFFSET, y: tableBottomY + CP12_Y_OFFSET },
    thickness: 1,
  });
  table.columns.forEach((col) => {
    const x = col.x + col.width + 2;
    page.drawLine({
      start: { x: x + CP12_X_OFFSET, y: tableTopY + CP12_Y_OFFSET },
      end: { x: x + CP12_X_OFFSET, y: tableBottomY + CP12_Y_OFFSET },
      thickness: 0.5,
    });
  });
  page.drawLine({
    start: { x: 748 + CP12_X_OFFSET, y: tableTopY + CP12_Y_OFFSET },
    end: { x: 748 + CP12_X_OFFSET, y: tableBottomY + CP12_Y_OFFSET },
    thickness: 1,
  });

  table.columns.forEach((col) => {
    page.drawText(col.key.toUpperCase(), {
      x: col.x + 2 + CP12_X_OFFSET,
      y: tableTopY + 4 + CP12_Y_OFFSET,
      size: 7,
      font,
      color: rgb(0, 0, 0),
    });
  });

  // Text block outlines
  const blocks = CP12_TEMPLATE_COORDS.textBlocks;
  page.drawRectangle({
    x: blocks.defects.x - 4 + CP12_X_OFFSET,
    y: blocks.defects.y - 8 + CP12_Y_OFFSET,
    width: blocks.defects.width + 8,
    height: blocks.defects.lineHeight * blocks.defects.maxLines + 12,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
    color: undefined,
  });
  page.drawText('Defects Identified', {
    x: blocks.defects.x + CP12_X_OFFSET,
    y: blocks.defects.y + blocks.defects.lineHeight * blocks.defects.maxLines + 2 + CP12_Y_OFFSET,
    size: 9,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawRectangle({
    x: blocks.remedial_action.x - 4 + CP12_X_OFFSET,
    y: blocks.remedial_action.y - 8 + CP12_Y_OFFSET,
    width: blocks.remedial_action.width + 8,
    height: blocks.remedial_action.lineHeight * blocks.remedial_action.maxLines + 12,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
    color: undefined,
  });
  page.drawText('Remedial Action Taken', {
    x: blocks.remedial_action.x + CP12_X_OFFSET,
    y: blocks.remedial_action.y + blocks.remedial_action.lineHeight * blocks.remedial_action.maxLines + 2 + CP12_Y_OFFSET,
    size: 9,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawRectangle({
    x: blocks.comments.x - 4 + CP12_X_OFFSET,
    y: blocks.comments.y - 8 + CP12_Y_OFFSET,
    width: blocks.comments.width + 8,
    height: blocks.comments.lineHeight * blocks.comments.maxLines + 12,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
    color: undefined,
  });
  page.drawText('Comments', {
    x: blocks.comments.x + CP12_X_OFFSET,
    y: blocks.comments.y + blocks.comments.lineHeight * blocks.comments.maxLines + 2 + CP12_Y_OFFSET,
    size: 9,
    font,
    color: rgb(0, 0, 0),
  });

  // Signatures
  const sigs = CP12_TEMPLATE_COORDS.signatures;
  page.drawRectangle({
    x: sigs.engineer.x + CP12_X_OFFSET,
    y: sigs.engineer.y + CP12_Y_OFFSET,
    width: sigs.engineer.width,
    height: sigs.engineer.height,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
    color: undefined,
  });
  page.drawText('Engineer Signature', {
    x: sigs.engineer.x + CP12_X_OFFSET,
    y: sigs.engineer.y + sigs.engineer.height + 4 + CP12_Y_OFFSET,
    size: 8,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawRectangle({
    x: sigs.customer.x + CP12_X_OFFSET,
    y: sigs.customer.y + CP12_Y_OFFSET,
    width: sigs.customer.width,
    height: sigs.customer.height,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
    color: undefined,
  });
  page.drawText('Client Signature', {
    x: sigs.customer.x + CP12_X_OFFSET,
    y: sigs.customer.y + sigs.customer.height + 4 + CP12_Y_OFFSET,
    size: 8,
    font,
    color: rgb(0, 0, 0),
  });
}

export async function renderCp12TemplatePdf({ fieldMap, appliances, issuedAt, recordId }: RenderCp12TemplateInput) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  drawCp12StaticLayout(page, font, bold);

  const writeField = (key: keyof typeof CP12_TEMPLATE_COORDS.fields, value: string | undefined) => {
    const coords = CP12_TEMPLATE_COORDS.fields[key];
    if (!coords) return;
    const safe = clampTextToWidth(value ?? '', coords.width, font, coords.size);
    if (!safe) return;
    page.drawText(safe, { x: coords.x + CP12_X_OFFSET, y: coords.y + CP12_Y_OFFSET, size: coords.size, font, color: rgb(0, 0, 0) });
  };

  const writeBlock = (key: keyof typeof CP12_TEMPLATE_COORDS.textBlocks, value: string | undefined) => {
    const block = CP12_TEMPLATE_COORDS.textBlocks[key];
    if (!block || !value) return;
    const lines = wrapTextToWidth(value, block.width, font, 10, block.maxLines, block.lineHeight);
    lines.forEach((line) => {
      page.drawText(line.text, {
        x: block.x + CP12_X_OFFSET,
        y: block.y + CP12_Y_OFFSET - line.offsetY,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
    });
  };

  const markCheck = (key: keyof typeof CP12_TEMPLATE_COORDS.checks, value: unknown) => {
    const coords = CP12_TEMPLATE_COORDS.checks[key];
    if (!coords) return;
    if (!isTruthy(value)) return;
    page.drawText('X', { x: coords.x + CP12_X_OFFSET, y: coords.y + CP12_Y_OFFSET, size: 12, font: bold, color: rgb(0, 0, 0) });
  };

  writeField('property_address', toText(fieldMap.property_address ?? fieldMap.address));
  writeField('postcode', toText(fieldMap.postcode));
  writeField('inspection_date', toText(fieldMap.inspection_date ?? fieldMap.scheduled_for));
  writeField('landlord_name', toText(fieldMap.landlord_name ?? fieldMap.customer_name));
  writeField('landlord_address', toText(fieldMap.landlord_address ?? fieldMap.address));
  writeField('engineer_name', toText(fieldMap.engineer_name));
  writeField('gas_safe_number', toText(fieldMap.gas_safe_number));
  writeField('company_name', toText(fieldMap.company_name ?? fieldMap.customer_name));
  writeField('issued_at', new Date(issuedAt).toLocaleDateString());
  writeField('record_id', recordId ?? '');
  writeField('next_inspection_due', toText(fieldMap.next_inspection_due ?? fieldMap.next_inspection_date ?? fieldMap.completion_date));
  writeField('warning_notice_issued', toText(fieldMap.warning_notice_issued));

  writeBlock('defects', toText(fieldMap.defect_description));
  writeBlock('remedial_action', toText(fieldMap.remedial_action));
  writeBlock('comments', toText(fieldMap.comments ?? fieldMap.notes ?? fieldMap.additional_notes));

  markCheck('gas_tightness', fieldMap.gas_tightness_test ?? fieldMap.gas_tightness_satisfactory);
  markCheck('co_alarm_fitted', fieldMap.co_alarm_fitted);
  markCheck('co_alarm_tested', fieldMap.co_alarm_tested);
  markCheck('reg_26_9_confirmed', fieldMap.reg_26_9_confirmed);

  const table = CP12_TEMPLATE_COORDS.table;
  const rows = (appliances ?? []).slice(0, table.maxRows);
  rows.forEach((app, idx) => {
    const appliance = app as Cp12Appliance & Cp12ApplianceExtras;
    const rowY = table.startY - idx * table.rowHeight;
    const textY = rowY + 8;
    const cells: Record<string, string> = {
      index: `${idx + 1}`,
      location: toText(app.location),
      appliance_type: toText(appliance.description ?? app.appliance_type),
      make_model: toText(app.make_model ?? appliance.appliance_make_model),
      flue_type: toText(app.flue_type ?? app.ventilation_provision),
      operating_pressure: toText(app.operating_pressure),
      heat_input: toText(app.heat_input),
      flue_condition: toText(app.flue_condition ?? app.stability_test),
      ventilation: toText(app.ventilation_satisfactory ?? app.ventilation_provision),
      combustion: toText(app.co_reading_ppm ?? appliance.combustion_reading ?? appliance.co2_percent),
      safety: toText([app.safety_rating, app.classification_code].filter((s) => s && String(s).trim()).join(' / ')),
    };
    table.columns.forEach((col) => {
      const raw = cells[col.key] ?? '';
      if (!raw) return;
      const safe = clampTextToWidth(raw, col.width, font, 10);
      page.drawText(safe, {
        x: col.x + CP12_X_OFFSET,
        y: textY + CP12_Y_OFFSET,
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
    box: CP12_TEMPLATE_COORDS.signatures.engineer,
  });
  await embedSignatureImage({
    page,
    pdfDoc,
    url: toText(fieldMap.customer_signature),
    box: CP12_TEMPLATE_COORDS.signatures.customer,
  });

  return pdfDoc.save();
}
