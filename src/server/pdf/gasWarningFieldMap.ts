export type GasWarningFieldKey =
  | 'certificateNumber'
  | 'engineerName'
  | 'engineerCompany'
  | 'engineerAddress'
  | 'engineerPostcode'
  | 'engineerTel'
  | 'gasSafeReg'
  | 'idCardNumber'
  | 'jobName'
  | 'jobAddress'
  | 'jobPostcode'
  | 'jobTel'
  | 'clientName'
  | 'clientCompany'
  | 'clientAddress'
  | 'clientPostcode'
  | 'clientTel'
  | 'clientMobile'
  | 'applianceLocation'
  | 'applianceMake'
  | 'applianceModel'
  | 'applianceSerial'
  | 'applianceType'
  | 'applianceClassification'
  | 'gasEscape'
  | 'pipeworkIssue'
  | 'ventilationIssue'
  | 'meterIssue'
  | 'chimneyFlueIssue'
  | 'otherIssue'
  | 'faultDetails'
  | 'actionsTaken'
  | 'actionsRequired'
  | 'riddor11_1'
  | 'riddor11_2'
  | 'issuedBySignature'
  | 'issuedByPrintName'
  | 'receivedBySignature'
  | 'receivedByPrintName'
  | 'issuedDate'
  | 'noticeLeftOnPremises';

export type GasWarningPdfTarget = {
  name: string;
  widgetIndex?: number;
};

export type GasWarningFormFieldName = GasWarningPdfTarget | GasWarningPdfTarget[] | null;

export type GasWarningPdfFieldType = 'text' | 'mark' | 'signature' | 'unmapped';
export type GasWarningPdfUsageCategory = 'safe-usable' | 'widget-aware' | 'overlay-only' | 'ambiguous-avoid';

export type GasWarningPdfFieldRenderMode = 'field' | 'widget-overlay';

export type GasWarningTextAlignment = 'left' | 'center' | 'right';

export type GasWarningPdfFieldAppearance = {
  multiline?: boolean;
  alignment?: GasWarningTextAlignment;
  preferredFontSize?: number;
  minFontSize?: number;
  padding?: number;
};

export type GasWarningPdfFieldMapEntry = {
  fieldName: GasWarningFormFieldName;
  type: GasWarningPdfFieldType;
  usage: GasWarningPdfUsageCategory;
  description: string;
  appearance?: GasWarningPdfFieldAppearance;
  renderMode?: GasWarningPdfFieldRenderMode;
};

export type GasWarningRawFieldAuditEntry = {
  defaultUsage: GasWarningPdfUsageCategory;
  widgetUsage?: Partial<Record<number, GasWarningPdfUsageCategory>>;
  note: string;
};

const target = (name: string, widgetIndex?: number): GasWarningPdfTarget => (widgetIndex === undefined ? { name } : { name, widgetIndex });

const SINGLE_LINE_LEFT: GasWarningPdfFieldAppearance = {
  multiline: false,
  alignment: 'left',
  preferredFontSize: 6.5,
  minFontSize: 5.25,
  padding: 4,
};

const SINGLE_LINE_CENTER: GasWarningPdfFieldAppearance = {
  ...SINGLE_LINE_LEFT,
  alignment: 'center',
};

const MULTILINE_LEFT: GasWarningPdfFieldAppearance = {
  multiline: true,
  alignment: 'left',
  preferredFontSize: 7,
  minFontSize: 6,
  padding: 8,
};

