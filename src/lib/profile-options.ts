export const TRADE_TYPES = [
  'Gas Engineer',
  'Domestic Plumber',
  'Heating Engineer',
  'Drainage Engineer',
  'Bathroom/Kitchen Fitter',
  'Maintenance/Handyman',
  'Commercial Plumber',
] as const;

export const CERTIFICATIONS = [
  'Gas Safe',
  'WRAS Approved',
  'Competent Person Scheme',
  'NVQ Level 2',
  'NVQ Level 3',
] as const;

export type TradeType = (typeof TRADE_TYPES)[number];
export type CertificationType = (typeof CERTIFICATIONS)[number];
