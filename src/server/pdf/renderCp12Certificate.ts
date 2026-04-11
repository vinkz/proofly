import fs from 'node:fs/promises';
import path from 'node:path';

import { PDFCheckBox, PDFDict, PDFDocument, PDFName, PDFRadioGroup, PDFTextField, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import { supabaseServerServiceRole } from '@/lib/supabaseServer';

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
  combustionHigh?: string;
  combustionLow?: string;
  combustionHighCoPpm?: string;
  combustionHighCo2?: string;
  combustionHighRatio?: string;
  combustionLowCoPpm?: string;
  combustionLowCo2?: string;
  combustionLowRatio?: string;
  combustionNotes?: string;
  applianceServiced?: string;
  applianceInspected?: string;
  landlordAppliance?: string;
};

export type Cp12FieldMap = {
  certNumber?: string;
  issueDate?: string;
  nextInspectionDue?: string;
  landlordName?: string;
  landlordCompany?: string;
  landlordAddressLine1?: string;
  landlordAddressLine2?: string;
  landlordTown?: string;
  landlordPostcode?: string;
  landlordTel?: string;
  propertyAddressName?: string;
  propertyAddressLine1?: string;
  propertyAddressLine2?: string;
  propertyTown?: string;
  propertyPostcode?: string;
  propertyTel?: string;
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
  engineerSignatureUrl?: string;
  engineerVisitTime?: string;
  responsiblePersonName?: string;
  responsiblePersonSignatureText?: string;
  responsiblePersonSignatureUrl?: string;
  responsiblePersonAcknowledgementDate?: string;
  defectsIdentified?: string;
  remedialWorksRequired?: string;
  warningNoticeIssued?: string;
  additionalNotes?: string;
  coAlarmFitted?: string;
  coAlarmTested?: string;
  coAlarmSatisfactory?: string;
  emergencyControlAccessible?: string;
  gasTightnessSatisfactory?: string;
  pipeworkVisualSatisfactory?: string;
  equipotentialBondingSatisfactory?: string;
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
  landlordCompany: 'customer.company',
  landlordAddressLine1: 'customer.address_line_1',
  landlordAddressLine2: 'customer.address_line_2',
  landlordTown: 'customer.address_line_3',
  landlordPostcode: 'customer.post_code',
  landlordTel: 'customer.tel_no',
  propertyAddressName: 'job_address.name',
  propertyAddressLine1: 'job_address.address_line_1',
  propertyAddressLine2: 'job_address.address_line_2',
  propertyTown: 'job_address.address_line_3',
  propertyPostcode: 'job_address.post_code',
  propertyTel: 'job_address.tel_no',
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
  engineerSignatureUrl: null,
  responsiblePersonName: 'signatures.customer_name',
  responsiblePersonSignatureText: 'signatures.customer_name',
  responsiblePersonSignatureUrl: null,
  responsiblePersonAcknowledgementDate: 'signatures.issued_date',
  defectsIdentified: 'comments.comments',
  remedialWorksRequired: 'comments.comments',
  warningNoticeIssued: null,
  additionalNotes: 'comments.comments',
  coAlarmFitted: 'co_alarms.fitted',
  coAlarmTested: 'co_alarms.tested',
  coAlarmSatisfactory: 'co_alarms.satisfactory',
  emergencyControlAccessible: 'safety_checks.emergency_control',
  gasTightnessSatisfactory: 'safety_checks.tightness',
  pipeworkVisualSatisfactory: 'safety_checks.visual_inspection',
  equipotentialBondingSatisfactory: 'safety_checks.equipotential_bonding',
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
    combustionHigh: { xOffset: 720, width: 60 },
    combustionLow: { xOffset: 785, width: 60 },
    applianceServiced: { xOffset: 850, width: 50 },
    applianceSafeToUse: { xOffset: 905, width: 50 },
  },
} as const;

const FLUE_TYPE_PREFERRED_FONT_SIZE = 6;
const FLUE_TYPE_MIN_FONT_SIZE = 4;
const FLUE_TYPE_TEXT_PADDING = 2;
const CERT_NUMBER_PREFERRED_FONT_SIZE = 7;
const CERT_NUMBER_MIN_FONT_SIZE = 5;
const CERT_NUMBER_TEXT_PADDING = 4;

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
    combustionHigh: null,
    combustionLow: null,
    combustionHighCoPpm: `appliance_${i}.high_co_ppm`,
    combustionHighCo2: `appliance_${i}.high_co2`,
    combustionHighRatio: `appliance_${i}.high_ratio`,
    combustionLowCoPpm: `appliance_${i}.low_co_ppm`,
    combustionLowCo2: `appliance_${i}.low_co2`,
    combustionLowRatio: `appliance_${i}.low_ratio`,
    combustionNotes: null,
    applianceServiced: [`appliance_${i}.appliance_serviced`, `appliance_${i}.serviced`],
    applianceInspected: [`appliance_${i}.appliance_inspected`, `appliance_${i}.inspected`],
    landlordAppliance: `appliance_${i}.landlords_appliance`,
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

