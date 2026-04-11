import fs from 'node:fs/promises';
import path from 'node:path';

import { PDFDocument, PDFTextField, StandardFonts, TextAlignment, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import { getGasWarningClassificationLabel, type GasWarningNoticeFields } from '@/types/gas-warning-notice';
import {
  GAS_WARNING_PDF_FIELD_MAP,
  type GasWarningFieldKey,
  type GasWarningFormFieldName,
  type GasWarningPdfFieldAppearance,
  type GasWarningPdfTarget,
  getGasWarningPdfTargetUsage,
} from './gasWarningFieldMap';

const GAS_WARNING_TEMPLATE_PATH = 'src/assets/templates/gas-warning-notice.pdf';
const templateCache: Record<string, Uint8Array> = {};
const KNOWN_APPLIANCE_MAKES = ['Worcester Bosch', 'Vaillant', 'Ideal', 'Baxi'];

type FormFieldName = GasWarningFormFieldName;
type SignatureRect = { x: number; y: number; width: number; height: number };
type WidgetPlacement = {
  rect: SignatureRect | null;
  pageIndex: number;
  page: PDFPage | null;
  widgetIndex: number;
};
type OverlayTextTarget = {
  target: GasWarningPdfTarget;
  text: string;
  appearance?: GasWarningPdfFieldAppearance;
};
type MarkTarget = {
  target: GasWarningPdfTarget;
};

const GAS_WARNING_SIGNATURE_FALLBACKS: Record<'issued' | 'received', SignatureRect> = {
  issued: { x: 130.327, y: 52.75887, width: 122.122, height: 30.4423 },
  received: { x: 420.15903, y: 53.544292, width: 122.12197, height: 30.442402 },
};
const GAS_WARNING_NOTICE_LEFT_ON_PREMISES_RECT: SignatureRect = {
  // Audited from the live template thumbnail. The footer checkbox has no AcroForm field.
  x: 699.25,
  y: 26.5,
  width: 11.5,
  height: 11.5,
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

function normalizeText(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function splitAddressLines(value: string, maxLines: number) {
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

function splitMakeModel(value: string | undefined) {
  const text = normalizeText(value);
  if (!text) return { make: '', model: '' };

  const knownMake = KNOWN_APPLIANCE_MAKES.find((make) => text.toLowerCase().startsWith(make.toLowerCase()));
  if (knownMake) {
    return { make: knownMake, model: text.slice(knownMake.length).trim() };
  }

  const [make = '', ...rest] = text.split(/\s+/);
  return { make, model: rest.join(' ').trim() };
}

function isTruthy(value: unknown) {
  if (value === true) return true;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'y', 'on', 'checked', 'x'].includes(value.trim().toLowerCase());
  }
  return false;
}

function getFormFieldNames(form: ReturnType<PDFDocument['getForm']>) {
  return new Set(form.getFields().map((field) => field.getName()));
}

function toFieldTargetList(fieldName: FormFieldName) {
  if (!fieldName) return [];
  return Array.isArray(fieldName) ? fieldName : [fieldName];
}

function getFieldWidgetRect(field: PDFTextField, widgetIndex?: number) {
  try {
    const widgets = field.acroField.getWidgets();
    const widget = widgets[widgetIndex ?? 0] ?? widgets[0];
    const rect = widget?.getRectangle();
    if (!rect) return null;
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  } catch {
    return null;
  }
}

function getWidgetPlacements(params: {
  form: ReturnType<PDFDocument['getForm']>;
  pdfDoc: PDFDocument;
  fieldName: string;
}) {
  const { form, pdfDoc, fieldName } = params;
  try {
    const field = form.getField(fieldName);
    const acroField = (field as {
      acroField?: {
        getWidgets?: () => Array<{
          getRectangle?: () => { x: number; y: number; width: number; height: number };
          P?: () => { objectNumber?: number; generationNumber?: number } | undefined;
        }>;
      };
    }).acroField;
    const widgets = acroField?.getWidgets?.() ?? [];
    const pages = pdfDoc.getPages();

    return widgets.map((widget, widgetIndex) => {
      const rect = widget.getRectangle?.();
      const widgetPageRef = widget.P?.();
      const pageIndex = pages.findIndex(
        (candidate) =>
          candidate.ref?.objectNumber === widgetPageRef?.objectNumber &&
          candidate.ref?.generationNumber === widgetPageRef?.generationNumber,
      );

      return {
        rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
        pageIndex: pageIndex >= 0 ? pageIndex : 0,
        page: pages[pageIndex >= 0 ? pageIndex : 0] ?? null,
        widgetIndex,
      };
    });
  } catch {
    return [] as WidgetPlacement[];
  }
}

function resolveWidgetPlacement(params: {
  form: ReturnType<PDFDocument['getForm']>;
  pdfDoc: PDFDocument;
  target: GasWarningPdfTarget;
}) {
  const placements = getWidgetPlacements({
    form: params.form,
    pdfDoc: params.pdfDoc,
    fieldName: params.target.name,
  });

  if (params.target.widgetIndex !== undefined) {
    return placements.find((placement) => placement.widgetIndex === params.target.widgetIndex && placement.rect && placement.page) ?? null;
  }

  return placements.find((placement) => placement.rect && placement.page) ?? null;
}

function getFittedFontSize(params: {
  text: string;
  font: PDFFont;
  maxWidth: number;
  preferredSize: number;
  minSize: number;
}) {
  const { text, font, maxWidth, preferredSize, minSize } = params;
  const normalized = normalizeText(text);
  if (!normalized || maxWidth <= 0) return preferredSize;

  let size = preferredSize;
  while (size > minSize && font.widthOfTextAtSize(normalized, size) > maxWidth) {
    size = Math.max(minSize, size - 0.25);
  }
  return size;
}

function toPdfAlignment(alignment: GasWarningPdfFieldAppearance['alignment']) {
  if (alignment === 'center') return TextAlignment.Center;
  if (alignment === 'right') return TextAlignment.Right;
  return TextAlignment.Left;
}

function configureTextFieldAppearance(params: {
  field: PDFTextField;
  font: PDFFont;
  text: string;
  appearance?: GasWarningPdfFieldAppearance;
  target?: GasWarningPdfTarget;
}) {
  const { field, font, text, appearance, target } = params;
  const preferredSize = appearance?.preferredFontSize ?? 6.5;
  const minSize = appearance?.minFontSize ?? 5.25;
  const padding = appearance?.padding ?? 4;
  const multiline = appearance?.multiline ?? false;

  if (multiline) field.enableMultiline();
  else field.disableMultiline();

  field.setAlignment(toPdfAlignment(appearance?.alignment));

  const rect = getFieldWidgetRect(field, target?.widgetIndex);
  const fontSize =
    multiline || !rect
      ? preferredSize
      : getFittedFontSize({
          text,
          font,
          maxWidth: rect.width - padding * 2,
          preferredSize,
          minSize,
        });
  field.setFontSize(fontSize);
}

function setTextIfExists(params: {
  form: ReturnType<PDFDocument['getForm']>;
  fieldNames: Set<string>;
  entry: (typeof GAS_WARNING_PDF_FIELD_MAP)[GasWarningFieldKey];
  value: string | undefined;
  filledFields: Set<string>;
  font: PDFFont;
  overlayTextTargets: OverlayTextTarget[];
}) {
  const { form, fieldNames, entry, value, filledFields, font, overlayTextTargets } = params;
  const text = normalizeText(value);
  if (!text) return;

  const targets = toFieldTargetList(entry.fieldName);
  if (!targets.length) return;

  const lines = targets.length > 1 ? splitAddressLines(text, targets.length) : [text];

  targets.forEach((target, index) => {
    if (!fieldNames.has(target.name)) return;
    const line = lines[index] ?? '';
    if (!line) return;

    const usage = getGasWarningPdfTargetUsage(target);
    if (usage === 'ambiguous-avoid' || usage === 'overlay-only') {
      return;
    }
    if (usage === 'widget-aware' && target.widgetIndex === undefined) {
      return;
    }

    if (entry.renderMode === 'widget-overlay' || usage === 'widget-aware') {
      overlayTextTargets.push({
        target,
        text: line,
        appearance: entry.appearance,
      });
      return;
    }

    if (usage !== 'safe-usable') return;
    if (filledFields.has(target.name)) return;
    try {
      const field = form.getTextField(target.name);
      configureTextFieldAppearance({
        field,
        font,
        text: line,
        appearance: entry.appearance,
        target,
      });
      field.setText(line);
      filledFields.add(target.name);
    } catch {
      // Ignore missing or non-text fields.
    }
  });
}

async function fetchAssetBytes(url: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (!url) return null;
  try {
    if (url.startsWith('data:')) {
      const match = url.match(/^data:(.+?);base64,(.*)$/);
      if (!match) return null;
      const [, mime, data] = match;
      return { bytes: Uint8Array.from(Buffer.from(data, 'base64')), mime: mime || 'image/png' };
    }

    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const mime = (response.headers.get('content-type') ?? '').toLowerCase() || 'image/png';
    return { bytes: new Uint8Array(arrayBuffer), mime };
  } catch {
    return null;
  }
}

function drawOverlayText(params: {
  form: ReturnType<PDFDocument['getForm']>;
  pdfDoc: PDFDocument;
  font: PDFFont;
  target: OverlayTextTarget;
}) {
  const { form, pdfDoc, font, target } = params;
  const placement = resolveWidgetPlacement({
    form,
    pdfDoc,
    target: target.target,
  });
  if (!placement?.page || !placement.rect) return;

  const text = normalizeText(target.text);
  if (!text) return;

  const appearance = target.appearance;
  const padding = appearance?.padding ?? 4;
  const preferredSize = appearance?.preferredFontSize ?? 6.5;
  const minSize = appearance?.minFontSize ?? 5.25;
  const size = getFittedFontSize({
    text,
    font,
    maxWidth: placement.rect.width - padding * 2,
    preferredSize,
    minSize,
  });
  const textWidth = font.widthOfTextAtSize(text, size);
  const textHeight = font.heightAtSize(size);
  const alignment = appearance?.alignment ?? 'left';

  const x =
    alignment === 'center'
      ? placement.rect.x + (placement.rect.width - textWidth) / 2
      : alignment === 'right'
        ? placement.rect.x + placement.rect.width - padding - textWidth
        : placement.rect.x + padding;
  const y = placement.rect.y + (placement.rect.height - textHeight) / 2 + 1;

  placement.page.drawText(text, {
    x,
    y,
    size,
    font,
    color: rgb(0, 0, 0),
  });
}

function drawMark(params: {
  form: ReturnType<PDFDocument['getForm']>;
  pdfDoc: PDFDocument;
  target: GasWarningPdfTarget;
}) {
  const placement = resolveWidgetPlacement({
    form: params.form,
    pdfDoc: params.pdfDoc,
    target: params.target,
  });
  if (!placement?.page || !placement.rect) return;

  drawMarkAtRect({
    page: placement.page,
    rect: placement.rect,
  });
}

function drawMarkAtRect(params: {
  page: PDFPage;
  rect: SignatureRect;
}) {
  const { rect, page } = params;
  const size = Math.min(rect.width, rect.height);
  const inset = Math.max(1, size * 0.22);
  const thickness = Math.max(1, size * 0.14);

  page.drawLine({
    start: { x: rect.x + inset, y: rect.y + inset },
    end: { x: rect.x + rect.width - inset, y: rect.y + rect.height - inset },
    thickness,
    color: rgb(0, 0, 0),
  });
  page.drawLine({
    start: { x: rect.x + inset, y: rect.y + rect.height - inset },
    end: { x: rect.x + rect.width - inset, y: rect.y + inset },
    thickness,
    color: rgb(0, 0, 0),
  });
}

function drawNoticeLeftOnPremisesMark(pdfDoc: PDFDocument) {
  const page = pdfDoc.getPages()[0];
  if (!page) return;

  drawMarkAtRect({
    page,
    rect: GAS_WARNING_NOTICE_LEFT_ON_PREMISES_RECT,
  });
}

async function embedSignatureImage(params: {
  form: ReturnType<PDFDocument['getForm']>;
  pdfDoc: PDFDocument;
  target: GasWarningPdfTarget;
  fallbackRect: SignatureRect;
  url?: string;
}) {
  const { form, pdfDoc, target, fallbackRect, url } = params;
  if (!url) return;

  const placement = resolveWidgetPlacement({ form, pdfDoc, target });
  const page = placement?.page ?? pdfDoc.getPages()[0] ?? null;
  const rect = placement?.rect ?? fallbackRect;
  if (!page || !rect) return;

  try {
    const fetched = await fetchAssetBytes(url);
    if (!fetched) return;
    const image = fetched.mime.includes('png') ? await pdfDoc.embedPng(fetched.bytes) : await pdfDoc.embedJpg(fetched.bytes);
    const padding = Math.max(2, Math.min(4, Math.min(rect.width, rect.height) * 0.12));
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

export async function renderGasWarningNoticePdf(opts: {
  fields: GasWarningNoticeFields;
  issuedAt: string;
  recordId: string;
}): Promise<Uint8Array> {
  const templateBytes = await loadGasWarningTemplateBytes();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm?.();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const fields: GasWarningNoticeFields = {
    ...opts.fields,
    issued_at: opts.fields.issued_at ?? opts.issuedAt,
    record_id: opts.fields.record_id ?? opts.recordId,
  };

  const classificationLabel = getGasWarningClassificationLabel(fields.classification, fields.classification_code);
  const customerPresent = fields.customer_present === undefined ? true : isTruthy(fields.customer_present);
  const clientAddress = normalizeText(fields.customer_address || fields.property_address);
  const clientPostcode = normalizeText(fields.customer_postcode || fields.postcode);
  const jobAddress = [fields.job_address_line1, fields.job_address_line2, fields.job_address_city]
    .map(normalizeText)
    .filter(Boolean)
    .join('\n');
  const engineerAddress = normalizeText(fields.company_address);
  const applianceIdentity = splitMakeModel(fields.make_model);

  const values: Record<GasWarningFieldKey, string | boolean | undefined> = {
    certificateNumber: normalizeText(fields.record_id ?? opts.recordId),
    engineerName: normalizeText(fields.engineer_name),
    engineerCompany: normalizeText(fields.engineer_company),
    engineerAddress,
    engineerPostcode: normalizeText(fields.company_postcode),
    engineerTel: normalizeText(fields.company_phone),
    gasSafeReg: normalizeText(fields.gas_safe_number),
    idCardNumber: normalizeText(fields.engineer_id_card_number),
    jobName: normalizeText(fields.job_address_name),
    jobAddress: jobAddress || normalizeText(fields.property_address),
    jobPostcode: normalizeText(fields.job_postcode || fields.postcode),
    jobTel: normalizeText(fields.job_tel || fields.customer_contact),
    clientName: normalizeText(fields.customer_name),
    clientCompany: normalizeText(fields.customer_company),
    clientAddress,
    clientPostcode,
    clientTel: normalizeText(fields.customer_contact),
    clientMobile: normalizeText(fields.customer_contact),
    applianceLocation: normalizeText(fields.appliance_location),
    applianceMake: applianceIdentity.make,
    applianceModel: applianceIdentity.model,
    applianceSerial: normalizeText(fields.serial_number),
    applianceType: normalizeText(fields.appliance_type),
    applianceClassification: normalizeText(classificationLabel),
    gasEscape: isTruthy(fields.gas_escape_issue),
    pipeworkIssue: isTruthy(fields.pipework_issue),
    ventilationIssue: isTruthy(fields.ventilation_issue),
    meterIssue: isTruthy(fields.meter_issue),
    chimneyFlueIssue: isTruthy(fields.chimney_flue_issue),
    otherIssue: normalizeText(fields.other_issue_details),
    faultDetails: normalizeText(fields.unsafe_situation_description),
    actionsTaken: normalizeText(fields.actions_taken),
    actionsRequired: normalizeText(fields.underlying_cause),
    riddor11_1: isTruthy(fields.riddor_11_1_reported),
    riddor11_2: isTruthy(fields.riddor_11_2_reported),
    issuedBySignature: normalizeText(fields.engineer_signature_url),
    issuedByPrintName: normalizeText(fields.engineer_name),
    receivedBySignature: customerPresent ? normalizeText(fields.customer_signature_url) : '',
    receivedByPrintName: customerPresent ? normalizeText(fields.customer_name) : '',
    issuedDate: normalizeText(fields.issued_at ?? opts.issuedAt),
    noticeLeftOnPremises: !customerPresent && isTruthy(fields.notice_left_on_premises ?? fields.customer_informed),
  };

  if (!form) {
    const bytes = await pdfDoc.save();
    return new Uint8Array(bytes);
  }

  const fieldNames = getFormFieldNames(form);
  if (!fieldNames.size) {
    const bytes = await pdfDoc.save();
    return new Uint8Array(bytes);
  }

  const filledFields = new Set<string>();
  const overlayTextTargets: OverlayTextTarget[] = [];
  const markTargets: MarkTarget[] = [];

  (Object.keys(GAS_WARNING_PDF_FIELD_MAP) as GasWarningFieldKey[]).forEach((key) => {
    const entry = GAS_WARNING_PDF_FIELD_MAP[key];
    const value = values[key];
    if (value === undefined || value === null || value === '') return;

    if (entry.type === 'signature') {
      return;
    }

    if (entry.type === 'mark') {
      if (!isTruthy(value)) return;
      toFieldTargetList(entry.fieldName).forEach((target) => {
        const usage = getGasWarningPdfTargetUsage(target);
        if (usage === 'overlay-only' && fieldNames.has(target.name)) {
          markTargets.push({ target });
        }
      });
      return;
    }

    if (entry.type !== 'text') return;

    setTextIfExists({
      form,
      fieldNames,
      entry,
      value: normalizeText(value),
      filledFields,
      font,
      overlayTextTargets,
    });
  });

  form.updateFieldAppearances(font);

  overlayTextTargets.forEach((target) => {
    drawOverlayText({
      form,
      pdfDoc,
      font,
      target,
    });
  });

  markTargets.forEach(({ target }) => {
    drawMark({
      form,
      pdfDoc,
      target,
    });
  });

  if (values.noticeLeftOnPremises === true) {
    drawNoticeLeftOnPremisesMark(pdfDoc);
  }

  await embedSignatureImage({
    form,
    pdfDoc,
    target: toFieldTargetList(GAS_WARNING_PDF_FIELD_MAP.issuedBySignature.fieldName)[0] ?? { name: 'text41' },
    fallbackRect: GAS_WARNING_SIGNATURE_FALLBACKS.issued,
    url: values.issuedBySignature as string,
  });
  await embedSignatureImage({
    form,
    pdfDoc,
    target: toFieldTargetList(GAS_WARNING_PDF_FIELD_MAP.receivedBySignature.fieldName)[0] ?? { name: 'text42' },
    fallbackRect: GAS_WARNING_SIGNATURE_FALLBACKS.received,
    url: values.receivedBySignature as string,
  });

  const bytes = await pdfDoc.save();
  return new Uint8Array(bytes);
}