export const GAS_WARNING_RAW_FIELD_AUDIT: Record<string, GasWarningRawFieldAuditEntry> = {
  /**
   * Audited high-risk field.
   * `text6` is reused across two visible widgets:
   * - widget 0 = client / landlord company
   * - widget 1 = unlabeled installer-area widget with unclear meaning
   *
   * Never fill raw `text6` directly. Widget 0 must stay widget-aware/draw-only,
   * and widget 1 must remain ignored unless the source PDF is fixed.
   */
  text6: {
    defaultUsage: 'ambiguous-avoid',
    widgetUsage: {
      0: 'widget-aware',
      1: 'ambiguous-avoid',
    },
    note: 'Reused raw field. Widget 0 is client company; widget 1 is unlabeled and unresolved.',
  },
  /**
   * Audited high-risk field.
   * `text23` is a visible widget below client mobile with no printed label.
   * It remains intentionally unmapped and must be avoided.
   */
  text23: {
    defaultUsage: 'ambiguous-avoid',
    note: 'Visible unlabeled client-side widget. Purpose unresolved in the audited template.',
  },
  /**
   * Audited high-risk field.
   * `text24` is reused across two appliance widgets:
   * - widget 0 = appliance location
   * - widget 1 = appliance model
   *
   * Never fill raw `text24` directly. Both widgets must be targeted via
   * widget-aware overlay placement to avoid mirrored values.
   */
  text24: {
    defaultUsage: 'widget-aware',
    widgetUsage: {
      0: 'widget-aware',
      1: 'widget-aware',
    },
    note: 'Reused appliance field. Widget 0 is location; widget 1 is model.',
  },
  text31: { defaultUsage: 'overlay-only', note: 'Pseudo-checkbox for Gas Escape.' },
  text32: { defaultUsage: 'overlay-only', note: 'Pseudo-checkbox for Pipework Issue.' },
  text33: { defaultUsage: 'overlay-only', note: 'Pseudo-checkbox for Ventilation Issue.' },
  text34: { defaultUsage: 'overlay-only', note: 'Pseudo-checkbox for Meter Issue.' },
  text35: { defaultUsage: 'overlay-only', note: 'Pseudo-checkbox for Chimney/Flue Issue.' },
  text39: { defaultUsage: 'overlay-only', note: 'Pseudo-checkbox for RIDDOR 11(1).' },
  text40: { defaultUsage: 'overlay-only', note: 'Pseudo-checkbox for RIDDOR 11(2).' },
  text41: { defaultUsage: 'overlay-only', note: 'Signature anchor only.' },
  text42: { defaultUsage: 'overlay-only', note: 'Signature anchor only.' },
};

export function getGasWarningPdfTargetUsage(target: GasWarningPdfTarget | null | undefined): GasWarningPdfUsageCategory {
  if (!target) return 'ambiguous-avoid';
  const audit = GAS_WARNING_RAW_FIELD_AUDIT[target.name];
  if (!audit) return 'safe-usable';
  if (target.widgetIndex !== undefined && audit.widgetUsage?.[target.widgetIndex]) {
    return audit.widgetUsage[target.widgetIndex]!;
  }
  return audit.defaultUsage;
}