function toFieldNameList(fieldName: FormFieldName) {
  if (!fieldName) return [];
  return Array.isArray(fieldName) ? fieldName : [fieldName];
}

function hasAnyFormField(fieldNames: Set<string>, names: FormFieldName[]) {
  return names.some((name) => toFieldNameList(name).some((entry) => fieldNames.has(entry)));
}

const KNOWN_APPLIANCE_MAKES = ['Worcester Bosch', 'Vaillant', 'Ideal', 'Baxi'];

function splitApplianceMakeModel(value: string | undefined) {
  const text = normalizeText(value);
  if (!text) return { make: '', model: '' };
  const knownMake = KNOWN_APPLIANCE_MAKES.find((make) => text.toLowerCase().startsWith(make.toLowerCase()));
  if (knownMake) {
    return { make: knownMake, model: text.slice(knownMake.length).trim() };
  }
  const [make, ...rest] = text.split(/\s+/);
  return { make: make ?? '', model: rest.join(' ').trim() };
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

function isTruthyCheckboxValue(value: unknown) {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['yes', 'true', '1', 'on', 'checked', 'pass', 'y', 'ok'].includes(normalized);
  }
  return Boolean(value);
}

function setFormValue(params: {
  form: ReturnType<PDFDocument['getForm']>;
  fieldNames: Set<string>;
  fieldName: FormFieldName;
  value: string | boolean | undefined;
  filledFields: Set<string>;
}) {
  const { form, fieldNames, fieldName, value, filledFields } = params;
  const entries = toFieldNameList(fieldName);
  if (!entries.length) return;
  const text = normalizeText(typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value));
  const truthy = isTruthyCheckboxValue(value);

  entries.forEach((name) => {
    if (!name || !fieldNames.has(name) || filledFields.has(name)) return;
    try {
      const field = form.getField(name);
      if (field instanceof PDFCheckBox) {
        if (truthy) field.check();
        else field.uncheck();
        filledFields.add(name);
        return;
      }
      if (field instanceof PDFTextField) {
        if (!text) return;
        if (/^appliance_\d+\.flue_type$/.test(name)) {
          try {
            field.setFontSize(6);
          } catch {
            // Ignore if font size cannot be overridden for this field.
          }
        }
        field.setText(text);
        filledFields.add(name);
        return;
      }
      const maybeSetText = (field as unknown as { setText?: (val: string) => void }).setText;
      if (maybeSetText && text) {
        maybeSetText.call(field, text);
        filledFields.add(name);
      }
    } catch {
      // Ignore missing fields or non-text fields.
    }
  });
}

