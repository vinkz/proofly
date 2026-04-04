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
  engineerName: 'Company  Installer Engineer arran Company SWFY Address 1 Example Street Example Town Post Code EX1 1EX Tel No 00000000000 Gas Safe Reg 545 ID Card No',
  engineerCompany: 'text1',
  engineerAddress: ['text2', 'text3', 'text4'],
  engineerPostcode: 'text5',
  engineerTel: 'text7',
  gasSafeReg: 'text8',
  idCardNumber: 'text9',
  jobName: 'Job Address Name Address 10 Example Street Example Town Post Code EX1 1XE Tel No',
  jobAddress: ['text10', 'text11', 'text12', 'text13'],
  jobPostcode: 'text14',
  jobTel: 'text15',
  clientName: 'Client  LandLord Name Mr John Example Company Address 10 Example Street Example Town Post Code EX1 1XE Tel No Mob No',
  clientCompany: 'text6',
  clientAddress: ['text17', 'text18', 'text19'],
  clientPostcode: 'text20',
  clientTel: 'text21',
  clientMobile: 'text22',
  applianceLocation: 'text24',
  applianceMake: 'text26',
  applianceModel: null,
  applianceSerial: 'text27',
  applianceType: 'text28',
  applianceClassification: 'text29',
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
