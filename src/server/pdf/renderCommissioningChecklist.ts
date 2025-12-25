import fs from 'node:fs/promises';
import path from 'node:path';

import { PDFDocument, StandardFonts } from 'pdf-lib';
import { z } from 'zod';

import { COMMISSIONING_CHECKLIST_FIELD_MAP } from '@/lib/pdf/fieldMaps/commissioningChecklist';

type FormFieldName = string | string[] | null;

type RenderInput = {
  jobId: string;
  fields: Record<string, unknown>;
  issuedAt?: Date;
};

type RenderResult = {
  pdfBytes: Uint8Array;
  filename: string;
  title: string;
  kind: 'commissioning';
  metadata?: Record<string, unknown>;
};

const COMMISSIONING_TEMPLATE_REL_PATH = 'src/assets/templates/commissioning-checklist-template.pdf';
const templateCache: Record<string, Uint8Array> = {};

const RenderInputSchema = z.object({
  jobId: z.string().uuid(),
  fields: z.record(z.string(), z.unknown()),
  issuedAt: z.date().optional(),
});

async function loadCommissioningTemplateBytes(): Promise<Uint8Array> {
  if (templateCache[COMMISSIONING_TEMPLATE_REL_PATH]) {
    return templateCache[COMMISSIONING_TEMPLATE_REL_PATH];
  }
  const templatePath = path.join(process.cwd(), COMMISSIONING_TEMPLATE_REL_PATH);
  const file = await fs.readFile(templatePath);
  const bytes = new Uint8Array(file);
  templateCache[COMMISSIONING_TEMPLATE_REL_PATH] = bytes;
  return bytes;
}

function getFormFieldNames(form: ReturnType<PDFDocument['getForm']>) {
  return new Set(form.getFields().map((field) => field.getName()));
}

function toFieldNameList(fieldName: FormFieldName) {
  if (!fieldName) return [];
  return Array.isArray(fieldName) ? fieldName : [fieldName];
}

function normalizeText(value: unknown) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleDateString('en-GB');
  return String(value).trim();
}

function resolveDateValue(value: unknown, fallback: string) {
  if (value instanceof Date) return value.toLocaleDateString('en-GB');
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-GB');
    }
    return trimmed;
  }
  return fallback;
}

function splitTextLines(value: string, maxLines: number) {
  const parts = value
    .split(/\r?\n|,/) // keep ascii
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

function formatBoolean(value: unknown) {
  return isTruthy(value) ? 'Yes' : '';
}

function setFieldValue(params: {
  form: ReturnType<PDFDocument['getForm']>;
  fieldNames: Set<string>;
  fieldName: FormFieldName;
  value: unknown;
  filledFields: Set<string>;
}) {
  const { form, fieldNames, fieldName, value, filledFields } = params;
  const entries = toFieldNameList(fieldName);
  if (!entries.length) return;

  const isBoolean = typeof value === 'boolean';
  const text = isBoolean ? formatBoolean(value) : normalizeText(value);
  if (!text && !isBoolean && !isTruthy(value)) return;

  if (entries.length > 1) {
    const lines = text ? splitTextLines(text, entries.length) : [];
    entries.forEach((name, idx) => {
      if (!name || !fieldNames.has(name) || filledFields.has(name)) return;
      const line = lines[idx] ?? '';
      try {
        const field = form.getTextField(name);
        field.setText(line);
        filledFields.add(name);
      } catch {
        try {
          const checkbox = form.getCheckBox(name);
          if (isBoolean ? value : isTruthy(line)) checkbox.check();
          else checkbox.uncheck();
          filledFields.add(name);
        } catch {
          return;
        }
      }
    });
    return;
  }

  const [name] = entries;
  if (!name || !fieldNames.has(name) || filledFields.has(name)) return;
  try {
    const field = form.getTextField(name);
    field.setText(text);
    filledFields.add(name);
  } catch {
    try {
      const checkbox = form.getCheckBox(name);
      if (isBoolean ? value : isTruthy(text)) checkbox.check();
      else checkbox.uncheck();
      filledFields.add(name);
    } catch {
      return;
    }
  }
}

function applyFieldMap(params: {
  form: ReturnType<PDFDocument['getForm']>;
  fieldNames: Set<string>;
  fields: Record<string, unknown>;
  fieldMap: Record<string, FormFieldName>;
}) {
  const { form, fieldNames, fields, fieldMap } = params;
  const filledFields = new Set<string>();

  Object.entries(fieldMap).forEach(([key, fieldName]) => {
    if (!(key in fields)) return;
    setFieldValue({ form, fieldNames, fieldName, value: fields[key], filledFields });
  });

  Object.entries(fields).forEach(([key, value]) => {
    if (key in fieldMap) return;
    if (!fieldNames.has(key)) return;
    setFieldValue({ form, fieldNames, fieldName: key, value, filledFields });
  });
}

export async function renderCommissioningChecklist(input: RenderInput): Promise<RenderResult> {
  const parsed = RenderInputSchema.parse(input);
  const issuedAt = parsed.issuedAt ?? new Date();
  const issuedAtText = issuedAt.toLocaleDateString('en-GB');
  const commissioningDate = resolveDateValue(parsed.fields.commissioning_date ?? parsed.fields.issued_at, issuedAtText);
  const nextServiceDue = resolveDateValue(parsed.fields.next_service_due, '');
  const jobReference =
    normalizeText(parsed.fields.job_reference) ||
    normalizeText(parsed.fields.cert_no) ||
    normalizeText(parsed.fields.record_id);
  const issuedByName = normalizeText(parsed.fields.print_name_issued) || normalizeText(parsed.fields.engineer_name);
  const receivedByName = normalizeText(parsed.fields.print_name_received) || normalizeText(parsed.fields.client_name);

  const fields = {
    ...parsed.fields,
    commissioning_date: commissioningDate,
    next_service_due: nextServiceDue,
    job_reference: jobReference,
    print_name_issued: issuedByName,
    print_name_received: receivedByName,
  } as Record<string, unknown>;

  const templateBytes = await loadCommissioningTemplateBytes();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const fieldNames = getFormFieldNames(form);
  applyFieldMap({
    form,
    fieldNames,
    fields,
    fieldMap: COMMISSIONING_CHECKLIST_FIELD_MAP as Record<string, FormFieldName>,
  });

  form.updateFieldAppearances(font);

  const pdfBytes = await pdfDoc.save();
  return {
    pdfBytes,
    filename: `commissioning-checklist-${parsed.jobId}.pdf`,
    title: 'Commissioning checklist',
    kind: 'commissioning',
    metadata: {
      issued_at: issuedAtText,
    },
  };
}
