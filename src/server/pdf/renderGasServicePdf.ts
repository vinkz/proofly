import fs from 'node:fs/promises';
import path from 'node:path';

import { PDFDocument, StandardFonts, type PDFFont } from 'pdf-lib';

export type ApplianceInput = {
  description: string;
  location: string;
  type: string;
  make?: string;
  model?: string;
  serial?: string;
  flueType?: string;
  operatingPressure?: string;
  heatInput?: string;
  safetyDevice?: string;
  ventilationSatisfactory?: string;
  flueTerminationSatisfactory?: string;
  spillageTest?: string;
  applianceSafeToUse?: string;
  remedialActionTaken?: string;
};

export type GasServiceFieldMap = {
  certNumber?: string;
  engineerName?: string;
  companyName?: string;
  companyAddressLine1?: string;
  companyAddressLine2?: string;
  companyTown?: string;
  companyPostcode?: string;
  companyPhone?: string;
  gasSafeNumber?: string;
  engineerId?: string;
  jobName?: string;
  jobAddressLine1?: string;
  jobAddressLine2?: string;
  jobTown?: string;
  jobPostcode?: string;
  jobPhone?: string;
  clientName?: string;
  clientCompany?: string;
  clientAddressLine1?: string;
  clientAddressLine2?: string;
  clientTown?: string;
  clientPostcode?: string;
  clientPhone?: string;
  nextServiceDate?: string;
  engineerComments?: string;
};

export type RenderGasServiceInput = {
  fields: GasServiceFieldMap;
  appliances: ApplianceInput[];
  recordId: string;
  issuedAt: Date;
  companyLogoBytes?: Uint8Array;
};

type FieldConfig = {
  x: number;
  y: number;
  size?: number;
  bold?: boolean;
  maxWidth?: number;
};

type FormFieldName = string | string[] | null;

const GAS_SERVICE_TEMPLATE_REL_PATH = 'src/assets/templates/gas-service-template.pdf';
const CERTNOW_LOGO_REL_PATH = 'src/app/assets/branding/certnow-logo.png';

async function loadGasServiceTemplateBytes(): Promise<Uint8Array> {
  const templatePath = path.join(process.cwd(), GAS_SERVICE_TEMPLATE_REL_PATH);
  const file = await fs.readFile(templatePath);
  return new Uint8Array(file);
}

async function loadDefaultLogoBytes(): Promise<Uint8Array> {
  const logoPath = path.join(process.cwd(), CERTNOW_LOGO_REL_PATH);
  const file = await fs.readFile(logoPath);
  return new Uint8Array(file);
}

// Update names to match the AcroForm field names in gas-service-template.pdf.
const GAS_SERVICE_FORM_FIELD_NAMES: Record<keyof GasServiceFieldMap, FormFieldName> = {
  certNumber: '1',
  engineerName: '4',
  companyName: '5',
  companyAddressLine1: '6',
  companyAddressLine2: '7',
  companyTown: '8',
  companyPostcode: '9',
  companyPhone: '10',
  gasSafeNumber: '11',
  engineerId: '12',
  jobName: '14',
  jobAddressLine1: '15',
  jobAddressLine2: '16',
  jobTown: '17',
  jobPostcode: '18',
  jobPhone: '19',
  clientName: '21',
  clientCompany: '22',
  clientAddressLine1: '23',
  clientAddressLine2: '24',
  clientTown: '25',
  clientPostcode: '26',
  clientPhone: '27',
  nextServiceDate: '51',
  engineerComments: '2',
};

type ApplianceTableFieldNames = {
  type: FormFieldName;
  make: FormFieldName;
  model: FormFieldName;
  location: FormFieldName;
  serial: FormFieldName;
};

function getApplianceFieldNames(index: number): ApplianceTableFieldNames {
  const i = index + 1;
  return {
    type: `appliance_${i}_type`,
    make: `appliance_${i}_make`,
    model: `appliance_${i}_model`,
    location: `appliance_${i}_location`,
    serial: `appliance_${i}_serial`,
  };
}

