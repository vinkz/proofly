import fs from 'node:fs/promises';
import path from 'node:path';

import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';

import type { GasWarningNoticeFields } from '@/types/gas-warning-notice';

const GAS_WARNING_TEMPLATE_PATH = 'src/assets/templates/gas-warning-notice.pdf';
const templateCache: Record<string, Uint8Array> = {};
const GAS_WARNING_Y_OFFSET = -26;

type FieldConfig = {
  x: number;
  y: number;
  size?: number;
  maxWidth?: number;
};

type FormFieldName = string | string[] | null;

type SignatureTarget = {
  fieldName: FormFieldName;
  url?: string;
};

async function loadGasWarningTemplateBytes() {
  if (templateCache[GAS_WARNING_TEMPLATE_PATH]) {
    return templateCache[GAS_WARNING_TEMPLATE_PATH];
  }
  const absolute = path.join(process.cwd(), GAS_WARNING_TEMPLATE_PATH);
  const bytes = await fs.readFile(absolute);
  templateCache[GAS_WARNING_TEMPLATE_PATH] = new Uint8Array(bytes);
  return templateCache[GAS_WARNING_TEMPLATE_PATH];
}

// Update names to match the AcroForm field names in gas-warning-notice.pdf.
const GAS_WARNING_FORM_FIELD_NAMES: Record<keyof GasWarningNoticeFields, FormFieldName> = {
  property_address: ['Text_25', 'Text_26', 'Text_27', 'Text_28'],
  postcode: 'Text_29',
  customer_name: ['Text_31', 'Text_23'],
  customer_contact: ['Text_38', 'Text_39'],
  appliance_location: 'Text_10',
  appliance_type: 'Text_43',
  make_model: 'Text_40',
  gas_supply_isolated: 'Text_12',
  appliance_capped_off: 'Text_13',
  customer_refused_isolation: 'Text_14',
  classification: 'Text_11',
  classification_code: 'Text_44',
  unsafe_situation_description: 'Text_18',
  underlying_cause: 'Text_17',
  actions_taken: 'Text_19',
  emergency_services_contacted: 'Text_15',
  emergency_reference: 'Text_45',
  danger_do_not_use_label_fitted: 'Text_16',
  meter_or_appliance_tagged: 'Checkbox_1',
  customer_informed: 'Text_20',
  customer_understands_risks: 'Text_21',
  customer_signature_url: 'Signature_2',
  customer_signed_at: null,
  engineer_name: ['Text_1', 'Text_22'],
  engineer_company: 'Text_2',
  gas_safe_number: 'Text_8',
  engineer_id_card_number: 'Text_9',
  engineer_signature_url: 'Signature_1',
  issued_at: 'Date_1',
  record_id: 'Text_41',
};

const GAS_WARNING_COORDS: Record<keyof GasWarningNoticeFields, FieldConfig> = {
  property_address: { x: 100, y: 520, size: 10, maxWidth: 220 },
  postcode: { x: 100, y: 505, size: 10 },
  customer_name: { x: 320, y: 520, size: 10, maxWidth: 220 },
  customer_contact: { x: 320, y: 505, size: 10 },
  appliance_location: { x: 100, y: 400, size: 10 },
  appliance_type: { x: 260, y: 400, size: 10 },
  make_model: { x: 420, y: 400, size: 10 },
  gas_supply_isolated: { x: 100, y: 370, size: 10 },
  appliance_capped_off: { x: 160, y: 370, size: 10 },
  customer_refused_isolation: { x: 220, y: 370, size: 10 },
  classification: { x: 280, y: 400, size: 10 },
  classification_code: { x: 420, y: 385, size: 10 },
  unsafe_situation_description: { x: 60, y: 290, size: 10, maxWidth: 720 },
  underlying_cause: { x: 60, y: 230, size: 10, maxWidth: 340 },
  actions_taken: { x: 420, y: 230, size: 10, maxWidth: 340 },
  emergency_services_contacted: { x: 280, y: 370, size: 10 },
  emergency_reference: { x: 420, y: 370, size: 10 },
  danger_do_not_use_label_fitted: { x: 340, y: 370, size: 10 },
  meter_or_appliance_tagged: { x: 100, y: 150, size: 10 },
  customer_informed: { x: 260, y: 150, size: 10 },
  customer_understands_risks: { x: 340, y: 150, size: 10 },
  customer_signature_url: { x: 100, y: 90, size: 10 },
  customer_signed_at: { x: 100, y: 70, size: 10 },
  engineer_name: { x: 100, y: 540, size: 10 },
  engineer_company: { x: 100, y: 525, size: 10 },
  gas_safe_number: { x: 100, y: 510, size: 10 },
  engineer_id_card_number: { x: 100, y: 495, size: 10 },
  engineer_signature_url: { x: 420, y: 90, size: 10 },
  issued_at: { x: 420, y: 70, size: 10 },
  record_id: { x: 40, y: 570, size: 10 },
};

