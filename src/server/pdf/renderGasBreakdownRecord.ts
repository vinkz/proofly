import fs from 'node:fs/promises';
import path from 'node:path';

import { PDFDocument, StandardFonts } from 'pdf-lib';
import { z } from 'zod';

import { GAS_BREAKDOWN_FIELD_MAP } from '@/lib/pdf/fieldMaps/gasBreakdown';

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
  kind: 'breakdown';
  metadata?: Record<string, unknown>;
};

const GAS_BREAKDOWN_TEMPLATE_REL_PATH = 'src/assets/templates/gas-breakdown-template.pdf';
const templateCache: Record<string, Uint8Array> = {};

const RenderInputSchema = z.object({
  jobId: z.string().uuid(),
  fields: z.record(z.string(), z.unknown()),
  issuedAt: z.date().optional(),
});

async function loadGasBreakdownTemplateBytes(): Promise<Uint8Array> {
  if (templateCache[GAS_BREAKDOWN_TEMPLATE_REL_PATH]) {
    return templateCache[GAS_BREAKDOWN_TEMPLATE_REL_PATH];
  }
  const templatePath = path.join(process.cwd(), GAS_BREAKDOWN_TEMPLATE_REL_PATH);
  const file = await fs.readFile(templatePath);
  const bytes = new Uint8Array(file);
  templateCache[GAS_BREAKDOWN_TEMPLATE_REL_PATH] = bytes;
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

function formatBoolean(value: unknown) {
  return isTruthy(value) ? 'Yes' : '';
}

function buildBreakdownSummary(fields: Record<string, unknown>) {
  const summary: Array<[string, string]> = [
    ['Reported issue', normalizeText(fields.reported_issue)],
    ['Diagnostics', normalizeText(fields.diagnostics)],
    ['Actions taken', normalizeText(fields.actions_taken)],
    ['Fault location', normalizeText(fields.fault_location)],
    ['Part fitted', normalizeText(fields.part_fitted)],
    ['Fault resolved', formatBoolean(fields.fault_resolved)],
    ['Parts required', normalizeText(fields.parts_required)],
  ];

  const lines = summary.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`);
  return lines.length ? lines.join('\n') : '';
}

function buildAdviceSummary(fields: Record<string, unknown>) {
  const summary: Array<[string, string]> = [
    ['Appliance safe', formatBoolean(fields.advice_appliance_safe)],
    ['System improvements recommended', formatBoolean(fields.advice_system_improvements)],
    ['All functional parts available', formatBoolean(fields.advice_all_parts_available)],
    ['Recommended replacement', formatBoolean(fields.advice_replacement_recommended)],
    ['Magnetic filter fitted', formatBoolean(fields.advice_magnetic_filter)],
    ['CO alarm fitted', formatBoolean(fields.advice_co_alarm)],
    ['Advice', normalizeText(fields.advice_text)],
  ];
  const lines = summary.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`);
  return lines.length ? lines.join('\n') : '';
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

export async function renderGasBreakdownRecord(input: RenderInput): Promise<RenderResult> {
  const parsed = RenderInputSchema.parse(input);
  const issuedAt = parsed.issuedAt ?? new Date();
  const issuedAtText = issuedAt.toLocaleDateString('en-GB');
  const breakdownSummary = buildBreakdownSummary(parsed.fields);
  const adviceSummary = buildAdviceSummary(parsed.fields);
  const visitDate = resolveDateValue(parsed.fields.job_visit_date ?? parsed.fields.visit_date ?? parsed.fields.issued_at, issuedAtText);
  const jobReference =
    normalizeText(parsed.fields.job_reference) ||
    normalizeText(parsed.fields.cert_no) ||
    normalizeText(parsed.fields.record_id);
  const issuedByName = normalizeText(parsed.fields.issued_by_name) || normalizeText(parsed.fields.engineer_name);
  const receivedByName = normalizeText(parsed.fields.received_by_name) || normalizeText(parsed.fields.client_name);

  const fields = {
    ...parsed.fields,
    job_visit_date: visitDate,
    job_reference: jobReference,
    breakdown_summary: breakdownSummary,
    advice_summary: adviceSummary,
    issued_by_name: issuedByName,
    received_by_name: receivedByName,
  } as Record<string, unknown>;

  const templateBytes = await loadGasBreakdownTemplateBytes();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const fieldNames = getFormFieldNames(form);
  applyFieldMap({ form, fieldNames, fields, fieldMap: GAS_BREAKDOWN_FIELD_MAP as Record<string, FormFieldName> });

  form.updateFieldAppearances(font);

  const pdfBytes = await pdfDoc.save();
  return {
    pdfBytes,
    filename: `gas-breakdown-record-${parsed.jobId}.pdf`,
    title: 'Gas breakdown record',
    kind: 'breakdown',
    metadata: {
      issued_at: issuedAtText,
    },
  };
}