function drawField(
  page: any,
  fonts: { regular: PDFFont; bold: PDFFont },
  fieldConfig: FieldConfig | undefined,
  value: string | undefined,
) {
  if (!fieldConfig || !value) return;
  const font = fieldConfig.bold ? fonts.bold : fonts.regular;
  const size = fieldConfig.size ?? 10;

  if (!fieldConfig.maxWidth) {
    page.drawText(value, {
      x: fieldConfig.x,
      y: fieldConfig.y,
      size,
      font,
    });
    return;
  }

  const words = value.split(' ');
  const lineHeight = size + 2;
  let line = '';
  let currentY = fieldConfig.y;

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

function getFormFieldNames(form: ReturnType<PDFDocument['getForm']>) {
  return new Set(form.getFields().map((field) => field.getName()));
}

function normalizeText(value: string | undefined) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function toFieldNameList(fieldName: FormFieldName) {
  if (!fieldName) return [];
  return Array.isArray(fieldName) ? fieldName : [fieldName];
}

function hasAnyFormField(fieldNames: Set<string>, names: FormFieldName[]) {
  return names.some((name) => toFieldNameList(name).some((entry) => fieldNames.has(entry)));
}

function setTextIfExists(params: {
  form: ReturnType<PDFDocument['getForm']>;
  fieldNames: Set<string>;
  fieldName: FormFieldName;
  value: string | undefined;
  filledFields: Set<string>;
}) {
  const { form, fieldNames, fieldName, value, filledFields } = params;
  const text = normalizeText(value);
  if (!text) return;
  const entries = toFieldNameList(fieldName);
  if (!entries.length) return;
  entries.forEach((name) => {
    if (!fieldNames.has(name) || filledFields.has(name)) return;
    try {
      const field = form.getTextField(name);
      field.setText(text);
      filledFields.add(name);
    } catch {
      // Ignore missing fields or non-text fields.
    }
  });
}

async function drawAppliances(
  pdfDoc: PDFDocument,
  templateDoc: PDFDocument,
  page: any,
  fonts: { regular: PDFFont; bold: PDFFont },
  appliances: ApplianceInput[],
) {
  const { startX, startYOffset, rowHeight, maxRowsPerPage, columns, titleYOffset } = GAS_SERVICE_APPLIANCE_TABLE;
  let currentPage = page;
  const { height } = currentPage.getSize();
  let currentY = height - startYOffset;
  let rowIndex = 0;

  const drawTitle = () => {
    const titleY = height - titleYOffset;
    currentPage.drawText('Appliance Details', {
      x: startX,
      y: titleY,
      size: 11,
      font: fonts.bold,
    });
  };

  drawTitle();

  const writeRow = (appliance: ApplianceInput) => {
    const size = 8;
    const font = fonts.regular;
    const drawCell = (field: keyof ApplianceInput) => {
      const colCfg = (columns as any)[field];
      if (!colCfg) return;
      const value = appliance[field];
      if (!value) return;
      currentPage.drawText(String(value), {
        x: startX + colCfg.xOffset,
        y: currentY,
        size,
        font,
      });
    };

    drawCell('type');
    drawCell('make');
    drawCell('model');
    drawCell('location');
    drawCell('serial');
  };

  for (const appliance of appliances) {
    if (rowIndex >= maxRowsPerPage) {
      const [templatePage] = await pdfDoc.copyPages(templateDoc, [0]);
      pdfDoc.addPage(templatePage);
      currentPage = templatePage;
      const { height: newHeight } = currentPage.getSize();
      currentY = newHeight - startYOffset;
      rowIndex = 0;
      drawTitle();
    }

    writeRow(appliance);
    currentY -= rowHeight;
    rowIndex += 1;
  }
}

const GAS_SERVICE_APPLIANCE_TABLE = {
  startX: 40,
  titleYOffset: 250,
  startYOffset: 280, // distance from top
  rowHeight: 16,
  maxRowsPerPage: 6,
  columns: {
    type: { xOffset: 0, width: 90 },
    make: { xOffset: 100, width: 120 },
    model: { xOffset: 230, width: 120 },
    location: { xOffset: 360, width: 140 },
    serial: { xOffset: 510, width: 120 },
  },
} as const;

function getGasFieldCoords(height: number): Record<keyof GasServiceFieldMap, FieldConfig> {
  const baseX = 100;
  const rowGap = 14;
  const topY = height - 120;

  return {
    certNumber: { x: baseX, y: topY, size: 10, bold: true },
    engineerName: { x: baseX, y: topY - rowGap },
    companyName: { x: baseX, y: topY - rowGap * 2, bold: true },
    companyAddressLine1: { x: baseX, y: topY - rowGap * 3 },
    companyAddressLine2: { x: baseX, y: topY - rowGap * 4 },
    companyTown: { x: baseX, y: topY - rowGap * 5 },
    companyPostcode: { x: baseX, y: topY - rowGap * 6 },
    companyPhone: { x: baseX, y: topY - rowGap * 7 },
    gasSafeNumber: { x: baseX + 260, y: topY - rowGap },
    engineerId: { x: baseX + 260, y: topY - rowGap * 2 },
    jobName: { x: baseX + 260, y: topY - rowGap * 3 },
    jobAddressLine1: { x: baseX + 260, y: topY - rowGap * 4 },
    jobAddressLine2: { x: baseX + 260, y: topY - rowGap * 5 },
    jobTown: { x: baseX + 260, y: topY - rowGap * 6 },
    jobPostcode: { x: baseX + 260, y: topY - rowGap * 7 },
    jobPhone: { x: baseX + 260, y: topY - rowGap * 8 },
    clientName: { x: baseX + 520, y: topY - rowGap * 3 },
    clientCompany: { x: baseX + 520, y: topY - rowGap * 4 },
    clientAddressLine1: { x: baseX + 520, y: topY - rowGap * 5 },
    clientAddressLine2: { x: baseX + 520, y: topY - rowGap * 6 },
    clientTown: { x: baseX + 520, y: topY - rowGap * 7 },
    clientPostcode: { x: baseX + 520, y: topY - rowGap * 8 },
    clientPhone: { x: baseX + 520, y: topY - rowGap * 9 },
    nextServiceDate: { x: baseX, y: topY - rowGap * 9 },
    engineerComments: { x: baseX, y: topY - rowGap * 12, maxWidth: 360, size: 9 },
  };
}

export async function renderGasServicePdf(input: RenderGasServiceInput): Promise<Uint8Array> {
  const [templateBytes, defaultLogoBytes] = await Promise.all([loadGasServiceTemplateBytes(), loadDefaultLogoBytes()]);

  const templateDoc = await PDFDocument.load(templateBytes);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const formFieldNames = getFormFieldNames(form);
  const filledFields = new Set<string>();

  const logoBytes = input.companyLogoBytes ?? defaultLogoBytes;
  const logoImage = await pdfDoc.embedPng(logoBytes);

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular: regularFont, bold: boldFont };

  const [page] = pdfDoc.getPages();
  const { height } = page.getSize();

  const desiredLogoWidth = 110;
  const logoAspect = logoImage.height / logoImage.width;
  const desiredLogoHeight = desiredLogoWidth * logoAspect;
  const logoX = 30;
  const logoY = height - desiredLogoHeight - 20;

  page.drawImage(logoImage, {
    x: logoX,
    y: logoY,
    width: desiredLogoWidth,
    height: desiredLogoHeight,
  });

  const fields: GasServiceFieldMap = {
    ...input.fields,
    certNumber: input.fields.certNumber ?? input.recordId,
  };

  if (formFieldNames.size) {
    (Object.keys(GAS_SERVICE_FORM_FIELD_NAMES) as (keyof GasServiceFieldMap)[]).forEach((key) => {
      setTextIfExists({
        form,
        fieldNames: formFieldNames,
        fieldName: GAS_SERVICE_FORM_FIELD_NAMES[key],
        value: fields[key],
        filledFields,
      });
    });
  } else {
    const fieldCoords = getGasFieldCoords(height);
    (Object.keys(fieldCoords) as (keyof GasServiceFieldMap)[]).forEach((key) => {
      drawField(page, fonts, fieldCoords[key], fields[key]);
    });
  }

  const applianceFieldNames = Object.values(getApplianceFieldNames(0));
  const useFormAppliances = formFieldNames.size > 0 && hasAnyFormField(formFieldNames, applianceFieldNames);

  if (useFormAppliances) {
    const rows = input.appliances.slice(0, GAS_SERVICE_APPLIANCE_TABLE.maxRowsPerPage);
    rows.forEach((appliance, index) => {
      const names = getApplianceFieldNames(index);
      setTextIfExists({
        form,
        fieldNames: formFieldNames,
        fieldName: names.type,
        value: appliance.type,
        filledFields,
      });
      setTextIfExists({
        form,
        fieldNames: formFieldNames,
        fieldName: names.make,
        value: appliance.make,
        filledFields,
      });
      setTextIfExists({
        form,
        fieldNames: formFieldNames,
        fieldName: names.model,
        value: appliance.model,
        filledFields,
      });
      setTextIfExists({
        form,
        fieldNames: formFieldNames,
        fieldName: names.location,
        value: appliance.location,
        filledFields,
      });
      setTextIfExists({
        form,
        fieldNames: formFieldNames,
        fieldName: names.serial,
        value: appliance.serial,
        filledFields,
      });
    });
  } else {
    await drawAppliances(pdfDoc, templateDoc, page, fonts, input.appliances ?? []);
  }

  form.updateFieldAppearances(regularFont);

  const bytes = await pdfDoc.save();
  return new Uint8Array(bytes);
}