function toText(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function isTruthy(value: unknown) {
  if (value === true) return true;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'y', 'on'].includes(value.toLowerCase());
  }
  return false;
}
function getFormFieldNames(form: ReturnType<PDFDocument['getForm']>) {
  return new Set(form.getFields().map((field) => field.getName()));
}

function toFieldNameList(fieldName: FormFieldName) {
  if (!fieldName) return [];
  return Array.isArray(fieldName) ? fieldName : [fieldName];
}

function splitTextLines(value: string, maxLines: number) {
  const parts = value
    .split(/\r?\n|,/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return [];
  if (parts.length <= maxLines) return parts;
  const lines = parts.slice(0, maxLines - 1);
  lines.push(parts.slice(maxLines - 1).join(', '));
  return lines;
}

function setTextIfExists(params: {
  form: ReturnType<PDFDocument['getForm']>;
  fieldNames: Set<string>;
  fieldName: FormFieldName;
  value: string | undefined;
  filledFields: Set<string>;
}) {
  const { form, fieldNames, fieldName, value, filledFields } = params;
  if (!value) return;
  const entries = toFieldNameList(fieldName);
  if (!entries.length) return;
  if (entries.length > 1) {
    const lines = splitTextLines(value, entries.length);
    lines.forEach((line, idx) => {
      const name = entries[idx];
      if (!name || !fieldNames.has(name) || filledFields.has(name)) return;
      try {
        const field = form.getTextField(name);
        field.setText(line);
        filledFields.add(name);
      } catch {
        try {
          const checkbox = form.getCheckBox(name);
          if (line) checkbox.check();
          else checkbox.uncheck();
          filledFields.add(name);
        } catch {
          // Ignore missing fields or non-text fields.
        }
      }
    });
    return;
  }

  const [name] = entries;
  if (!name || !fieldNames.has(name) || filledFields.has(name)) return;
  try {
    const field = form.getTextField(name);
    field.setText(value);
    filledFields.add(name);
  } catch {
    try {
      const checkbox = form.getCheckBox(name);
      if (value) checkbox.check();
      else checkbox.uncheck();
      filledFields.add(name);
    } catch {
      // Ignore missing fields or non-text fields.
    }
  }
}

function getFieldRect(form: ReturnType<PDFDocument['getForm']>, fieldName: string) {
  try {
    const field = form.getField(fieldName);
    const acroField = (field as { acroField?: { getWidgets?: () => { getRectangle?: () => unknown }[] } }).acroField;
    const widgets = acroField?.getWidgets?.();
    const rect = widgets?.[0]?.getRectangle?.() as { x: number; y: number; width: number; height: number } | undefined;
    if (!rect) return null;
    return rect;
  } catch {
    return null;
  }
}

async function embedSignatureImage(params: {
  page: PDFPage;
  pdfDoc: PDFDocument;
  url?: string;
  rect?: { x: number; y: number; width: number; height: number } | null;
}) {
  const { page, pdfDoc, url, rect } = params;
  if (!url || !rect) return;
  try {
    const response = await fetch(url);
    if (!response.ok) return;
    const arrayBuffer = await response.arrayBuffer();
    const mime = (response.headers.get('content-type') ?? '').toLowerCase();
    const image = mime.includes('png') ? await pdfDoc.embedPng(arrayBuffer) : await pdfDoc.embedJpg(arrayBuffer);
    const padding = 4;
    const maxWidth = rect.width - padding * 2;
    const maxHeight = rect.height - padding * 2;
    const dims = image.scaleToFit(maxWidth, maxHeight);
    const x = rect.x + (rect.width - dims.width) / 2;
    const y = rect.y + (rect.height - dims.height) / 2;
    page.drawImage(image, { x, y, width: dims.width, height: dims.height });
  } catch {
    // Swallow fetch/embed errors; template rendering continues.
  }
}

function drawField(
  page: PDFPage,
  font: PDFFont,
  fieldConfig: FieldConfig | undefined,
  value: string | undefined,
) {
  if (!fieldConfig || !value) return;
  const size = fieldConfig.size ?? 10;
  const baseY = fieldConfig.y + GAS_WARNING_Y_OFFSET;

  if (!fieldConfig.maxWidth) {
    page.drawText(value, { x: fieldConfig.x, y: baseY, size, font });
    return;
  }

  const words = value.split(' ');
  const lineHeight = size + 2;
  let line = '';
  let currentY = baseY;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, size);
    if (width > fieldConfig.maxWidth && line) {
      page.drawText(line, { x: fieldConfig.x, y: currentY, size, font });
      currentY -= lineHeight;
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) {
    page.drawText(line, { x: fieldConfig.x, y: currentY, size, font });
  }
}

