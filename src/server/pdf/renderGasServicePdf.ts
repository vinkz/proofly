import fs from 'node:fs/promises';
import path from 'node:path';

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

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
  applianceType?: string;
  applianceMake?: string;
  applianceModel?: string;
  applianceLocation?: string;
  applianceSerial?: string;
  highCombustionRatio?: string;
  highCombustionCoPpm?: string;
  highCombustionCo2?: string;
  lowCombustionRatio?: string;
  lowCombustionCoPpm?: string;
  lowCombustionCo2?: string;
  applianceOperatingCorrectly?: string;
  applianceConformsStandards?: string;
  applianceControlsChecked?: string;
  operatingPressure?: string;
  heatInput?: string;
  boilerWorkingCorrectly?: string;
  cylinderConditionChecked?: string;
  programmerControlsWorking?: string;
  coAlarmFitted?: string;
  applianceSafe?: string;
  allFunctionalPartsAvailable?: string;
  applianceFlueingSafe?: string;
  applianceVentilationSafe?: string;
  emissionCombustionTest?: string;
  burnerPressureCorrect?: string;
  tightnessTest?: string;
  warmAirGrillsWorking?: string;
  pipeworkFreeFromLeaks?: string;
  magneticFilterFitted?: string;
  waterQualityAcceptable?: string;
  warningNoticeExplained?: string;
  applianceReplacementRecommended?: string;
  systemImprovementsRecommended?: string;
  nextServiceDate?: string;
  engineerComments?: string;
  issuedByPrintName?: string;
  receivedByPrintName?: string;
  issuedDate?: string;
  engineerSignatureUrl?: string;
  customerSignatureUrl?: string;
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

async function loadGasServiceTemplateBytes(): Promise<Uint8Array> {
  const templatePath = path.join(process.cwd(), GAS_SERVICE_TEMPLATE_REL_PATH);
  const file = await fs.readFile(templatePath);
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
  applianceType: '29',
  applianceMake: '30',
  applianceModel: '31',
  applianceLocation: '32',
  applianceSerial: '33',
  highCombustionRatio: '34',
  highCombustionCoPpm: '35',
  highCombustionCo2: '36',
  lowCombustionRatio: '37',
  lowCombustionCoPpm: '38',
  lowCombustionCo2: '39',
  applianceOperatingCorrectly: '40',
  applianceConformsStandards: '41',
  applianceControlsChecked: '42',
  operatingPressure: '43',
  heatInput: '44',
  boilerWorkingCorrectly: '45',
  cylinderConditionChecked: '46',
  programmerControlsWorking: '47',
  coAlarmFitted: '48',
  applianceSafe: '49',
  allFunctionalPartsAvailable: '50',
  nextServiceDate: '51',
  applianceFlueingSafe: '52',
  applianceVentilationSafe: '53',
  emissionCombustionTest: '54',
  burnerPressureCorrect: '55',
  tightnessTest: '56',
  warmAirGrillsWorking: '57',
  pipeworkFreeFromLeaks: '58',
  magneticFilterFitted: '59',
  waterQualityAcceptable: '60',
  warningNoticeExplained: '61',
  applianceReplacementRecommended: '62',
  systemImprovementsRecommended: '63',
  engineerComments: '2',
  issuedByPrintName: '68',
  receivedByPrintName: '3',
  issuedDate: '69',
  engineerSignatureUrl: null,
  customerSignatureUrl: null,
};

type SignaturePlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const GAS_SERVICE_SIGNATURE_PLACEMENTS: Record<'engineer' | 'customer', SignaturePlacement> = {
  engineer: { x: 250, y: 47, width: 165, height: 22 },
  customer: { x: 442, y: 47, width: 165, height: 22 },
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
  page: PDFPage,
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

function drawBrandWordmark(page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont }, pageHeight: number) {
  const x = 30;
  const baselineY = pageHeight - 34;

  page.drawText('certnow', {
    x,
    y: baselineY,
    size: 20,
    font: fonts.bold,
    color: rgb(0.07, 0.09, 0.13),
  });

  page.drawText('Field compliance', {
    x: x + 60,
    y: baselineY + 4,
    size: 6.5,
    font: fonts.regular,
    color: rgb(0.45, 0.49, 0.56),
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

async function drawSignatureIfPresent(params: {
  page: PDFPage;
  pdfDoc: PDFDocument;
  url?: string;
  placement: SignaturePlacement;
}) {
  const { page, pdfDoc, url, placement } = params;
  const target = normalizeText(url);
  if (!target) return;

  const fetched = await fetchAssetBytes(target);
  if (!fetched) return;

  try {
    if (fetched.mime.includes('svg')) {
      const svg = Buffer.from(fetched.bytes).toString('utf8');
      const pathMatch = svg.match(/<path[^>]*d="([^"]+)"/i);
      const viewBoxMatch = svg.match(/viewBox="([\d.\s-]+)"/i);
      if (pathMatch?.[1]) {
        const [, rawViewBox = '0 0 320 90'] = viewBoxMatch ?? [];
        const [, , viewBoxWidth = '320', viewBoxHeight = '90'] = rawViewBox.trim().split(/\s+/);
        const sourceWidth = Number(viewBoxWidth) || 320;
        const sourceHeight = Number(viewBoxHeight) || 90;
        const padding = 3;
        const scale = Math.min(
          (placement.width - padding * 2) / sourceWidth,
          (placement.height - padding * 2) / sourceHeight,
        );
        page.drawSvgPath(pathMatch[1], {
          x: placement.x + padding,
          y: placement.y + (placement.height - sourceHeight * scale) / 2,
          scale,
          borderColor: rgb(0.1, 0.15, 0.2),
          borderWidth: 1.1,
        });
      }
      return;
    }

    const image = fetched.mime.includes('png')
      ? await pdfDoc.embedPng(fetched.bytes)
      : await pdfDoc.embedJpg(fetched.bytes);
    const padding = 3;
    const dims = image.scaleToFit(placement.width - padding * 2, placement.height - padding * 2);
    const x = placement.x + (placement.width - dims.width) / 2;
    const y = placement.y + (placement.height - dims.height) / 2;
    page.drawImage(image, { x, y, width: dims.width, height: dims.height });
  } catch {
    // Ignore signature rendering failures and leave the document otherwise usable.
  }
}

async function drawAppliances(
  pdfDoc: PDFDocument,
  templateDoc: PDFDocument,
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  appliances: ApplianceInput[],
) {
  const { startX, startYOffset, rowHeight, maxRowsPerPage, columns, titleYOffset } = GAS_SERVICE_APPLIANCE_TABLE;
  type ApplianceColumnKey = keyof typeof columns;
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
    const drawCell = (field: ApplianceColumnKey) => {
      const colCfg = columns[field];
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

function getGasFieldCoords(height: number): Partial<Record<keyof GasServiceFieldMap, FieldConfig>> {
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
  const templateBytes = await loadGasServiceTemplateBytes();

  const templateDoc = await PDFDocument.load(templateBytes);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const formFieldNames = getFormFieldNames(form);
  const filledFields = new Set<string>();

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular: regularFont, bold: boldFont };

  const [page] = pdfDoc.getPages();
  const { height } = page.getSize();
  drawBrandWordmark(page, fonts, height);

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

    await drawSignatureIfPresent({
      page,
      pdfDoc,
      url: fields.engineerSignatureUrl,
      placement: GAS_SERVICE_SIGNATURE_PLACEMENTS.engineer,
    });
    await drawSignatureIfPresent({
      page,
      pdfDoc,
      url: fields.customerSignatureUrl,
      placement: GAS_SERVICE_SIGNATURE_PLACEMENTS.customer,
    });
  } else {
    const fieldCoords = getGasFieldCoords(height);
    (Object.keys(fieldCoords) as (keyof GasServiceFieldMap)[]).forEach((key) => {
      drawField(page, fonts, fieldCoords[key], fields[key]);
    });
  }

  const applianceFieldNames = Object.values(getApplianceFieldNames(0));
  const hasDetailedTemplateFields = formFieldNames.size > 0 && formFieldNames.has('29');
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
  } else if (!hasDetailedTemplateFields) {
    await drawAppliances(pdfDoc, templateDoc, page, fonts, input.appliances ?? []);
  }

  form.updateFieldAppearances(regularFont);

  const bytes = await pdfDoc.save();
  return new Uint8Array(bytes);
}
