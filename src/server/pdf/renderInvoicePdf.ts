'use server';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type InvoiceProfile = {
  company_name?: string | null;
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

  const headerName = input.profile.company_name ?? 'Invoice';
  text(headerName, margin, y, 18, true);
  y -= 22;
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
  const clientLines = [
    input.client.name ?? 'Client',
    input.client.address ?? '',
    input.job.address ?? '',
    input.client.email ?? '',
    input.client.phone ?? '',
  ].filter((value) => value.trim().length);
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
    text(item.unit_price.toFixed(2), 390, rowY, 10);
    text(lineTotal.toFixed(2), 460, rowY, 10);
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
  text(`Subtotal: ${subtotal.toFixed(2)} ${input.currency}`, rightX, totalsY, 10);
  text(`VAT (${(input.vat_rate * 100).toFixed(0)}%): ${vat.toFixed(2)} ${input.currency}`, rightX, totalsY - 14, 10);
  text(`Total: ${total.toFixed(2)} ${input.currency}`, rightX, totalsY - 30, 12, true);

  if (input.notes && input.notes.trim()) {
    text('Notes', margin, totalsY - 50, 10, true);
    const noteLines = input.notes.split('\n').slice(0, 6);
    noteLines.forEach((line, idx) => {
      text(line, margin, totalsY - 64 - idx * 12, 10);
    });
  }

  return pdfDoc.save();
}
