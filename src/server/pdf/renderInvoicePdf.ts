'use server';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type InvoiceProfile = {
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_name?: string | null;
  bank_sort_code?: string | null;
  full_name?: string | null;
  company_name?: string | null;
  company_address?: string | null;
  company_phone?: string | null;
  company_email?: string | null;
  default_engineer_name?: string | null;
  default_engineer_id?: string | null;
  gas_safe_number?: string | null;
};

type InvoiceClient = {
  name?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
};

type InvoiceJob = {
  title?: string | null;
  address?: string | null;
};

type InvoiceLineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  vat_exempt: boolean;
};

type InvoiceInput = {
  invoice_number: string;
  status: string;
  issue_date?: string | null;
  due_date?: string | null;
  paid_date?: string | null;
  vat_rate: number;
  currency: string;
  notes?: string | null;
  profile: InvoiceProfile;
  client: InvoiceClient;
  job: InvoiceJob;
  lineItems: InvoiceLineItem[];
};

type StatusKey = 'draft' | 'unpaid' | 'overdue' | 'paid';

const hexRgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return rgb((n >> 16) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255);
};

const C = {
  black: hexRgb('#111111'),
  dark: hexRgb('#333333'),
  mid: hexRgb('#555555'),
  muted: hexRgb('#888888'),
  light: hexRgb('#aaaaaa'),
  border: hexRgb('#e0e0e0'),
  rowBorder: hexRgb('#f0f0f0'),
  payBg: hexRgb('#f8f8f8'),
  draftBg: hexRgb('#f1f0e8'),
  unpaidBg: hexRgb('#faeeda'),
  overdueBg: hexRgb('#fcebeb'),
  paidBg: hexRgb('#edf7f2'),
  draftText: hexRgb('#888888'),
  unpaidText: hexRgb('#BA7517'),
  overdueText: hexRgb('#a32d2d'),
  paidText: hexRgb('#1a7a52'),
};

const STATUS_CONFIG: Record<StatusKey, { bg: ReturnType<typeof rgb>; textColor: ReturnType<typeof rgb>; label: string }> = {
  draft:   { bg: C.draftBg,   textColor: C.draftText,   label: 'Draft' },
  unpaid:  { bg: C.unpaidBg,  textColor: C.unpaidText,  label: 'Unpaid' },
  overdue: { bg: C.overdueBg, textColor: C.overdueText, label: 'Overdue' },
  paid:    { bg: C.paidBg,    textColor: C.paidText,    label: 'Paid' },
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
};

const formatMoney = (value: number) => `£${value.toFixed(2)}`;

const splitLines = (value?: string | null) =>
  String(value ?? '').split(/[\r\n,]+/).map((p) => p.trim()).filter(Boolean);

const dedup = (lines: string[]) => lines.filter((l, i, a) => a.indexOf(l) === i);

function buildPaymentDetails(
  profile: InvoiceProfile,
  invoiceNumber: string,
): Array<{ key: string; value: string; bold?: boolean }> {
  const payableTo = profile.bank_account_name ?? profile.company_name ?? profile.full_name ?? null;
  if (!payableTo && !profile.bank_name && !profile.bank_sort_code && !profile.bank_account_number) {
    return [
      { key: 'Note', value: 'Add bank details in Settings' },
      { key: 'Reference', value: invoiceNumber, bold: true },
    ];
  }
  const rows: Array<{ key: string; value: string; bold?: boolean }> = [];
  if (payableTo) rows.push({ key: 'Pay to', value: payableTo });
  if (profile.bank_name) rows.push({ key: 'Bank', value: profile.bank_name });
  if (profile.bank_sort_code) rows.push({ key: 'Sort code', value: profile.bank_sort_code });
  if (profile.bank_account_number) rows.push({ key: 'Account', value: profile.bank_account_number });
  rows.push({ key: 'Reference', value: invoiceNumber, bold: true });
  return rows;
}

function computeDisplayStatus(input: InvoiceInput): StatusKey {
  const s = (input.status ?? '').toLowerCase();
  if (s === 'paid') return 'paid';
  if (s === 'overdue') return 'overdue';
  if (
    input.due_date &&
    !Number.isNaN(new Date(input.due_date).getTime()) &&
    new Date(input.due_date) < new Date()
  ) return 'overdue';
  if (s === 'unpaid') return 'unpaid';
  return 'draft';
}

