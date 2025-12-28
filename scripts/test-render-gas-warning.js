const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const TEMPLATE_PATH = 'src/assets/templates/gas-warning-notice.pdf';
const OUTPUT_PATH = 'tmp/gas-warning-filled.pdf';

const GAS_WARNING_FORM_FIELD_NAMES = {
  certificateNumber: 'text100',
  engineerName: 'text1',
  engineerCompany: 'text2',
  engineerAddress: ['text3', 'text4'],
  engineerPostcode: 'text5',
  engineerTel: 'text7',
  gasSafeReg: 'text8',
  idCardNumber: 'text9',
  jobName: 'text10',
  jobAddress: ['text11', 'text12', 'text13'],
  jobPostcode: 'text14',
  jobTel: 'text15',
  clientName: 'text6',
  clientCompany: 'text17',
  clientAddress: ['text18', 'text19', 'text20'],
  clientPostcode: 'text21',
  clientTel: 'text22',
  clientMobile: 'text23',
  applianceLocation: 'text24',
  applianceMake: 'text26',
  applianceModel: 'text27',
  applianceSerial: 'text28',
  applianceType: 'text29',
  applianceClassification: null,
  gasEscape: 'text31',
  pipeworkIssue: 'text32',
  ventilationIssue: 'text33',
  meterIssue: 'text34',
  chimneyFlueIssue: 'text35',
  otherIssue: 'text30',
  faultDetails: 'text36',
  actionsTaken: 'text37',
  actionsRequired: 'text38',
  riddor11_1: 'text39',
  riddor11_2: 'text40',
  issuedBySignature: 'text41',
  issuedByPrintName: 'text43',
  receivedBySignature: 'text42',
  receivedByPrintName: 'text44',
  issuedDate: 'text45',
  noticeLeftOnPremises: null,
};

function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toFieldNameList(fieldName) {
  if (!fieldName) return [];
  return Array.isArray(fieldName) ? fieldName : [fieldName];
}

function splitTextLines(value, maxLines) {
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

async function main() {
  const bytes = await fs.promises.readFile(path.join(process.cwd(), TEMPLATE_PATH));
  const pdfDoc = await PDFDocument.load(bytes);
  const form = pdfDoc.getForm();

  const mockFields = {
    property_address: '10 Example Street, Example Town',
    postcode: 'EX1 1XE',
    customer_name: 'Jamie Collins',
    customer_contact: '07123 456789',
    appliance_location: 'Kitchen cupboard',
    appliance_type: 'Combi boiler',
    make_model: 'Worcester Bosch Greenstar 30i',
    unsafe_situation_description: 'Flue seal degraded causing minor spillage risk.',
    underlying_cause: 'Seal deterioration.',
    actions_taken: 'Isolated appliance, advised replacement seal.',
    classification: 'AT_RISK',
    engineer_name: 'Alex Turner',
    engineer_company: 'CertNow Heating',
    gas_safe_number: '123456',
    engineer_id_card_number: 'GS-987654',
    issued_at: new Date().toISOString().slice(0, 10),
    record_id: 'GW-00123',
  };

  const values = {
    certificateNumber: mockFields.record_id,
    engineerName: mockFields.engineer_name,
    engineerCompany: mockFields.engineer_company,
    engineerAddress: '1 Example Street, Example Town',
    engineerPostcode: 'EX1 1EX',
    engineerTel: '020 1234 5678',
    gasSafeReg: mockFields.gas_safe_number,
    idCardNumber: mockFields.engineer_id_card_number,
    jobName: mockFields.property_address,
    jobAddress: mockFields.property_address,
    jobPostcode: mockFields.postcode,
    jobTel: mockFields.customer_contact,
    clientName: mockFields.customer_name,
    clientCompany: 'Example Co',
    clientAddress: mockFields.property_address,
    clientPostcode: mockFields.postcode,
    clientTel: mockFields.customer_contact,
    clientMobile: '07123 456789',
    applianceLocation: mockFields.appliance_location,
    applianceMake: mockFields.make_model,
    applianceModel: '',
    applianceSerial: 'SN-12345',
    applianceType: mockFields.appliance_type,
    applianceClassification: mockFields.classification,
    gasEscape: true,
    pipeworkIssue: false,
    ventilationIssue: true,
    meterIssue: false,
    chimneyFlueIssue: true,
    otherIssue: false,
    faultDetails: mockFields.unsafe_situation_description,
    actionsTaken: mockFields.actions_taken,
    actionsRequired: mockFields.underlying_cause,
    riddor11_1: true,
    riddor11_2: false,
    issuedBySignature: '',
    issuedByPrintName: mockFields.engineer_name,
    receivedBySignature: '',
    receivedByPrintName: mockFields.customer_name,
    issuedDate: mockFields.issued_at,
    noticeLeftOnPremises: true,
  };

  const fieldNames = new Set(form.getFields().map((field) => field.getName()));
  const filled = new Set();

  const setText = (fieldName, value) => {
    const entries = toFieldNameList(fieldName);
    if (!entries.length) return;
    const lines = entries.length > 1 ? splitTextLines(value, entries.length) : [value];
    lines.forEach((line, idx) => {
      const name = entries[idx];
      if (!name || !fieldNames.has(name) || filled.has(name)) return;
      try {
        const field = form.getTextField(name);
        field.setText(line);
        filled.add(name);
      } catch {
        // ignore
      }
    });
  };

  const setCheckbox = (fieldName, checked) => {
    const entries = toFieldNameList(fieldName);
    if (!entries.length) return;
    entries.forEach((name) => {
      if (!name || !fieldNames.has(name) || filled.has(name)) return;
      try {
        const field = form.getCheckBox(name);
        if (checked) field.check();
        else field.uncheck();
        filled.add(name);
      } catch {
        // ignore
      }
    });
  };

  Object.keys(GAS_WARNING_FORM_FIELD_NAMES).forEach((key) => {
    const fieldName = GAS_WARNING_FORM_FIELD_NAMES[key];
    if (!fieldName) return;
    const value = values[key];
    if (value === undefined || value === null || value === '') return;
    if (typeof value === 'boolean') {
      setCheckbox(fieldName, value);
      return;
    }
    setText(fieldName, toText(value));
  });

  form.updateFieldAppearances();

  await fs.promises.mkdir(path.join(process.cwd(), 'tmp'), { recursive: true });
  const outputBytes = await pdfDoc.save();
  await fs.promises.writeFile(path.join(process.cwd(), OUTPUT_PATH), outputBytes);

  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
