import fs from 'node:fs/promises';
import path from 'node:path';

import { PDFDocument, StandardFonts, type PDFPage } from 'pdf-lib';

import type { GasWarningNoticeFields } from '@/types/gas-warning-notice';
import { GAS_WARNING_FORM_FIELD_NAMES, type GasWarningFieldKey, type GasWarningFormFieldName } from './gasWarningFieldMap';

const GAS_WARNING_TEMPLATE_PATH = 'src/assets/templates/gas-warning-notice.pdf';
const templateCache: Record<string, Uint8Array> = {};
type FormFieldName = GasWarningFormFieldName;

type SignatureTarget = {
  fieldName: FormFieldName;
  url?: string;
};

type SignatureRect = { x: number; y: number; width: number; height: number };

const GAS_WARNING_SIGNATURE_FALLBACKS: Record<'issued' | 'received', SignatureRect> = {
  issued: { x: 130.327, y: 52.75887, width: 122.122, height: 30.4423 },
  received: { x: 420.15903, y: 53.544292, width: 122.12197, height: 30.442402 },
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


function toText(value: unknown) {
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
  const lines = entries.length > 1 ? splitAddressLines(value, entries.length) : [value];
  lines.forEach((line, idx) => {
    const name = entries[idx];
    if (!name || !fieldNames.has(name) || filledFields.has(name)) return;
    try {
      const field = form.getTextField(name);
      field.setText(line);
      filledFields.add(name);
    } catch {
      // Ignore missing or non-text fields.
    }
  });
}

function setCheckboxIfExists(params: {
  form: ReturnType<PDFDocument['getForm']>;
  fieldNames: Set<string>;
  fieldName: FormFieldName;
  checked: boolean;
  filledFields: Set<string>;
}) {
  const { form, fieldNames, fieldName, checked, filledFields } = params;
  const entries = toFieldNameList(fieldName);
  if (!entries.length) return;
  entries.forEach((name) => {
    if (!name || !fieldNames.has(name) || filledFields.has(name)) return;
    try {
      const checkbox = form.getCheckBox(name);
      if (checked) checkbox.check();
      else checkbox.uncheck();
      filledFields.add(name);
    } catch {
      // Ignore missing or non-checkbox fields.
    }
  });
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

async function embedSignatureImage(params: {
  page: PDFPage;
  pdfDoc: PDFDocument;
  url?: string;
  rect?: SignatureRect | null;
}) {
  const { page, pdfDoc, url, rect } = params;
  if (!url || !rect) return;
  try {
    const fetched = await fetchAssetBytes(url);
    if (!fetched) return;
    const image = fetched.mime.includes('png') ? await pdfDoc.embedPng(fetched.bytes) : await pdfDoc.embedJpg(fetched.bytes);
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
  const classification = toText(fields.classification);
  const classificationMark =
    classification === 'IMMEDIATELY_DANGEROUS'
      ? 'ID'
      : classification === 'AT_RISK'
        ? 'AR'
        : toText(fields.classification_code);
  const issueMark = (value: unknown) => (isTruthy(value) ? 'X' : '');
  const clientAddress = toText(fields.customer_address || fields.property_address);
  const clientPostcode = toText(fields.customer_postcode || fields.postcode);
  const jobAddress = [fields.job_address_line1, fields.job_address_line2, fields.job_address_city].map(toText).filter(Boolean).join('\n');
  const engineerAddress = toText(fields.company_address);
  const values: Record<GasWarningFieldKey, string | boolean | undefined> = {
    certificateNumber: toText(fields.record_id ?? opts.recordId),
    engineerName: toText(fields.engineer_name),
    engineerCompany: toText(fields.engineer_company),
    engineerAddress,
    engineerPostcode: toText(fields.company_postcode),
    engineerTel: toText(fields.company_phone),
    gasSafeReg: toText(fields.gas_safe_number),
    idCardNumber: toText(fields.engineer_id_card_number),
    jobName: toText(fields.job_address_name),
    jobAddress: jobAddress || toText(fields.property_address),
    jobPostcode: toText(fields.job_postcode || fields.postcode),
    jobTel: toText(fields.job_tel || fields.customer_contact),
    clientName: toText(fields.customer_name),
    clientCompany: toText(fields.customer_company),
    clientAddress,
    clientPostcode,
    clientTel: toText(fields.customer_contact),
    clientMobile: toText(fields.customer_contact),
    applianceLocation: toText(fields.appliance_location),
    applianceMake: toText(fields.make_model),
    applianceModel: '',
    applianceSerial: toText(fields.serial_number),
    applianceType: toText(fields.appliance_type),
    applianceClassification: classificationMark,
    gasEscape: issueMark(fields.gas_escape_issue),
    pipeworkIssue: issueMark(fields.pipework_issue),
    ventilationIssue: issueMark(fields.ventilation_issue),
    meterIssue: issueMark(fields.meter_issue),
    chimneyFlueIssue: issueMark(fields.chimney_flue_issue),
    otherIssue: toText(fields.other_issue_details),
    faultDetails: toText(fields.unsafe_situation_description),
    actionsTaken: toText(fields.actions_taken),
    actionsRequired: toText(fields.underlying_cause),
    riddor11_1: undefined,
    riddor11_2: undefined,
    issuedBySignature: toText(fields.engineer_signature_url),
    issuedByPrintName: toText(fields.engineer_name),
    receivedBySignature: toText(fields.customer_signature_url),
    receivedByPrintName: toText(fields.customer_name),
    issuedDate: toText(fields.issued_at ?? opts.issuedAt),
    noticeLeftOnPremises: isTruthy(fields.customer_informed),
  };

  if (form) {
    const fieldNames = getFormFieldNames(form);
    if (!fieldNames.size) {
      const bytes = await pdfDoc.save();
      return new Uint8Array(bytes);
    }
    const filledFields = new Set<string>();

    (Object.keys(GAS_WARNING_FORM_FIELD_NAMES) as GasWarningFieldKey[]).forEach((key) => {
      const fieldName = GAS_WARNING_FORM_FIELD_NAMES[key];
      if (!fieldName) return;
      const value = values[key];
      if (value === undefined || value === null || value === '') return;
      if (typeof value === 'boolean') {
        setCheckboxIfExists({ form, fieldNames, fieldName, checked: value, filledFields });
        return;
      }
      setTextIfExists({
        form,
        fieldNames,
        fieldName,
        value: toText(value),
        filledFields,
      });
    });

    const signatures: SignatureTarget[] = [
      { fieldName: GAS_WARNING_FORM_FIELD_NAMES.issuedBySignature, url: values.issuedBySignature as string },
      { fieldName: GAS_WARNING_FORM_FIELD_NAMES.receivedBySignature, url: values.receivedBySignature as string },
    ];

    for (const [index, target] of signatures.entries()) {
      const [name] = toFieldNameList(target.fieldName);
      const rect = name
        ? getFieldRect(form, name)
        : index === 0
          ? GAS_WARNING_SIGNATURE_FALLBACKS.issued
          : GAS_WARNING_SIGNATURE_FALLBACKS.received;
      await embedSignatureImage({ page, pdfDoc, url: target.url, rect });
    }

    form.updateFieldAppearances(font);
    const bytes = await pdfDoc.save();
    return new Uint8Array(bytes);
  }
  const bytes = await pdfDoc.save();
  return new Uint8Array(bytes);
}