export const GAS_WARNING_PDF_FIELD_MAP: Record<GasWarningFieldKey, GasWarningPdfFieldMapEntry> = {
  /** text100: Gas Warning Notice record/certificate number. */
  certificateNumber: {
    fieldName: target('text100'),
    type: 'text',
    usage: 'safe-usable',
    description: 'Gas Warning Notice record/certificate number',
    appearance: SINGLE_LINE_LEFT,
  },
  /** Long seeded field name: engineer/installer print name. */
  engineerName: {
    fieldName: target('Company  Installer Engineer arran Company SWFY Address 1 Example Street Example Town Post Code EX1 1EX Tel No 00000000000 Gas Safe Reg 545 ID Card No'),
    type: 'text',
    usage: 'safe-usable',
    description: 'Engineer or installer name',
    appearance: SINGLE_LINE_LEFT,
  },
  /** text1: engineer company name. */
  engineerCompany: { fieldName: target('text1'), type: 'text', usage: 'safe-usable', description: 'Engineer company name', appearance: SINGLE_LINE_LEFT },
  /** text2-text4: engineer company address lines. */
  engineerAddress: {
    fieldName: [target('text2'), target('text3'), target('text4')],
    type: 'text',
    usage: 'safe-usable',
    description: 'Engineer company address lines',
    appearance: SINGLE_LINE_LEFT,
  },
  /** text5: engineer company postcode. */
  engineerPostcode: { fieldName: target('text5'), type: 'text', usage: 'safe-usable', description: 'Engineer company postcode', appearance: SINGLE_LINE_LEFT },
  /** text7: engineer/company telephone number. */
  engineerTel: { fieldName: target('text7'), type: 'text', usage: 'safe-usable', description: 'Engineer/company telephone number', appearance: SINGLE_LINE_LEFT },
  /** text8: Gas Safe registration number. */
  gasSafeReg: { fieldName: target('text8'), type: 'text', usage: 'safe-usable', description: 'Gas Safe registration number', appearance: SINGLE_LINE_LEFT },
  /** text9: engineer ID card number. */
  idCardNumber: { fieldName: target('text9'), type: 'text', usage: 'safe-usable', description: 'Engineer ID card number', appearance: SINGLE_LINE_LEFT },
  /** Long seeded field name: job address name. */
  jobName: {
    fieldName: target('Job Address Name Address 10 Example Street Example Town Post Code EX1 1XE Tel No'),
    type: 'text',
    usage: 'safe-usable',
    description: 'Job address name',
    appearance: SINGLE_LINE_LEFT,
  },
  /** text10-text13: job address lines. */
  jobAddress: {
    fieldName: [target('text10'), target('text11'), target('text12'), target('text13')],
    type: 'text',
    usage: 'safe-usable',
    description: 'Job address lines',
    appearance: SINGLE_LINE_LEFT,
  },
  /** text14: job address postcode. */
  jobPostcode: { fieldName: target('text14'), type: 'text', usage: 'safe-usable', description: 'Job address postcode', appearance: SINGLE_LINE_LEFT },
  /** text15: job/site telephone number. */
  jobTel: { fieldName: target('text15'), type: 'text', usage: 'safe-usable', description: 'Job/site telephone number', appearance: SINGLE_LINE_LEFT },
  /** Long seeded field name: client/landlord name. */
  clientName: {
    fieldName: target('Client  LandLord Name Mr John Example Company Address 10 Example Street Example Town Post Code EX1 1XE Tel No Mob No'),
    type: 'text',
    usage: 'safe-usable',
    description: 'Client or landlord name',
    appearance: SINGLE_LINE_LEFT,
  },
  /**
   * Audited high-risk field.
   * `text6` is a reused raw field, so widget 0 must stay widget-aware and be
   * filled via overlay placement only. Raw `text6` must never be filled directly.
   */
  clientCompany: {
    fieldName: target('text6', 0),
    type: 'text',
    usage: 'widget-aware',
    description: 'Client or landlord company name',
    appearance: SINGLE_LINE_LEFT,
    renderMode: 'widget-overlay',
  },
  /** text17-text19: client/landlord address lines. */
  clientAddress: {
    fieldName: [target('text17'), target('text18'), target('text19')],
    type: 'text',
    usage: 'safe-usable',
    description: 'Client or landlord address lines',
    appearance: SINGLE_LINE_LEFT,
  },
  /** text20: client/landlord postcode. */
  clientPostcode: { fieldName: target('text20'), type: 'text', usage: 'safe-usable', description: 'Client or landlord postcode', appearance: SINGLE_LINE_LEFT },
  /** text21: client/landlord telephone number. */
  clientTel: { fieldName: target('text21'), type: 'text', usage: 'safe-usable', description: 'Client or landlord telephone number', appearance: SINGLE_LINE_LEFT },
  /** text22: client/landlord mobile number. */
  clientMobile: { fieldName: target('text22'), type: 'text', usage: 'safe-usable', description: 'Client or landlord mobile number', appearance: SINGLE_LINE_LEFT },
  /**
   * Audited high-risk field.
   * `text24` is reused across location and model widgets. Widget 0 is location.
   * Raw `text24` must never be filled directly.
   */
  applianceLocation: {
    fieldName: target('text24', 0),
    type: 'text',
    usage: 'widget-aware',
    description: 'Unsafe appliance location',
    appearance: SINGLE_LINE_LEFT,
    renderMode: 'widget-overlay',
  },
  /** text26: unsafe appliance make. */
  applianceMake: { fieldName: target('text26'), type: 'text', usage: 'safe-usable', description: 'Unsafe appliance make', appearance: SINGLE_LINE_LEFT },
  /**
   * Audited high-risk field.
   * `text24` is reused across location and model widgets. Widget 1 is model.
   * Raw `text24` must never be filled directly.
   */
  applianceModel: {
    fieldName: target('text24', 1),
    type: 'text',
    usage: 'widget-aware',
    description: 'Unsafe appliance model',
    appearance: SINGLE_LINE_LEFT,
    renderMode: 'widget-overlay',
  },
  /** text27: unsafe appliance serial number. */
  applianceSerial: { fieldName: target('text27'), type: 'text', usage: 'safe-usable', description: 'Unsafe appliance serial number', appearance: SINGLE_LINE_LEFT },
  /** text28: unsafe appliance type. */
  applianceType: { fieldName: target('text28'), type: 'text', usage: 'safe-usable', description: 'Unsafe appliance type', appearance: SINGLE_LINE_LEFT },
  /** text29: unsafe appliance classification rendered as the full label. */
  applianceClassification: {
    fieldName: target('text29'),
    type: 'text',
    usage: 'safe-usable',
    description: 'Unsafe appliance classification',
    appearance: SINGLE_LINE_CENTER,
  },
  /** text31: gas escape issue marker. */
  gasEscape: { fieldName: target('text31'), type: 'mark', usage: 'overlay-only', description: 'Gas escape issue marker', appearance: SINGLE_LINE_CENTER },
  /** text32: pipework issue marker. */
  pipeworkIssue: { fieldName: target('text32'), type: 'mark', usage: 'overlay-only', description: 'Pipework issue marker', appearance: SINGLE_LINE_CENTER },
  /** text33: ventilation issue marker. */
  ventilationIssue: { fieldName: target('text33'), type: 'mark', usage: 'overlay-only', description: 'Ventilation issue marker', appearance: SINGLE_LINE_CENTER },
  /** text34: meter issue marker. */
  meterIssue: { fieldName: target('text34'), type: 'mark', usage: 'overlay-only', description: 'Meter issue marker', appearance: SINGLE_LINE_CENTER },
  /** text35: chimney/flue issue marker. */
  chimneyFlueIssue: { fieldName: target('text35'), type: 'mark', usage: 'overlay-only', description: 'Chimney/flue issue marker', appearance: SINGLE_LINE_CENTER },
  /** text30: other issue details. */
  otherIssue: { fieldName: target('text30'), type: 'text', usage: 'safe-usable', description: 'Other issue details', appearance: SINGLE_LINE_LEFT },
  /** text36: fault/unsafe situation details. */
  faultDetails: { fieldName: target('text36'), type: 'text', usage: 'safe-usable', description: 'Fault or unsafe situation details', appearance: MULTILINE_LEFT },
  /** text37: actions taken. */
  actionsTaken: { fieldName: target('text37'), type: 'text', usage: 'safe-usable', description: 'Actions taken', appearance: MULTILINE_LEFT },
  /** text38: actions required or underlying cause. */
  actionsRequired: { fieldName: target('text38'), type: 'text', usage: 'safe-usable', description: 'Actions required or underlying cause', appearance: MULTILINE_LEFT },
  /** text39: RIDDOR regulation 11(1) marker; exact checkbox semantics need template confirmation. */
  riddor11_1: { fieldName: target('text39'), type: 'mark', usage: 'overlay-only', description: 'RIDDOR regulation 11(1) marker', appearance: SINGLE_LINE_CENTER },
  /** text40: RIDDOR regulation 11(2) marker; exact checkbox semantics need template confirmation. */
  riddor11_2: { fieldName: target('text40'), type: 'mark', usage: 'overlay-only', description: 'RIDDOR regulation 11(2) marker', appearance: SINGLE_LINE_CENTER },
  /** text41: issued-by engineer signature image placeholder. */
  issuedBySignature: { fieldName: target('text41'), type: 'signature', usage: 'overlay-only', description: 'Issued-by engineer signature' },
  /** text43: issued-by engineer printed name. */
  issuedByPrintName: { fieldName: target('text43'), type: 'text', usage: 'safe-usable', description: 'Issued-by engineer printed name', appearance: SINGLE_LINE_LEFT },
  /** text42: received-by customer signature image placeholder. */
  receivedBySignature: { fieldName: target('text42'), type: 'signature', usage: 'overlay-only', description: 'Received-by customer signature' },
  /** text44: received-by customer printed name. */
  receivedByPrintName: { fieldName: target('text44'), type: 'text', usage: 'safe-usable', description: 'Received-by customer printed name', appearance: SINGLE_LINE_LEFT },
  /** text45: notice issue date. */
  issuedDate: { fieldName: target('text45'), type: 'text', usage: 'safe-usable', description: 'Notice issue date', appearance: SINGLE_LINE_CENTER },
  /** No AcroForm field exists for the visible footer checkbox; overlay only via hard-coded anchor. */
  noticeLeftOnPremises: { fieldName: null, type: 'unmapped', usage: 'overlay-only', description: 'Notice left on premises marker' },
};
