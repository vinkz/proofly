import fs from 'node:fs/promises';
import path from 'node:path';

import { PDFDocument } from 'pdf-lib';

export type PdfFieldInfo = {
  name: string;
  type: string;
  rect: { x: number; y: number; width: number; height: number } | null;
};

const GAS_BREAKDOWN_TEMPLATE_REL_PATH = 'src/assets/templates/gas-breakdown-template.pdf';
const COMMISSIONING_TEMPLATE_REL_PATH = 'src/assets/templates/commissioning-checklist-template.pdf';

async function loadTemplateBytes(templatePath: string) {
  const absolute = path.join(process.cwd(), templatePath);
  const file = await fs.readFile(absolute);
  return new Uint8Array(file);
}

function getFieldRect(field: { acroField?: { getWidgets?: () => { getRectangle?: () => unknown }[] } }) {
  try {
    const widgets = field.acroField?.getWidgets?.();
    const rect = widgets?.[0]?.getRectangle?.() as { x: number; y: number; width: number; height: number } | undefined;
    if (!rect) return null;
    return rect;
  } catch {
    return null;
  }
}

export async function listGasBreakdownPdfFields(): Promise<PdfFieldInfo[]> {
  const bytes = await loadTemplateBytes(GAS_BREAKDOWN_TEMPLATE_REL_PATH);
  const doc = await PDFDocument.load(bytes);
  const fields = doc.getForm().getFields();

  return fields
    .map((field) => ({
      name: field.getName(),
      type: field.constructor?.name ?? 'UnknownField',
      rect: getFieldRect(field as unknown as { acroField?: { getWidgets?: () => { getRectangle?: () => unknown }[] } }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listCommissioningPdfFields(): Promise<PdfFieldInfo[]> {
  const bytes = await loadTemplateBytes(COMMISSIONING_TEMPLATE_REL_PATH);
  const doc = await PDFDocument.load(bytes);
  const fields = doc.getForm().getFields();

  return fields
    .map((field) => ({
      name: field.getName(),
      type: field.constructor?.name ?? 'UnknownField',
      rect: getFieldRect(field as unknown as { acroField?: { getWidgets?: () => { getRectangle?: () => unknown }[] } }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