function setSafetyCheckField(params: {
  pdfDoc: PDFDocument;
  form: ReturnType<PDFDocument['getForm']>;
  fieldNames: Set<string>;
  fieldName: FormFieldName;
  value: string | boolean | undefined;
  filledFields: Set<string>;
  debug: boolean;
  applyAfterGlobalAppearanceUpdate: boolean;
  executionOrderLabel: string;
}) {
  const { pdfDoc, form, fieldNames, fieldName, value, filledFields, debug, applyAfterGlobalAppearanceUpdate, executionOrderLabel } = params;
  const entries = toFieldNameList(fieldName);
  if (!entries.length) return;

  const text = normalizeText(typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value));
  const truthy = isTruthyCheckboxValue(value);

  entries.forEach((name) => {
    if (!name || !fieldNames.has(name) || filledFields.has(name)) return;
    try {
      const field = form.getField(name);
      const fieldType = field.constructor?.name ?? 'UnknownField';
      let action = 'none';
      let checkboxIsChecked: boolean | null = null;
      let checkboxNeedsAppearancesUpdate: boolean | null = null;
      let calledDefaultUpdateAppearances = false;
      let calledUpdateAppearances = false;
      let widgetCount = 0;
      let widgetAppearanceStateKeys: string[][] = [];
      let widgetFinalAppearanceStates: string[] = [];
      let widgetRectsUsed: Array<{ x: number; y: number; width: number; height: number } | null> = [];
      let widgetPageIndexes: number[] = [];
      let manualMarkDrawn = false;
      let emergencyControlFieldValue: string | null = null;

      if (field instanceof PDFCheckBox) {
        if (truthy) {
          field.check();
          action = 'checked';
        } else {
          field.uncheck();
          action = 'unchecked';
        }
        checkboxIsChecked = field.isChecked();
        if (name === 'safety_checks.emergency_control') {
          const acroValue = (field.acroField as unknown as {
            getValue?: () => { decodeText?: () => string; asString?: () => string } | undefined;
          }).getValue?.();
          emergencyControlFieldValue = acroValue?.decodeText?.() ?? acroValue?.asString?.() ?? null;
        }
        try {
          field.defaultUpdateAppearances();
          calledDefaultUpdateAppearances = true;
        } catch {
          // Ignore appearance update failures here and attempt fallback below.
        }
        if (!calledDefaultUpdateAppearances) {
          try {
            field.updateAppearances();
            calledUpdateAppearances = true;
          } catch {
            // Ignore fallback failure.
          }
        }
        try {
          checkboxNeedsAppearancesUpdate = field.needsAppearancesUpdate();
        } catch {
          checkboxNeedsAppearancesUpdate = null;
        }
        if (checkboxNeedsAppearancesUpdate === true && !calledUpdateAppearances) {
          try {
            field.updateAppearances();
            calledUpdateAppearances = true;
            checkboxNeedsAppearancesUpdate = field.needsAppearancesUpdate();
          } catch {
            // Ignore second-pass update failure.
          }
        }

        const widgets = field.acroField.getWidgets();
        widgetCount = widgets.length;
        widgetAppearanceStateKeys = widgets.map((widget) => {
          const normal = widget.getAppearances()?.normal;
          if (normal instanceof PDFDict) {
            return normal.keys().map((key) => key.decodeText());
          }
          return [];
        });
        widgetFinalAppearanceStates = widgets.map((widget, idx) => {
          const keys = widgetAppearanceStateKeys[idx] ?? [];
          const preferredOnKey = keys.find((key) => key.toLowerCase() !== 'off');
          const targetState = truthy
            ? PDFName.of(preferredOnKey ?? widget.getOnValue()?.decodeText() ?? 'Yes')
            : PDFName.of('Off');
          widget.setAppearanceState(targetState);
          return targetState.asString();
        });
        widgetRectsUsed = widgets.map((widget) => {
          const rect = widget.getRectangle();
          if (!rect) return null;
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        });
        const pages = pdfDoc.getPages();
        widgetPageIndexes = widgets.map((widget) => {
          const widgetPageRef = widget.P?.();
          const index = pages.findIndex(
            (candidate) =>
              candidate.ref?.objectNumber === widgetPageRef?.objectNumber &&
              candidate.ref?.generationNumber === widgetPageRef?.generationNumber,
          );
          return index >= 0 ? index : 0;
        });
        if (truthy) {
          widgets.forEach((widget, idx) => {
            const rect = widgetRectsUsed[idx];
            const pageIndex = widgetPageIndexes[idx] ?? 0;
            const targetPage = pages[pageIndex];
            if (!rect || !targetPage) return;
            const size = Math.min(rect.width, rect.height);
            const inset = Math.max(1, size * 0.22);
            const thickness = Math.max(1, size * 0.14);
            targetPage.drawLine({
              start: { x: rect.x + inset, y: rect.y + inset },
              end: { x: rect.x + rect.width - inset, y: rect.y + rect.height - inset },
              thickness,
              color: rgb(0, 0, 0),
            });
            targetPage.drawLine({
              start: { x: rect.x + inset, y: rect.y + rect.height - inset },
              end: { x: rect.x + rect.width - inset, y: rect.y + inset },
              thickness,
              color: rgb(0, 0, 0),
            });
            manualMarkDrawn = true;
          });
        }

        filledFields.add(name);
      } else if (field instanceof PDFRadioGroup) {
        const options = field.getOptions();
        const normalized = text.trim().toLowerCase();
        const directMatch = options.find((option) => option.trim().toLowerCase() === normalized);
        let selectedOption = directMatch;

        if (!selectedOption && truthy) {
          selectedOption = options.find((option) => ['yes', 'true', 'pass', 'on', '1'].includes(option.trim().toLowerCase()));
        }
        if (!selectedOption && !truthy) {
          selectedOption = options.find((option) => ['no', 'false', 'fail', 'off', '0'].includes(option.trim().toLowerCase()));
        }
        if (!selectedOption && truthy && options.length === 1) {
          selectedOption = options[0];
        }

        if (selectedOption) {
          field.select(selectedOption);
          filledFields.add(name);
          action = `selected:${selectedOption}`;
        } else {
          action = 'no-matching-option';
        }
      } else if (field instanceof PDFTextField) {
        if (text) {
          field.setText(text);
          filledFields.add(name);
          action = 'setText';
        } else {
          action = 'skip-empty-text';
        }
      } else {
        action = 'unsupported-field-type';
      }

      if (debug) {
        console.log('CP12 safety field', {
          fieldName: name,
          incomingValue: value ?? null,
          truthy,
          fieldType,
          action,
          checkboxIsChecked,
          checkboxNeedsAppearancesUpdate,
          calledDefaultUpdateAppearances,
          calledUpdateAppearances,
          widgetCount,
          widgetAppearanceStateKeys,
          widgetFinalAppearanceStates,
          widgetRectsUsed,
          widgetPageIndexes,
          manualMarkDrawn,
          applyAfterGlobalAppearanceUpdate,
          manualOverlayDrawAfterGlobalAppearanceUpdates: applyAfterGlobalAppearanceUpdate && manualMarkDrawn,
          executionOrderLabel,
          emergencyControlFieldValue,
        });
      }
    } catch (error) {
      if (debug) {
        console.warn('CP12 safety field error', {
          fieldName: name,
          incomingValue: value ?? null,
          error,
        });
      }
    }
  });
}

