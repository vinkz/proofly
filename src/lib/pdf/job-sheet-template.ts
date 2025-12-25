import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';

import type { Database } from '@/lib/database.types';
import { formatJobAddress } from '@/lib/address';

type JobRow = Database['public']['Tables']['jobs']['Row'];

type MinimalCustomer = {
  name?: string | null;
  organization?: string | null;
};

type MinimalPropertyAddress = {
  line1?: string | null;
  line2?: string | null;
  town?: string | null;
  postcode?: string | null;
};

export type JobWithCustomerAndAddress = {
  job: JobRow;
  customer: MinimalCustomer | null;
  propertyAddress: MinimalPropertyAddress | null;
};

const toText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const formatDate = (value: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB');
};

const pickText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
};

const buildQrPayload = (baseUrl: string, sheetCode: string) => {
  const trimmedBase = baseUrl.replace(/\/$/, '');
  const safeCode = encodeURIComponent(sheetCode);
  return `${trimmedBase}/jobs/scan?code=${safeCode}`;
};

export async function renderJobSheetPdf(options: {
  job: JobWithCustomerAndAddress;
  sheetCode: string;
  baseUrl: string;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  const lineGap = 22;

  page.drawText('Job Sheet', {
    x: margin,
    y: pageHeight - margin - 12,
    size: 28,
    font: boldFont,
    color: rgb(0.07, 0.09, 0.12),
  });

  const customerName = pickText(
    options.job.customer?.name ?? null,
    options.job.customer?.organization ?? null,
    options.job.job.client_name ?? null,
  );
  const propertyAddress = pickText(
    formatJobAddress(options.job.propertyAddress, { includePostcode: true }),
    toText(options.job.job.address ?? ''),
  );
  const jobReference = pickText(options.job.job.title, options.job.job.id);
  const jobDate = formatDate(options.job.job.scheduled_for ?? options.job.job.created_at ?? null);

  let cursorY = pageHeight - margin - 70;

  const drawLabelValue = (label: string, value: string) => {
    page.drawText(label, {
      x: margin,
      y: cursorY,
      size: 11,
      font: boldFont,
      color: rgb(0.28, 0.31, 0.35),
    });
    page.drawText(value || 'N/A', {
      x: margin + 140,
      y: cursorY,
      size: 11,
      font: regularFont,
      color: rgb(0.07, 0.09, 0.12),
    });
    cursorY -= lineGap;
  };

  drawLabelValue('Customer', customerName || 'Customer');
  drawLabelValue('Property', propertyAddress || 'Address not set');
  drawLabelValue('Job reference', jobReference);
  drawLabelValue('Job date', jobDate);
  drawLabelValue('Sheet code', options.sheetCode);

  const qrPayload = buildQrPayload(options.baseUrl, options.sheetCode);
  const qrBuffer = await QRCode.toBuffer(qrPayload, {
    type: 'png',
    width: 256,
    margin: 1,
    color: { dark: '#111827', light: '#ffffff' },
  });

  const qrImage = await pdfDoc.embedPng(qrBuffer);
  const qrSize = 130;
  const qrX = pageWidth - margin - qrSize;
  const qrY = margin;

  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  });

  page.drawText('Scan this QR in CertNow to open this job', {
    x: margin,
    y: margin + 8,
    size: 10,
    font: regularFont,
    color: rgb(0.35, 0.38, 0.42),
  });

  const bytes = await pdfDoc.save();
  return new Uint8Array(bytes);
}
