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
  vat_rate: number;
  currency: string;
  notes?: string | null;
  profile: InvoiceProfile;
  client: InvoiceClient;
  job: InvoiceJob;
  lineItems: InvoiceLineItem[];
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
};

const formatMoney = (value: number, currency: string) => `${currency} ${value.toFixed(2)}`;

const splitAddressParts = (value?: string | null) =>
  String(value ?? '')
    .split(/[\r\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

const buildPaymentLines = (profile: InvoiceProfile, invoiceNumber: string) => {
  const payableTo = profile.bank_account_name ?? profile.company_name ?? profile.full_name ?? null;
  const lines = [
    payableTo ? `Payable to: ${payableTo}` : null,
    profile.bank_name ? `Bank: ${profile.bank_name}` : null,
    profile.bank_sort_code ? `Sort code: ${profile.bank_sort_code}` : null,
    profile.bank_account_number ? `Account number: ${profile.bank_account_number}` : null,
    `Reference: ${invoiceNumber}`,
  ].filter((line): line is string => Boolean(line));

  if (lines.length > 1) {
    return lines;
  }

  return ['Bank transfer details can be added in Settings.', `Reference: ${invoiceNumber}`];
};

export async function renderInvoicePdf(input: InvoiceInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  let page = pdfDoc.addPage(pageSize);
  let { height, width } = page.getSize();
  const margin = 40;
  let y = height - margin;

  const text = (value: string, x: number, yPos: number, size = 10, bold = false) => {
    page.drawText(value, {
      x,
      y: yPos,
      size,
      font: bold ? fontBold : font,
      color: rgb(0.15, 0.15, 0.15),
    });
  };

  const startNewPage = () => {
    page = pdfDoc.addPage(pageSize);
    ({ height, width } = page.getSize());
    y = height - margin;
    text(input.invoice_number, margin, y, 12, true);
    y -= 18;
  };

  const headerName = input.profile.company_name ?? input.profile.full_name ?? 'Invoice';
  text(headerName, margin, y, 18, true);
  y -= 22;
  splitAddressParts(input.profile.company_address).forEach((line) => {
    text(line, margin, y, 10);
    y -= 14;
  });
  if (input.profile.company_phone) {
    text(`Tel: ${input.profile.company_phone}`, margin, y, 10);
    y -= 14;
  }
  if (input.profile.default_engineer_name) {
    text(`Engineer: ${input.profile.default_engineer_name}`, margin, y, 10);
    y -= 14;
  }
  if (input.profile.gas_safe_number) {
    text(`Gas Safe: ${input.profile.gas_safe_number}`, margin, y, 10);
    y -= 14;
  }
  if (input.profile.default_engineer_id) {
    text(`ID: ${input.profile.default_engineer_id}`, margin, y, 10);
    y -= 14;
  }

  const rightX = width - margin - 180;
  text('Invoice', rightX, height - margin, 16, true);
  text(input.invoice_number, rightX, height - margin - 18, 11);
  text(`Status: ${input.status}`, rightX, height - margin - 34, 10);
  if (input.issue_date) {
    text(`Issue: ${formatDate(input.issue_date)}`, rightX, height - margin - 48, 10);
  }
  if (input.due_date) {
    text(`Due: ${formatDate(input.due_date)}`, rightX, height - margin - 62, 10);
  }

  y -= 10;
  const clientBlockY = y - 6;
  text('Bill to', margin, clientBlockY, 10, true);
  const clientLines = [input.client.name ?? 'Client'];
  const clientAddress = splitAddressParts(input.client.address).join(', ');
  const jobAddress = splitAddressParts(input.job.address).join(', ');
  if (clientAddress) clientLines.push(clientAddress);
  if (jobAddress && jobAddress !== clientAddress) clientLines.push(jobAddress);
  if (input.client.email?.trim()) clientLines.push(input.client.email.trim());
  if (input.client.phone?.trim()) clientLines.push(input.client.phone.trim());
  let clientY = clientBlockY - 14;
  clientLines.forEach((line) => {
    text(line, margin, clientY, 10);
    clientY -= 12;
  });

  let tableY = clientY - 12;
  const drawTableHeader = (rowY: number) => {
    text('Description', margin, rowY, 10, true);
    text('Qty', 340, rowY, 10, true);
    text('Unit', 390, rowY, 10, true);
    text('Line total', 460, rowY, 10, true);
  };

  drawTableHeader(tableY);
  tableY -= 14;

  const drawRow = (rowY: number, item: InvoiceLineItem) => {
    const lineTotal = item.quantity * item.unit_price;
    text(item.description, margin, rowY, 10);
    text(item.quantity.toString(), 340, rowY, 10);
    text(formatMoney(item.unit_price, input.currency), 390, rowY, 10);
    text(formatMoney(lineTotal, input.currency), 460, rowY, 10);
  };

  const rowHeight = 18;
  input.lineItems.forEach((item) => {
    if (tableY < 140) {
      startNewPage();
      tableY = y;
      drawTableHeader(tableY);
      tableY -= 14;
    }
    drawRow(tableY, item);
    tableY -= rowHeight;
  });

  const subtotal = input.lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const taxable = input.lineItems.reduce(
    (sum, item) => sum + (item.vat_exempt ? 0 : item.quantity * item.unit_price),
    0,
  );
  const vat = taxable * input.vat_rate;
  const total = subtotal + vat;

  const totalsY = Math.max(tableY - 8, 120);
  page.drawRectangle({
    x: rightX - 12,
    y: totalsY - 42,
    width: 192,
    height: 58,
    borderColor: rgb(0.82, 0.84, 0.87),
    borderWidth: 1,
  });
  text(`Subtotal`, rightX, totalsY, 10);
  text(formatMoney(subtotal, input.currency), rightX + 92, totalsY, 10, true);
  text(`VAT (${(input.vat_rate * 100).toFixed(0)}%)`, rightX, totalsY - 16, 10);
  text(formatMoney(vat, input.currency), rightX + 92, totalsY - 16, 10, true);
  text(`Total`, rightX, totalsY - 34, 12, true);
  text(formatMoney(total, input.currency), rightX + 92, totalsY - 34, 12, true);

  const paymentDetailsY = totalsY - 84;
  text('Payment details', margin, paymentDetailsY, 10, true);
  const paymentLines = buildPaymentLines(input.profile, input.invoice_number);
  paymentLines.forEach((line, index) => {
    text(line, margin, paymentDetailsY - 14 - index * 12, 10);
  });

  if (input.notes && input.notes.trim()) {
    text('Notes', margin, paymentDetailsY - 62, 10, true);
    const noteLines = input.notes.split('\n').slice(0, 6);
    noteLines.forEach((line, idx) => {
      text(line, margin, paymentDetailsY - 76 - idx * 12, 10);
    });
  }

  return pdfDoc.save();
}