function resolveSignatureWidgetPlacement(params: {
  form: ReturnType<PDFDocument['getForm']>;
  pdfDoc: PDFDocument;
  fieldName: string;
}) {
  const { form, pdfDoc, fieldName } = params;
  try {
    const field = form.getField(fieldName);
    const fieldType = field.constructor?.name ?? 'UnknownField';
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
    const widgetPlacements = widgets.map((widget) => {
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
      };
    });
    const chosen =
      widgetPlacements.find((entry) => entry.pageIndex === 0 && entry.rect && entry.rect.width > 0 && entry.rect.height > 0) ??
      widgetPlacements.find((entry) => entry.rect && entry.rect.width > 0 && entry.rect.height > 0) ??
      null;
    const chosenPageIndex = chosen?.pageIndex ?? 0;
    const chosenPage = pages[chosenPageIndex] ?? null;
    return {
      ok: Boolean(chosenPage && chosen?.rect),
      fieldType,
      widgetCount: widgets.length,
      widgetPlacements,
      rect: chosen?.rect ?? null,
      pageIndex: chosenPageIndex,
      page: chosenPage,
    };
  } catch {
    return {
      ok: false,
      fieldType: 'UnknownField',
      widgetCount: 0,
      widgetPlacements: [] as Array<{ rect: { x: number; y: number; width: number; height: number } | null; pageIndex: number }>,
      rect: null,
      pageIndex: 0,
      page: null as PDFPage | null,
    };
  }
}

type SignaturePlacement = {
  rect: { x: number; y: number; width: number; height: number };
  pageIndex: number;
};

const CP12_SIGNATURE_FALLBACK_PLACEMENTS: Record<'engineer_signature' | 'customer_signature', SignaturePlacement> = {
  engineer_signature: {
    rect: { x: 39, y: 58, width: 205, height: 24 },
    pageIndex: 0,
  },
  customer_signature: {
    rect: { x: 294, y: 58, width: 205, height: 24 },
    pageIndex: 0,
  },
};

function collectSignatureRelatedFieldMetadata(form: ReturnType<PDFDocument['getForm']>, pdfDoc: PDFDocument) {
  const patterns = [/signature/i, /signatures/i, /engineer/i, /customer/i, /responsible/i, /issued/i];
  return form
    .getFields()
    .filter((field) => patterns.some((pattern) => pattern.test(field.getName())))
    .map((field) => {
      const placement = resolveSignatureWidgetPlacement({
        form,
        pdfDoc,
        fieldName: field.getName(),
      });
      return {
        fieldName: field.getName(),
        fieldType: placement.fieldType,
        widgetCount: placement.widgetCount,
        widgetPlacements: placement.widgetPlacements,
      };
    });
}

async function fetchSignatureBytes(url: string): Promise<{ bytes: Uint8Array; mime: string; source: string } | null> {
  if (!url) return null;
  try {
    if (url.startsWith('data:')) {
      const match = url.match(/^data:(.+?);base64,(.*)$/);
      if (!match) return null;
      const [, mime, data] = match;
      return { bytes: Uint8Array.from(Buffer.from(data, 'base64')), mime: mime || 'image/png', source: 'data-url' };
    }

    if (/^https?:\/\//i.test(url)) {
      const response = await fetch(url);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      const mime = (response.headers.get('content-type') ?? '').toLowerCase() || 'image/png';
      return { bytes: new Uint8Array(arrayBuffer), mime, source: 'http' };
    }

    const sb = await supabaseServerServiceRole().catch(() => null);
    if (!sb) return null;
    const { data: signed } = await sb.storage.from('signatures').createSignedUrl(url, 60);
    const target = signed?.signedUrl ?? sb.storage.from('signatures').getPublicUrl(url).data.publicUrl;
    if (target) {
      return fetchSignatureBytes(target);
    }
  } catch {
    // fall through
  }
  return null;
}