export async function renderInvoicePdf(input: InvoiceInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PW = 595.28;
  const PH = 841.89;
  const M = 40;

  let page = pdfDoc.addPage([PW, PH]);
  let y = PH - M;

  const drawText = (
    value: string,
    x: number,
    yPos: number,
    size = 10,
    bold = false,
    color = C.dark,
  ) => {
    if (!value?.trim()) return;
    page.drawText(value, { x, y: yPos, size, font: bold ? fontBold : font, color });
  };

  const tw = (value: string, size: number, bold = false) =>
    (bold ? fontBold : font).widthOfTextAtSize(value, size);

  const drawTextRight = (value: string, edge: number, yPos: number, size = 10, bold = false, color = C.dark) =>
    drawText(value, edge - tw(value, size, bold), yPos, size, bold, color);

  const newPage = () => {
    page = pdfDoc.addPage([PW, PH]);
    y = PH - M;
    drawText(input.invoice_number, M, y, 10, true, C.black);
    y -= 20;
  };

  const displayStatus = computeDisplayStatus(input);
  const statusInfo = STATUS_CONFIG[displayStatus];

  // ═══════════════════════════════════════════
  // HEADER — two columns, heavy bottom border
  // ═══════════════════════════════════════════
  const headerStartY = y;

  // Left: company info
  let leftY = headerStartY;
  const companyName = input.profile.company_name ?? input.profile.full_name ?? '';
  if (companyName) {
    drawText(companyName, M, leftY, 15, true, C.black);
    leftY -= 21;
  }
  splitLines(input.profile.company_address).forEach((line) => {
    drawText(line, M, leftY, 10, false, C.mid);
    leftY -= 14;
  });
  if (input.profile.company_phone) {
    drawText(input.profile.company_phone, M, leftY, 10, false, C.mid);
    leftY -= 14;
  }
  if (input.profile.company_email) {
    drawText(input.profile.company_email, M, leftY, 10, false, C.mid);
    leftY -= 14;
  }

  // Right: invoice metadata + status badge
  const rightEdge = PW - M;
  const rightColX = rightEdge - 165;
  let rightY = headerStartY;

  drawText('INVOICE', rightColX, rightY, 9, false, C.muted);
  rightY -= 18;
  drawText(input.invoice_number, rightColX, rightY, 16, true, C.black);
  rightY -= 21;

  if (input.issue_date) {
    drawText(`Issued ${formatDate(input.issue_date)}`, rightColX, rightY, 10, false, C.mid);
    rightY -= 14;
  }
  if (input.due_date) {
    drawText(`Due ${formatDate(input.due_date)}`, rightColX, rightY, 10, false, C.mid);
    rightY -= 14;
  }

  // Status badge
  rightY -= 6;
  const badgeLabel = statusInfo.label;
  const badgeFontSz = 9;
  const badgePadX = 10;
  const badgePadY = 4;
  const badgeLabelW = tw(badgeLabel, badgeFontSz, true);
  const badgeW = badgeLabelW + badgePadX * 2;
  const badgeH = badgeFontSz + badgePadY * 2;
  page.drawRectangle({
    x: rightColX,
    y: rightY - badgePadY,
    width: badgeW,
    height: badgeH,
    color: statusInfo.bg,
  });
  drawText(badgeLabel, rightColX + badgePadX, rightY + badgePadY - 1, badgeFontSz, true, statusInfo.textColor);
  rightY -= badgeH + 4;

  if (displayStatus === 'paid' && input.paid_date) {
    drawText(`Paid on ${formatDate(input.paid_date)}`, rightColX, rightY, 9, false, C.mid);
    rightY -= 14;
  }

  // Header bottom border
  const headerBottomY = Math.min(leftY, rightY) - 12;
  page.drawLine({
    start: { x: M, y: headerBottomY },
    end: { x: PW - M, y: headerBottomY },
    thickness: 2,
    color: C.black,
  });
  y = headerBottomY - 18;

  // ═══════════════════════════════════════════
  // BILL TO
  // ═══════════════════════════════════════════
  drawText('BILL TO', M, y, 9, false, C.muted);
  y -= 14;

  const billName = input.client.name?.trim() ?? '';
  if (billName) {
    drawText(billName, M, y, 13, true, C.black);
    y -= 17;
  }

  dedup(splitLines(input.client.address)).forEach((line) => {
    drawText(line, M, y, 11, false, C.mid);
    y -= 14;
  });
  if (input.client.email?.trim()) {
    drawText(input.client.email.trim(), M, y, 11, false, C.mid);
    y -= 14;
  }
  if (input.client.phone?.trim()) {
    drawText(input.client.phone.trim(), M, y, 11, false, C.mid);
    y -= 14;
  }

  y -= 12;

  // ═══════════════════════════════════════════
  // LINE ITEMS TABLE
  // ═══════════════════════════════════════════
  const colDesc = M;
  const colQty = 340;
  const colUnit = 410;
  const colTotal = PW - M;

  drawText('DESCRIPTION', colDesc, y, 9, false, C.muted);
  drawTextRight('QTY', colQty + 20, y, 9, false, C.muted);
  drawTextRight('UNIT', colUnit + 50, y, 9, false, C.muted);
  drawTextRight('TOTAL', colTotal, y, 9, false, C.muted);
  y -= 10;
  page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.75, color: C.border });
  y -= 16;

  const drawTableHeader = () => {
    drawText('DESCRIPTION', colDesc, y, 9, false, C.muted);
    drawTextRight('QTY', colQty + 20, y, 9, false, C.muted);
    drawTextRight('UNIT', colUnit + 50, y, 9, false, C.muted);
    drawTextRight('TOTAL', colTotal, y, 9, false, C.muted);
    y -= 10;
    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.75, color: C.border });
    y -= 16;
  };

  for (const item of input.lineItems) {
    if (y < 180) {
      newPage();
      drawTableHeader();
    }
    const lineTotal = item.quantity * item.unit_price;
    const desc = item.description.length > 54 ? item.description.slice(0, 51) + '…' : item.description;
    drawText(desc, colDesc, y, 11, false, C.dark);
    drawTextRight(String(item.quantity), colQty + 20, y, 11, false, C.dark);
    drawTextRight(formatMoney(item.unit_price), colUnit + 50, y, 11, false, C.dark);
    drawTextRight(formatMoney(lineTotal), colTotal, y, 11, false, C.dark);
    y -= 5;
    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.4, color: C.rowBorder });
    y -= 14;
  }

  y -= 8;

  // ═══════════════════════════════════════════
  // TOTALS — right-aligned ~50% width
  // ═══════════════════════════════════════════
  const subtotal = input.lineItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const taxable = input.lineItems.reduce((s, i) => s + (i.vat_exempt ? 0 : i.quantity * i.unit_price), 0);
  const vatAmount = taxable * input.vat_rate;
  const total = subtotal + vatAmount;

  const totalsLabelX = PW / 2;
  const vatLabel = `VAT (${(input.vat_rate * 100).toFixed(0)}%)`;

  drawText('Subtotal', totalsLabelX, y, 12, false, C.mid);
  drawTextRight(formatMoney(subtotal), rightEdge, y, 12, false, C.mid);
  y -= 16;

  drawText(vatLabel, totalsLabelX, y, 12, false, C.mid);
  drawTextRight(formatMoney(vatAmount), rightEdge, y, 12, false, C.mid);
  y -= 12;

  page.drawLine({ start: { x: totalsLabelX, y }, end: { x: rightEdge, y }, thickness: 1.5, color: C.black });
  y -= 16;

  drawText('Total', totalsLabelX, y, 14, true, C.black);
  drawTextRight(formatMoney(total), rightEdge, y, 14, true, C.black);
  y -= 28;

  // ═══════════════════════════════════════════
  // PAYMENT BLOCK (left-border style)
  // ═══════════════════════════════════════════
  const blockPad = 14;
  const blockRowH = 14;

  if (displayStatus === 'paid') {
    const paidDateStr = input.paid_date ? ` on ${formatDate(input.paid_date)}` : '';
    const payMsg = `Payment of ${formatMoney(total)} received${paidDateStr}. Thank you.`;
    const blockH = blockPad * 2 + blockRowH + 14;
    page.drawRectangle({ x: M, y: y - blockH, width: PW - M * 2, height: blockH, color: C.payBg });
    page.drawLine({ start: { x: M, y }, end: { x: M, y: y - blockH }, thickness: 3, color: C.black });
    drawText('PAYMENT RECEIVED', M + 12, y - blockPad, 9, false, C.muted);
    drawText(payMsg, M + 12, y - blockPad - blockRowH, 11, false, C.mid);
    y -= blockH + 14;
  } else {
    const payRows = buildPaymentDetails(input.profile, input.invoice_number);
    const blockH = blockPad * 2 + blockRowH + payRows.length * blockRowH + 18;
    page.drawRectangle({ x: M, y: y - blockH, width: PW - M * 2, height: blockH, color: C.payBg });
    page.drawLine({ start: { x: M, y }, end: { x: M, y: y - blockH }, thickness: 3, color: C.black });
    drawText('PAYMENT DETAILS', M + 12, y - blockPad, 9, false, C.muted);
    let py = y - blockPad - blockRowH;
    payRows.forEach((row) => {
      drawText(row.key, M + 12, py, 10, false, C.muted);
      drawText(row.value, M + 100, py, 10, row.bold ?? false, C.dark);
      py -= blockRowH;
    });
    drawText('Please use the reference when making payment', M + 12, py - 4, 9, false, C.light);
    y -= blockH + 14;
  }

  // ═══════════════════════════════════════════
  // NOTES
  // ═══════════════════════════════════════════
  if (input.notes?.trim()) {
    drawText('Notes', M, y, 10, true, C.dark);
    y -= 14;
    input.notes.split('\n').slice(0, 6).forEach((line) => {
      drawText(line, M, y, 10, false, C.mid);
      y -= 12;
    });
  }

  // ═══════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════
  const footerY = 30;
  page.drawLine({
    start: { x: M, y: footerY + 16 },
    end: { x: PW - M, y: footerY + 16 },
    thickness: 0.5,
    color: C.border,
  });
  drawText('Thank you for your custom.', M, footerY, 10, false, C.light);
  drawTextRight('certnow.uk', PW - M, footerY, 10, true, C.muted);

  return pdfDoc.save();
}
