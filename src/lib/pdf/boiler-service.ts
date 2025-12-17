import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type BoilerServicePdfInput = {
  fieldMap: Record<string, unknown>;
  issuedAt: string;
  previewMode?: boolean;
};

export async function renderBoilerServicePdf({ fieldMap, issuedAt, previewMode = false }: BoilerServicePdfInput) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 36;
  const stroke = {
    borderColor: rgb(0.82, 0.85, 0.88),
    borderWidth: 1,
  };

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

  const getVal = (key: string) => {
    const raw = fieldMap[key];
    if (typeof raw === 'string' || typeof raw === 'number') return toAscii(raw);
    return '';
  };
  const boolVal = (key: string) => {
    const raw = toAscii(fieldMap[key]);
    if (!raw) return '';
    const lowered = raw.toLowerCase();
    if (lowered === 'true' || lowered === 'yes' || lowered === 'y') return 'Yes';
    if (lowered === 'false' || lowered === 'no' || lowered === 'n') return 'No';
    return raw;
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
    } else if (!previewMode) {
      page.drawText('—', { x: margin + 6, y: y + 8, size: 10, font, color: rgb(0.6, 0.62, 0.66) });
    }
    y -= 10;
  };

  const drawFieldRow = (
    entries: { label: string; value: string; width: number; height?: number }[],
    extraSpacing = 4,
  ) => {
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
      const display = entry.value || (!previewMode ? '—' : '');
      if (display) {
        page.drawText(display, { x: x + 6, y: boxY + 8, size: 10, font });
      }
    });
    y = rowY - (entries[0].height ?? 26) - extraSpacing;
  };

  const drawParagraphBox = (label: string, value: string, height = 52) => {
    page.drawText(label, { x: margin, y, size: 9, font: bold });
    y -= height;
    page.drawRectangle({ x: margin, y, width: pageWidth - margin * 2, height, ...stroke, color: rgb(1, 1, 1) });
    const lines = value ? value.split(/\r?\n/).filter(Boolean) : [];
    if (lines.length) {
      let textY = y + height - 14;
      lines.forEach((line) => {
        page.drawText(line, { x: margin + 6, y: textY, size: 10, font });
        textY -= 12;
      });
    } else if (!previewMode) {
      page.drawText('—', { x: margin + 6, y: y + height / 2 - 4, size: 10, font, color: rgb(0.6, 0.62, 0.66) });
    }
    y -= 10;
  };

  drawHeading('Boiler Service Record', 18);
  const logoSize = 16;
  // Slightly larger brand block so we can drop in custom logos later.
  page.drawText('certnow', { x: margin, y, size: logoSize, font: bold });
  page.drawText(`Issued: ${new Date(issuedAt).toLocaleString()}`, { x: pageWidth - margin - 200, y, size: 10, font });
  y -= logoSize + 8;

  drawHeading('Property / Customer');
  drawField('Customer name', getVal('customer_name'), pageWidth - margin * 2);
  drawField('Property address', getVal('property_address'), pageWidth - margin * 2);
  drawFieldRow(
    [
      { label: 'Postcode', value: getVal('postcode'), width: 160 },
      { label: 'Service date', value: getVal('service_date'), width: 180 },
    ],
    8,
  );

  ensureSpace(520, () => drawHeading('Boiler Service Record — Continued'));
  drawHeading('Engineer & Company');
  drawFieldRow(
    [
      { label: 'Engineer name', value: getVal('engineer_name'), width: 220 },
      { label: 'Gas Safe number', value: getVal('gas_safe_number'), width: 140 },
    ],
    10,
  );
  drawField('Company name', getVal('company_name'), pageWidth - margin * 2);
  drawField('Company address', getVal('company_address'), pageWidth - margin * 2);

  ensureSpace(400, () => drawHeading('Boiler Service Record — Continued'));
  drawHeading('Boiler details');
  drawFieldRow(
    [
      { label: 'Boiler make', value: getVal('boiler_make'), width: 200 },
      { label: 'Boiler model', value: getVal('boiler_model'), width: 200 },
    ],
    10,
  );
  drawFieldRow(
    [
      { label: 'Boiler type', value: getVal('boiler_type'), width: 160 },
      { label: 'Location', value: getVal('boiler_location'), width: 160 },
      { label: 'Mount type', value: getVal('mount_type'), width: 120 },
    ],
    10,
  );
  drawFieldRow(
    [
      { label: 'Gas type', value: getVal('gas_type'), width: 160 },
      { label: 'Flue type', value: getVal('flue_type'), width: 160 },
      { label: 'Serial number', value: getVal('serial_number'), width: 180 },
    ],
    10,
  );

  ensureSpace(260, () => drawHeading('Boiler Service Record — Continued'));
  drawHeading('Service actions');
  const actions = [
    { label: 'Visual inspection', key: 'service_visual_inspection' },
    { label: 'Burner cleaned', key: 'service_burner_cleaned' },
    { label: 'Heat exchanger cleaned', key: 'service_heat_exchanger_cleaned' },
    { label: 'Condensate trap checked', key: 'service_condensate_trap_checked' },
    { label: 'Seals checked', key: 'service_seals_checked' },
    { label: 'Filters cleaned', key: 'service_filters_cleaned' },
    { label: 'Flue checked', key: 'service_flue_checked' },
    { label: 'Ventilation checked', key: 'service_ventilation_checked' },
    { label: 'Controls checked', key: 'service_controls_checked' },
    { label: 'Leaks checked', key: 'service_leaks_checked' },
  ];
  const columnWidth = (pageWidth - margin * 2 - 12) / 2;
  actions.forEach((action, idx) => {
    const column = idx % 2;
    const rowY = y - Math.floor(idx / 2) * 26;
    const x = margin + column * (columnWidth + 12);
    page.drawText(action.label, { x, y: rowY, size: 9, font });
    page.drawRectangle({
      x: x,
      y: rowY - 20,
      width: columnWidth,
      height: 18,
      ...stroke,
      color: rgb(1, 1, 1),
    });
    const value = boolVal(action.key);
    const display = value || (!previewMode ? '—' : '');
    if (display) {
      page.drawText(display, { x: x + 6, y: rowY - 8, size: 10, font: bold });
    }
  });
  y -= Math.ceil(actions.length / 2) * 26 + 10;

  ensureSpace(200, () => drawHeading('Boiler Service Record — Continued'));
  const readingRows = [
    { label: 'Operating pressure (mbar)', key: 'operating_pressure_mbar' },
    { label: 'Inlet pressure (mbar)', key: 'inlet_pressure_mbar' },
    { label: 'CO (ppm)', key: 'co_ppm' },
    { label: 'CO2 (%)', key: 'co2_percent' },
    { label: 'Flue gas temp (°C)', key: 'flue_gas_temp_c' },
    { label: 'System pressure (bar)', key: 'system_pressure_bar' },
  ].filter((row) => getVal(row.key));
  drawHeading('Readings');
  if (readingRows.length === 0 && previewMode) {
    drawField('Readings', '', pageWidth - margin * 2);
  } else if (readingRows.length === 0) {
    page.drawText('No readings recorded', { x: margin, y, size: 10, font, color: rgb(0.4, 0.42, 0.46) });
    y -= 18;
  } else {
    readingRows.forEach((row) => {
      drawFieldRow([{ label: row.label, value: getVal(row.key), width: pageWidth - margin * 2 }], 6);
    });
  }

  ensureSpace(140, () => drawHeading('Boiler Service Record — Continued'));
  drawHeading('Findings & recommendations');
  drawParagraphBox('Service summary', getVal('service_summary'), 60);
  drawParagraphBox('Recommendations', getVal('recommendations'), 60);
  drawField('Parts used', getVal('parts_used'), pageWidth - margin * 2);
  drawField('Next service due', getVal('next_service_due'), 240);
  const defectsValue = boolVal('defects_found') || getVal('defects_found');
  drawFieldRow(
    [
      { label: 'Defects found', value: defectsValue, width: 180 },
      { label: 'Defect details', value: getVal('defects_details'), width: pageWidth - margin * 2 - 192 },
    ],
    10,
  );

  ensureSpace(80, () => drawHeading('Boiler Service Record — Continued'));
  drawHeading('Signatures');
  drawFieldRow(
    [
      { label: 'Engineer signature', value: getVal('engineer_signature') || (previewMode ? '' : 'On file'), width: pageWidth / 2 - margin },
      { label: 'Customer signature', value: getVal('customer_signature') || (previewMode ? '' : 'On file'), width: pageWidth / 2 - margin },
    ],
    12,
  );
  page.drawText(`Issued at: ${new Date(issuedAt).toLocaleString()}`, {
    x: margin,
    y,
    size: 9,
    font,
  });

  return pdfDoc.save();
}