async function embedSignatureImage(params: {
  form: ReturnType<PDFDocument['getForm']>;
  pdfDoc: PDFDocument;
  preferredFieldNames: string[];
  fallbackPlacement: SignaturePlacement;
  url?: string;
  label?: string;
  debug?: boolean;
  signatureFieldMetadata?: Array<{
    fieldName: string;
    fieldType: string;
    widgetCount: number;
    widgetPlacements: Array<{ rect: { x: number; y: number; width: number; height: number } | null; pageIndex: number }>;
  }>;
}): Promise<boolean> {
  const { form, pdfDoc, preferredFieldNames, fallbackPlacement, url, label, debug, signatureFieldMetadata } = params;
  const dedicated = preferredFieldNames
    .map((fieldName) => ({ fieldName, placement: resolveSignatureWidgetPlacement({ form, pdfDoc, fieldName }) }))
    .find((entry) => entry.placement.ok && entry.placement.page && entry.placement.rect);

  const fallbackPage = pdfDoc.getPages()[fallbackPlacement.pageIndex] ?? pdfDoc.getPages()[0] ?? null;
  const chosen =
    dedicated != null
      ? {
          strategy: 'dedicated-widget' as const,
          fieldName: dedicated.fieldName,
          fieldType: dedicated.placement.fieldType,
          widgetCount: dedicated.placement.widgetCount,
          widgetPlacements: dedicated.placement.widgetPlacements,
          rect: dedicated.placement.rect!,
          pageIndex: dedicated.placement.pageIndex,
          page: dedicated.placement.page!,
        }
      : {
          strategy: 'fixed-coords' as const,
          fieldName: 'fixed',
          fieldType: 'FixedCoords',
          widgetCount: 0,
          widgetPlacements: [] as Array<{ rect: { x: number; y: number; width: number; height: number } | null; pageIndex: number }>,
          rect: fallbackPlacement.rect,
          pageIndex: fallbackPlacement.pageIndex,
          page: fallbackPage,
        };

  if (!url || !chosen.page) {
    if (debug) {
      console.warn('CP12 signature missing', {
        label,
        preferredFieldNames,
        hasUrl: Boolean(url),
        strategy: chosen.strategy,
        chosenRect: chosen.rect,
        chosenPage: chosen.pageIndex,
        discoveredSignatureFields: signatureFieldMetadata,
      });
    }
    return false;
  }
  try {
    const fetched = await fetchSignatureBytes(url);
    if (!fetched) {
      if (debug) console.warn('CP12 signature fetch failed', { label, url });
      return false;
    }
    const { bytes, mime, source } = fetched;
    const page = chosen.page;
    const rect = chosen.rect;
    const padding = Math.max(1, Math.min(4, Math.min(rect.width, rect.height) * 0.12));
    const maxWidth = rect.width - padding * 2;
    const maxHeight = rect.height - padding * 2;
    if (mime.includes('svg')) {
      const svg = Buffer.from(bytes).toString('utf8');
      const pathMatch = svg.match(/<path[^>]*d="([^"]+)"/i);
      const viewBoxMatch = svg.match(/viewBox="([\d.\s-]+)"/i);
      if (!pathMatch?.[1]) {
        if (debug) console.warn('CP12 signature SVG path missing', { label, url });
        return false;
      }
      const [, rawViewBox = '0 0 320 90'] = viewBoxMatch ?? [];
      const [, , viewBoxWidth = '320', viewBoxHeight = '90'] = rawViewBox.trim().split(/\s+/);
      const sourceWidth = Number(viewBoxWidth) || 320;
      const sourceHeight = Number(viewBoxHeight) || 90;
      const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
      const x = rect.x + (rect.width - sourceWidth * scale) / 2;
      const y = rect.y + (rect.height - sourceHeight * scale) / 2;
      page.drawSvgPath(pathMatch[1], {
        x,
        y,
        scale,
        borderColor: rgb(0.1, 0.15, 0.2),
        borderWidth: 1.1,
      });
      if (debug) {
        console.log('CP12 signature SVG embedded', {
          label,
          strategy: chosen.strategy,
          fieldName: chosen.fieldName,
          source,
          chosenRect: rect,
          finalDrawRect: { x, y, width: sourceWidth * scale, height: sourceHeight * scale },
        });
      }
      return true;
    }
    const image = mime.includes('png') ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
    const dims = image.scaleToFit(maxWidth, maxHeight);
    const x = rect.x + (rect.width - dims.width) / 2;
    const y = rect.y + (rect.height - dims.height) / 2;
    page.drawImage(image, { x, y, width: dims.width, height: dims.height });
    if (debug) {
      console.log('CP12 signature embedded', {
        label,
        strategy: chosen.strategy,
        fieldName: chosen.fieldName,
        fieldType: chosen.fieldType,
        widgetCount: chosen.widgetCount,
        widgetPlacements: chosen.widgetPlacements,
        chosenRect: rect,
        chosenPage: chosen.pageIndex,
        source,
        imageDimensions: { width: image.width, height: image.height },
        finalDrawRect: { x, y, width: dims.width, height: dims.height },
      });
    }
    return true;
  } catch (error) {
    if (debug) {
      console.warn('CP12 signature embed error', {
        label,
        preferredFieldNames,
        strategy: chosen.strategy,
        chosenRect: chosen.rect,
        chosenPage: chosen.pageIndex,
        url,
        discoveredSignatureFields: signatureFieldMetadata,
        error,
      });
    }
    return false;
  }
}

