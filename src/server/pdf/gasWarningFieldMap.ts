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

export type GasWarningFormFieldName = string | string[] | null;

export const GAS_WARNING_FORM_FIELD_NAMES: Record<GasWarningFieldKey, GasWarningFormFieldName> = {
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
