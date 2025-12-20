import fs from 'node:fs/promises';
import path from 'node:path';

import { PDFDocument, StandardFonts, type PDFFont } from 'pdf-lib';

export type ApplianceInput = {
  description: string;
  location: string;
  type: string;
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

export type Cp12FieldMap = {
  certNumber?: string;
  issueDate?: string;
  nextInspectionDue?: string;
  landlordName?: string;
  landlordAddressLine1?: string;
  landlordAddressLine2?: string;
  landlordTown?: string;
  landlordPostcode?: string;
  propertyAddressLine1?: string;
  propertyAddressLine2?: string;
  propertyTown?: string;
  propertyPostcode?: string;
  companyName?: string;
  companyAddressLine1?: string;
  companyAddressLine2?: string;
  companyTown?: string;
  companyPostcode?: string;
  companyPhone?: string;
  companyEmail?: string;
  gasSafeRegistrationNumber?: string;
  engineerName?: string;
  engineerIdNumber?: string;
  engineerSignatureText?: string;
  engineerVisitTime?: string;
  responsiblePersonName?: string;
  responsiblePersonSignatureText?: string;
  responsiblePersonAcknowledgementDate?: string;
  defectsIdentified?: string;
  remedialWorksRequired?: string;
  additionalNotes?: string;
};

export type RenderCp12CertificateInput = {
  fields: Cp12FieldMap;
  appliances: ApplianceInput[];
  recordId: string;
  issuedAt: Date;
  companyLogoBytes?: Uint8Array;
};

type FormFieldName = string | string[] | null;

const CP12_TEMPLATE_REL_PATH = 'src/assets/templates/cp12-template.pdf';

async function loadCp12TemplateBytes(): Promise<Uint8Array> {
  const templatePath = path.join(process.cwd(), CP12_TEMPLATE_REL_PATH);
  const file = await fs.readFile(templatePath);
  return new Uint8Array(file);
}

const CP12_FORM_FIELD_NAMES: Record<keyof Cp12FieldMap, FormFieldName> = {
  certNumber: 'Cert_no',
  issueDate: 'signatures.issued_date',
  nextInspectionDue: 'safety_checks.due',
  landlordName: 'customer.name',
  landlordAddressLine1: 'customer.address_line_1',
  landlordAddressLine2: 'customer.address_line_2',
  landlordTown: 'customer.address_line_3',
  landlordPostcode: 'customer.post_code',
  propertyAddressLine1: 'job_address.address_line_1',
  propertyAddressLine2: 'job_address.address_line_2',
  propertyTown: 'job_address.address_line_3',
  propertyPostcode: 'job_address.post_code',
  companyName: 'company.company',
  companyAddressLine1: 'company.address_line_1',
  companyAddressLine2: 'company.address_line_2',
  companyTown: 'company.address_line_3',
  companyPostcode: 'company.post_code',
  companyPhone: 'company.tel_no',
  companyEmail: 'company.address_line_4',
  gasSafeRegistrationNumber: 'company.gas_safe_reg',
  engineerName: 'company.engineer',
  engineerIdNumber: 'company.id_card_no',
  engineerVisitTime: null,
  engineerSignatureText: 'signatures.engineer_name',
  responsiblePersonName: 'signatures.customer_name',
  responsiblePersonSignatureText: 'signatures.customer_name',
  responsiblePersonAcknowledgementDate: 'signatures.issued_date',
  defectsIdentified: 'comments.comments',
  remedialWorksRequired: 'comments.comments',
  additionalNotes: 'comments.comments',
};

const APPLIANCE_TABLE = {
  startX: 40,
  startYOffset: 280, // distance from top
  rowHeight: 16,
  maxRowsPerPage: 6,
  columns: {
    description: { xOffset: 0, width: 140 },
    location: { xOffset: 150, width: 90 },
    type: { xOffset: 250, width: 80 },
    flueType: { xOffset: 335, width: 60 },
    operatingPressure: { xOffset: 400, width: 70 },
    heatInput: { xOffset: 470, width: 70 },
    safetyDevice: { xOffset: 540, width: 70 },
    ventilationSatisfactory: { xOffset: 610, width: 30 },
    flueTerminationSatisfactory: { xOffset: 645, width: 30 },
    spillageTest: { xOffset: 680, width: 40 },
    applianceSafeToUse: { xOffset: 720, width: 50 },
  },
} as const;

function getApplianceFieldNames(index: number): Record<keyof ApplianceInput, FormFieldName> {
  const i = index + 1;
  return {
    description: [`appliance_${i}.make`, `appliance_${i}.model`],
    location: `appliance_${i}.location`,
    type: `appliance_${i}.type`,
    flueType: `appliance_${i}.flue_type`,
    operatingPressure: `appliance_${i}.operating_pressure`,
    heatInput: `appliance_${i}.heat_input`,
    safetyDevice: `appliance_${i}.safety_devices`,
    ventilationSatisfactory: `appliance_${i}.ventilation`,
    flueTerminationSatisfactory: `appliance_${i}.flue_performance`,
    spillageTest: `appliance_${i}.visual_condition`,
    applianceSafeToUse: `appliance_${i}.safe_to_use`,
    remedialActionTaken: `appliance_${i}.defects`,
  };
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

function buildCombinedComments(fields: Cp12FieldMap) {
  const lines: string[] = [];
  if (fields.defectsIdentified) {
    lines.push(`Defects: ${fields.defectsIdentified}`);
  }
  if (fields.remedialWorksRequired) {
    lines.push(`Remedial: ${fields.remedialWorksRequired}`);
  }
  if (fields.additionalNotes) {
    lines.push(`Notes: ${fields.additionalNotes}`);
  }
  if (!lines.length) return undefined;
  return lines.join('\n');
}

async function drawAppliances(
  pdfDoc: PDFDocument,
  templateDoc: PDFDocument,
  page: any,
  font: PDFFont,
  appliances: ApplianceInput[],
) {
  const { startX, startYOffset, rowHeight, maxRowsPerPage, columns } = APPLIANCE_TABLE;
  let currentPage = page;
  const { height } = currentPage.getSize();
  let currentY = height - startYOffset;
  let rowIndex = 0;

  const writeRow = (appliance: ApplianceInput) => {
    const size = 8;
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

    drawCell('description');
    drawCell('location');
    drawCell('type');
    drawCell('flueType');
    drawCell('operatingPressure');
    drawCell('heatInput');
    drawCell('safetyDevice');
    drawCell('ventilationSatisfactory');
    drawCell('flueTerminationSatisfactory');
    drawCell('spillageTest');
    drawCell('applianceSafeToUse');
  };

  for (const appliance of appliances) {
    if (rowIndex >= maxRowsPerPage) {
      const [templatePage] = await pdfDoc.copyPages(templateDoc, [0]);
      pdfDoc.addPage(templatePage);
      currentPage = templatePage;
      const { height: newHeight } = currentPage.getSize();
      currentY = newHeight - startYOffset;
      rowIndex = 0;
    }

    writeRow(appliance);
    currentY -= rowHeight;
    rowIndex += 1;
  }
}

export async function renderCp12CertificatePdf(input: RenderCp12CertificateInput): Promise<Uint8Array> {
  const templateBytes = await loadCp12TemplateBytes();

  const templateDoc = await PDFDocument.load(templateBytes);
  const pdfDoc = await PDFDocument.load(templateBytes);

  const form = pdfDoc.getForm();
  const formFieldNames = getFormFieldNames(form);
  const filledFields = new Set<string>();

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const [page] = pdfDoc.getPages();

  const fields: Cp12FieldMap = {
    ...input.fields,
    issueDate: input.fields.issueDate ?? input.issuedAt.toLocaleDateString('en-GB'),
  };

  const combinedComments = buildCombinedComments(fields);
  setTextIfExists({
    form,
    fieldNames: formFieldNames,
    fieldName: 'comments.comments',
    value: combinedComments,
    filledFields,
  });

  const engineerSignatureValue = fields.engineerSignatureText ?? fields.engineerName;
  setTextIfExists({
    form,
    fieldNames: formFieldNames,
    fieldName: 'signatures.engineer_name',
    value: engineerSignatureValue,
    filledFields,
  });

  const responsibleSignatureValue = fields.responsiblePersonSignatureText ?? fields.responsiblePersonName;
  setTextIfExists({
    form,
    fieldNames: formFieldNames,
    fieldName: 'signatures.customer_name',
    value: responsibleSignatureValue,
    filledFields,
  });

  const issuedDateValue = fields.responsiblePersonAcknowledgementDate ?? fields.issueDate;
  setTextIfExists({
    form,
    fieldNames: formFieldNames,
    fieldName: 'signatures.issued_date',
    value: issuedDateValue,
    filledFields,
  });

  const skipKeys = new Set<keyof Cp12FieldMap>([
    'issueDate',
    'engineerSignatureText',
    'responsiblePersonName',
    'responsiblePersonSignatureText',
    'responsiblePersonAcknowledgementDate',
    'defectsIdentified',
    'remedialWorksRequired',
    'additionalNotes',
  ]);

  (Object.keys(CP12_FORM_FIELD_NAMES) as (keyof Cp12FieldMap)[]).forEach((key) => {
    if (skipKeys.has(key)) return;
    setTextIfExists({
      form,
      fieldNames: formFieldNames,
      fieldName: CP12_FORM_FIELD_NAMES[key],
      value: fields[key],
      filledFields,
    });
  });

  const firstApplianceFieldNames = Object.values(getApplianceFieldNames(0));
  const useFormAppliances = hasAnyFormField(formFieldNames, firstApplianceFieldNames);

  if (useFormAppliances) {
    const rows = input.appliances.slice(0, APPLIANCE_TABLE.maxRowsPerPage);
    rows.forEach((appliance, index) => {
      const names = getApplianceFieldNames(index);
      (Object.keys(names) as (keyof ApplianceInput)[]).forEach((key) => {
        setTextIfExists({
          form,
          fieldNames: formFieldNames,
          fieldName: names[key],
          value: appliance[key],
          filledFields,
        });
      });
    });
  } else {
    await drawAppliances(pdfDoc, templateDoc, page, regularFont, input.appliances ?? []);
  }

  form.updateFieldAppearances(regularFont);

  const bytes = await pdfDoc.save();
  return new Uint8Array(bytes);
}