const DEFECT_ROW_TEXT_LIMIT = 220;

function getFirstDefectRowFieldName(fieldNames: Set<string>) {
  return [...fieldNames]
    .filter((name) => /^appliance_\d+\.defects$/.test(name))
    .sort((a, b) => {
      const aNum = Number(a.match(/^appliance_(\d+)\.defects$/)?.[1] ?? Number.POSITIVE_INFINITY);
      const bNum = Number(b.match(/^appliance_(\d+)\.defects$/)?.[1] ?? Number.POSITIVE_INFINITY);
      return aNum - bNum;
    })[0];
}

function buildDefectAreaText(fields: Cp12FieldMap) {
  const lines: string[] = [];
  if (fields.defectsIdentified) lines.push(`Defect: ${fields.defectsIdentified}`);
  if (fields.remedialWorksRequired) lines.push(`Remedial: ${fields.remedialWorksRequired}`);
  if (fields.warningNoticeIssued) lines.push(`Warning notice: ${fields.warningNoticeIssued}`);
  return lines.join('\n').trim();
}

async function drawAppliances(
  pdfDoc: PDFDocument,
  templateDoc: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  appliances: ApplianceInput[],
) {
  const { startX, startYOffset, rowHeight, maxRowsPerPage, columns } = APPLIANCE_TABLE;
  type ApplianceColumnKey = keyof typeof columns;
  let currentPage = page;
  const { height } = currentPage.getSize();
  let currentY = height - startYOffset;
  let rowIndex = 0;

  const formatCombustion = (appliance: ApplianceInput, kind: 'high' | 'low') => {
    const coPpm = kind === 'high' ? appliance.combustionHighCoPpm : appliance.combustionLowCoPpm;
    const co2 = kind === 'high' ? appliance.combustionHighCo2 : appliance.combustionLowCo2;
    const ratio = kind === 'high' ? appliance.combustionHighRatio : appliance.combustionLowRatio;
    const legacy = kind === 'high' ? appliance.combustionHigh : appliance.combustionLow;
    const parts = [coPpm && `CO ${coPpm}ppm`, co2 && `CO2 ${co2}%`, ratio && `Ratio ${ratio}`].filter(Boolean);
    if (parts.length) return parts.join(' / ');
    return legacy ?? '';
  };

  const writeRow = (appliance: ApplianceInput) => {
    const drawCell = (field: ApplianceColumnKey) => {
      const colCfg = columns[field];
      if (!colCfg) return;
      let value: string | undefined;
      if (field === 'combustionHigh') {
        value = formatCombustion(appliance, 'high');
      } else if (field === 'combustionLow') {
        value = formatCombustion(appliance, 'low');
      } else {
        value = appliance[field] as string | undefined;
      }
      if (!value) return;
      const text = String(value);
      const size =
        field === 'flueType'
          ? getFittedFontSize({
              text,
              font,
              maxWidth: colCfg.width - FLUE_TYPE_TEXT_PADDING,
              preferredSize: FLUE_TYPE_PREFERRED_FONT_SIZE,
              minSize: FLUE_TYPE_MIN_FONT_SIZE,
            })
          : 8;
      currentPage.drawText(text, {
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
    drawCell('combustionHigh');
    drawCell('combustionLow');
    drawCell('applianceServiced');
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

function configureFlueTypeFieldAppearance(params: {
  form: ReturnType<PDFDocument['getForm']>;
  fieldNames: Set<string>;
  font: PDFFont;
}) {
  const { form, fieldNames, font } = params;
  [...fieldNames]
    .filter((name) => /^appliance_\d+\.flue_type$/.test(name))
    .forEach((name) => {
      try {
        const field = form.getTextField(name);
        const text = normalizeText(field.getText() ?? '');
        if (!text) return;

        const widget = field.acroField.getWidgets()[0];
        const rect = widget?.getRectangle();
        const maxWidth = rect ? rect.width - FLUE_TYPE_TEXT_PADDING : 0;
        const fittedSize = getFittedFontSize({
          text,
          font,
          maxWidth,
          preferredSize: FLUE_TYPE_PREFERRED_FONT_SIZE,
          minSize: FLUE_TYPE_MIN_FONT_SIZE,
        });
        field.setFontSize(fittedSize);
      } catch {
        // Ignore font-size override failures for flue type fields.
      }
    });
}

function configureCertNumberFieldAppearance(params: {
  form: ReturnType<PDFDocument['getForm']>;
  fieldNames: Set<string>;
  font: PDFFont;
}) {
  const { form, fieldNames, font } = params;
  if (!fieldNames.has('Cert_no')) return;
  try {
    const field = form.getTextField('Cert_no');
    const text = normalizeText(field.getText() ?? '');
    if (!text) return;

    const widget = field.acroField.getWidgets()[0];
    const rect = widget?.getRectangle();
    const maxWidth = rect ? rect.width - CERT_NUMBER_TEXT_PADDING : 0;
    const fittedSize = getFittedFontSize({
      text,
      font,
      maxWidth,
      preferredSize: CERT_NUMBER_PREFERRED_FONT_SIZE,
      minSize: CERT_NUMBER_MIN_FONT_SIZE,
    });
    field.setFontSize(fittedSize);
  } catch {
    // Ignore font-size override failures for cert number field.
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
  const debugPdf = process.env.CP12_PDF_DEBUG === '1';

  const fields: Cp12FieldMap = {
    ...input.fields,
    issueDate: input.fields.issueDate ?? input.issuedAt.toLocaleDateString('en-GB'),
  };
  const hasApplianceDefectRows = (input.appliances ?? []).some((appliance) => normalizeText(appliance.remedialActionTaken));
  const defectAreaText = hasApplianceDefectRows ? '' : buildDefectAreaText(fields);
  const firstDefectRowFieldName = getFirstDefectRowFieldName(formFieldNames);
  const canMapDefectToRow = Boolean(defectAreaText && firstDefectRowFieldName);
  const defectRowText = canMapDefectToRow ? defectAreaText.slice(0, DEFECT_ROW_TEXT_LIMIT).trimEnd() : '';
  const defectOverflowText =
    canMapDefectToRow && defectAreaText.length > DEFECT_ROW_TEXT_LIMIT
      ? defectAreaText.slice(DEFECT_ROW_TEXT_LIMIT).trimStart()
      : '';

  if (canMapDefectToRow) {
    setTextIfExists({
      form,
      fieldNames: formFieldNames,
      fieldName: firstDefectRowFieldName ?? null,
      value: defectRowText,
      filledFields,
    });
  }

  const commentLines: string[] = [];
  if (!canMapDefectToRow) {
    if (fields.defectsIdentified) commentLines.push(`Defects: ${fields.defectsIdentified}`);
    if (fields.remedialWorksRequired) commentLines.push(`Remedial: ${fields.remedialWorksRequired}`);
  }
  if (defectOverflowText) {
    commentLines.push(`Defects (cont.): ${defectOverflowText}`);
  }
  if (fields.additionalNotes) {
    commentLines.push(`Notes: ${fields.additionalNotes}`);
  }
  const combinedComments = commentLines.length ? commentLines.join('\n') : undefined;
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
    'emergencyControlAccessible',
    'gasTightnessSatisfactory',
    'pipeworkVisualSatisfactory',
    'equipotentialBondingSatisfactory',
  ]);

  (Object.keys(CP12_FORM_FIELD_NAMES) as (keyof Cp12FieldMap)[]).forEach((key) => {
    if (skipKeys.has(key)) return;
    setFormValue({
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
    const rows = (input.appliances ?? []).slice(0, APPLIANCE_TABLE.maxRowsPerPage);
    rows.forEach((appliance, index) => {
      const names = getApplianceFieldNames(index);
      (Object.keys(names) as (keyof ApplianceInput)[]).forEach((key) => {
        if (key === 'description') {
          const [makeFieldName, modelFieldName] = toFieldNameList(names.description);
          const { make, model } = splitApplianceMakeModel(appliance.description);
          setFormValue({
            form,
            fieldNames: formFieldNames,
            fieldName: makeFieldName ?? null,
            value: make,
            filledFields,
          });
          setFormValue({
            form,
            fieldNames: formFieldNames,
            fieldName: modelFieldName ?? null,
            value: model,
            filledFields,
          });
          return;
        }
        setFormValue({
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

  configureFlueTypeFieldAppearance({
    form,
    fieldNames: formFieldNames,
    font: regularFont,
  });
  configureCertNumberFieldAppearance({
    form,
    fieldNames: formFieldNames,
    font: regularFont,
  });

  const safetyExecutionOrder: string[] = [];
  safetyExecutionOrder.push('all_other_fields_complete');
  if (debugPdf) {
    console.log('CP12 safety timing', {
      stage: 'before_global_form_update',
      safetyAppliedAfterGlobalUpdate: true,
    });
  }
  safetyExecutionOrder.push('global_form_update_start');
  form.updateFieldAppearances(regularFont);
  safetyExecutionOrder.push('global_form_update_done');

  setSafetyCheckField({
    pdfDoc,
    form,
    fieldNames: formFieldNames,
    fieldName: CP12_FORM_FIELD_NAMES.emergencyControlAccessible,
    value: fields.emergencyControlAccessible,
    filledFields,
    debug: debugPdf,
    applyAfterGlobalAppearanceUpdate: true,
    executionOrderLabel: 'after_global_update_1_emergency_control',
  });
  safetyExecutionOrder.push('safety_field:emergency_control');
  setSafetyCheckField({
    pdfDoc,
    form,
    fieldNames: formFieldNames,
    fieldName: CP12_FORM_FIELD_NAMES.gasTightnessSatisfactory,
    value: fields.gasTightnessSatisfactory,
    filledFields,
    debug: debugPdf,
    applyAfterGlobalAppearanceUpdate: true,
    executionOrderLabel: 'after_global_update_2_tightness',
  });
  safetyExecutionOrder.push('safety_field:tightness');
  setSafetyCheckField({
    pdfDoc,
    form,
    fieldNames: formFieldNames,
    fieldName: CP12_FORM_FIELD_NAMES.pipeworkVisualSatisfactory,
    value: fields.pipeworkVisualSatisfactory,
    filledFields,
    debug: debugPdf,
    applyAfterGlobalAppearanceUpdate: true,
    executionOrderLabel: 'after_global_update_3_visual_inspection',
  });
  safetyExecutionOrder.push('safety_field:visual_inspection');
  setSafetyCheckField({
    pdfDoc,
    form,
    fieldNames: formFieldNames,
    fieldName: CP12_FORM_FIELD_NAMES.equipotentialBondingSatisfactory,
    value: fields.equipotentialBondingSatisfactory,
    filledFields,
    debug: debugPdf,
    applyAfterGlobalAppearanceUpdate: true,
    executionOrderLabel: 'after_global_update_4_equipotential_bonding',
  });
  safetyExecutionOrder.push('safety_field:equipotential_bonding');

  const signatureFieldMetadata = collectSignatureRelatedFieldMetadata(form, pdfDoc);
  if (debugPdf) {
    console.log('CP12 signature field metadata', signatureFieldMetadata);
  }

  await embedSignatureImage({
    form,
    pdfDoc,
    preferredFieldNames: ['signatures.engineer_signature', 'signature.engineer', 'engineer.signature', 'engineer_signature'],
    fallbackPlacement: CP12_SIGNATURE_FALLBACK_PLACEMENTS.engineer_signature,
    url: fields.engineerSignatureUrl,
    label: 'engineer_signature',
    debug: debugPdf,
    signatureFieldMetadata,
  });
  safetyExecutionOrder.push('signature:engineer');
  await embedSignatureImage({
    form,
    pdfDoc,
    preferredFieldNames: [
      'signatures.customer_signature',
      'signatures.responsible_signature',
      'signature.customer',
      'customer_signature',
      'responsible_signature',
    ],
    fallbackPlacement: CP12_SIGNATURE_FALLBACK_PLACEMENTS.customer_signature,
    url: fields.responsiblePersonSignatureUrl,
    label: 'customer_signature',
    debug: debugPdf,
    signatureFieldMetadata,
  });
  safetyExecutionOrder.push('signature:customer');
  safetyExecutionOrder.push('save_pdf');

  if (debugPdf) {
    console.log('CP12 safety timing', {
      stage: 'after_global_form_update',
      safetyAppliedAfterGlobalUpdate: true,
      finalExecutionOrder: safetyExecutionOrder,
    });
  }

  if (debugPdf) {
    const [firstPage] = pdfDoc.getPages();
    if (firstPage) {
      const { height } = firstPage.getSize();
      const debugStamp = `CP12 DEBUG ${new Date().toISOString()}`;
      firstPage.drawText(debugStamp, {
        x: 20,
        y: height - 24,
        size: 10,
        font: regularFont,
        color: rgb(0, 0, 0),
      });
      firstPage.drawLine({
        start: { x: 16, y: height - 58 },
        end: { x: 140, y: height - 182 },
        thickness: 2,
        color: rgb(0, 0, 0),
      });
      console.log('CP12 debug stamp drawn', {
        stamp: debugStamp,
        pageIndex: 0,
        line: { start: { x: 16, y: height - 58 }, end: { x: 140, y: height - 182 } },
      });
    }
  }

  const bytes = await pdfDoc.save();
  return new Uint8Array(bytes);
}