export async function renderGasWarningNoticePdf(opts: {
  fields: GasWarningNoticeFields;
  issuedAt: string;
  recordId: string;
}): Promise<Uint8Array> {
  const templateBytes = await loadGasWarningTemplateBytes();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm?.();
  const [page] = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const fields: GasWarningNoticeFields = {
    ...opts.fields,
    issued_at: opts.fields.issued_at ?? opts.issuedAt,
    record_id: opts.fields.record_id ?? opts.recordId,
  };
  const booleanKeys: Array<keyof GasWarningNoticeFields> = [
    'gas_supply_isolated',
    'appliance_capped_off',
    'customer_refused_isolation',
    'emergency_services_contacted',
    'danger_do_not_use_label_fitted',
    'meter_or_appliance_tagged',
    'customer_informed',
    'customer_understands_risks',
  ];
  booleanKeys.forEach((key) => {
    if (fields[key] === undefined) return;
    fields[key] = isTruthy(fields[key]) ? 'X' : '';
  });

  if (form) {
    const fieldNames = getFormFieldNames(form);
    if (!fieldNames.size) {
      (Object.keys(GAS_WARNING_COORDS) as (keyof GasWarningNoticeFields)[]).forEach((key) => {
        const value = fields[key];
        if (typeof value === 'boolean') {
          drawField(page, font, GAS_WARNING_COORDS[key], value ? 'X' : '');
          return;
        }
        drawField(page, font, GAS_WARNING_COORDS[key], toText(value));
      });
      const bytes = await pdfDoc.save();
      return new Uint8Array(bytes);
    }
    const filledFields = new Set<string>();

    const skipKeys = new Set<keyof GasWarningNoticeFields>([
      'customer_signature_url',
      'engineer_signature_url',
      'customer_signed_at',
    ]);

    (Object.keys(GAS_WARNING_FORM_FIELD_NAMES) as (keyof GasWarningNoticeFields)[]).forEach((key) => {
      if (skipKeys.has(key)) return;
      const value = fields[key];
      if (value === undefined) return;
      if (typeof value === 'boolean') {
        setTextIfExists({
          form,
          fieldNames,
          fieldName: GAS_WARNING_FORM_FIELD_NAMES[key],
          value: value ? 'X' : '',
          filledFields,
        });
        return;
      }
      const text = toText(value);
      if (!text) return;
      setTextIfExists({
        form,
        fieldNames,
        fieldName: GAS_WARNING_FORM_FIELD_NAMES[key],
        value: text,
        filledFields,
      });
    });

    const signatures: SignatureTarget[] = [
      { fieldName: GAS_WARNING_FORM_FIELD_NAMES.customer_signature_url, url: fields.customer_signature_url },
      { fieldName: GAS_WARNING_FORM_FIELD_NAMES.engineer_signature_url, url: fields.engineer_signature_url },
    ];

    for (const target of signatures) {
      const [name] = toFieldNameList(target.fieldName);
      if (!name) continue;
      const rect = getFieldRect(form, name);
      await embedSignatureImage({ page, pdfDoc, url: target.url, rect });
    }

    form.updateFieldAppearances(font);
    const bytes = await pdfDoc.save();
    return new Uint8Array(bytes);
  }

  (Object.keys(GAS_WARNING_COORDS) as (keyof GasWarningNoticeFields)[]).forEach((key) => {
    const value = fields[key];
    if (typeof value === 'boolean') {
      drawField(page, font, GAS_WARNING_COORDS[key], value ? 'X' : '');
      return;
    }
    drawField(page, font, GAS_WARNING_COORDS[key], toText(value));
  });

  const bytes = await pdfDoc.save();
  return new Uint8Array(bytes);
}
