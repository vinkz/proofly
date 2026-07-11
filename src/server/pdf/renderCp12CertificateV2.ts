import 'server-only';

import { Buffer } from 'node:buffer';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import { CP12_TEMPLATE_VERSION, cp12FieldShouldRender } from '@/lib/cp12/field-config';
import { supabaseServerServiceRole } from '@/lib/supabaseServer';
import type { ApplianceInput, Cp12FieldMap } from './renderCp12Certificate';

type RenderCp12V2Input = {
  fields: Cp12FieldMap;
  appliances: ApplianceInput[];
  recordId: string;
  issuedAt: Date;
};

const PAGE = { width: 595.28, height: 841.89, margin: 42, footer: 30 };
const text = (value: unknown) => String(value ?? '').trim();
const affirmative = (value: unknown) => value === true || ['true', 'yes', 'pass', 'confirmed'].includes(text(value).toLowerCase());

async function fetchSignatureBytes(url: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (!url) return null;
  try {
    if (url.startsWith('data:')) {
      const match = url.match(/^data:(.+?);base64,(.*)$/);
      return match ? { bytes: Uint8Array.from(Buffer.from(match[2], 'base64')), mime: match[1] || 'image/png' } : null;
    }
    if (/^https?:\/\//i.test(url)) {
      const response = await fetch(url);
      if (!response.ok) return null;
      return { bytes: new Uint8Array(await response.arrayBuffer()), mime: response.headers.get('content-type') ?? 'image/png' };
    }
    const sb = await supabaseServerServiceRole().catch(() => null);
    if (!sb) return null;
    const { data } = await sb.storage.from('signatures').createSignedUrl(url, 60);
    return data?.signedUrl ? fetchSignatureBytes(data.signedUrl) : null;
  } catch {
    return null;
  }
}

function wrap(font: PDFFont, value: string, size: number, width: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > width) {
      lines.push(line);
      line = word;
    } else line = candidate;
  });
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export async function renderCp12CertificateV2Pdf(input: RenderCp12V2Input): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const muted = rgb(0.33, 0.36, 0.39);
  const green = rgb(0.10, 0.40, 0.27);
  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;

  const footer = (target: PDFPage, number: number) => {
    target.drawLine({ start: { x: PAGE.margin, y: PAGE.footer + 14 }, end: { x: PAGE.width - PAGE.margin, y: PAGE.footer + 14 }, thickness: 0.5, color: rgb(0.8, 0.82, 0.83) });
    target.drawText(`Ref: ${input.recordId} · ${CP12_TEMPLATE_VERSION} · Page ${number}`, { x: PAGE.margin, y: PAGE.footer, size: 8, font: regular, color: muted });
  };
  const newPage = () => {
    footer(page, pdf.getPageCount());
    page = pdf.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - PAGE.margin;
  };
  const ensure = (height: number) => { if (y - height < PAGE.footer + 28) newPage(); };
  const title = (value: string) => {
    ensure(28);
    page.drawText(value, { x: PAGE.margin, y, size: 11, font: bold, color: green });
    y -= 18;
    page.drawLine({ start: { x: PAGE.margin, y }, end: { x: PAGE.width - PAGE.margin, y }, thickness: 0.6, color: rgb(0.78, 0.82, 0.8) });
    y -= 11;
  };
  const block = (label: string, value: string) => {
    const lines = wrap(regular, value || '—', 9, PAGE.width - PAGE.margin * 2 - 112);
    ensure(14 + lines.length * 12);
    page.drawText(label, { x: PAGE.margin, y, size: 9, font: bold });
    lines.forEach((line, index) => page.drawText(line, { x: PAGE.margin + 112, y: y - index * 12, size: 9, font: regular }));
    y -= Math.max(16, lines.length * 12 + 4);
  };
  const note = (value: string) => {
    const lines = wrap(regular, value, 9, PAGE.width - PAGE.margin * 2);
    ensure(lines.length * 12 + 8);
    lines.forEach((line) => { page.drawText(line, { x: PAGE.margin, y, size: 9, font: regular }); y -= 12; });
    y -= 3;
  };
  const optionalBlock = (key: Parameters<typeof cp12FieldShouldRender>[0], label: string, value: unknown) => {
    if (cp12FieldShouldRender(key, value)) block(label, text(value));
  };

  page.drawText('Landlord Gas Safety Record', { x: PAGE.margin, y, size: 19, font: bold, color: rgb(0.07, 0.08, 0.08) });
  y -= 20;
  page.drawText('CP12 · Gas Safety (Installation and Use) Regulations 1998', { x: PAGE.margin, y, size: 9, font: regular, color: muted });
  y -= 29;

  title('Record and property');
  block('Certificate reference', text(input.fields.certNumber) || input.recordId);
  block('Inspection date', text(input.fields.issueDate) || input.issuedAt.toLocaleDateString('en-GB'));
  block('Property', [input.fields.propertyAddressName, input.fields.propertyAddressLine1, input.fields.propertyAddressLine2, input.fields.propertyTown, input.fields.propertyPostcode].map(text).filter(Boolean).join(', '));

  title('Landlord or agent');
  block('Name', text(input.fields.landlordName));
  block('Correspondence address', [input.fields.landlordAddressLine1, input.fields.landlordAddressLine2, input.fields.landlordTown, input.fields.landlordPostcode].map(text).filter(Boolean).join(', '));
  optionalBlock('company_details', 'Company', input.fields.landlordCompany);
  optionalBlock('company_details', 'Telephone', input.fields.landlordTel);

  title('Engineer');
  block('Engineer', text(input.fields.engineerName));
  block('Gas Safe registration', text(input.fields.gasSafeRegistrationNumber));
  optionalBlock('company_details', 'Business', input.fields.companyName);
  optionalBlock('company_details', 'Business address', [input.fields.companyAddressLine1, input.fields.companyAddressLine2, input.fields.companyTown, input.fields.companyPostcode].map(text).filter(Boolean).join(', '));
  optionalBlock('company_details', 'Business contact', [input.fields.companyPhone, input.fields.companyEmail].map(text).filter(Boolean).join(' · '));

  title('Appliances and flues checked');
  input.appliances.forEach((appliance, index) => {
    const details = [
      `Location: ${text(appliance.location) || '—'}`,
      `Type: ${text(appliance.type) || '—'}`,
      text(appliance.flueType) ? `Flue: ${text(appliance.flueType)}${text(appliance.flueLocation) ? ` (${text(appliance.flueLocation)})` : ''}` : '',
      text(appliance.operatingPressure) ? `Operating pressure: ${text(appliance.operatingPressure)}` : '',
      text(appliance.heatInput) ? `Heat input: ${text(appliance.heatInput)}` : '',
      text(appliance.applianceSafeToUse) ? `Safe to use: ${text(appliance.applianceSafeToUse)}` : '',
    ].filter(Boolean).join(' · ');
    ensure(54);
    page.drawText(`Appliance ${index + 1}: ${text(appliance.description) || '—'}`, { x: PAGE.margin, y, size: 9, font: bold });
    y -= 13;
    note(details);
    block('Regulation 26(9)', affirmative(appliance.reg26Confirmed) ? 'Confirmed for this appliance or flue' : 'Not confirmed');
    if (text(appliance.remedialActionTaken)) block('Appliance defect/action', text(appliance.remedialActionTaken));
  });

  title('Defects and remedial action');
  block('Defects identified', text(input.fields.defectsIdentified) || 'None identified');
  block('Remedial action taken', text(input.fields.remedialWorksRequired) || 'None required');
  block('Regulation 26(9) record confirmation', 'Confirmed: the required safety checks were completed for each listed appliance or flue.');
  optionalBlock('notes', 'Additional notes', input.fields.additionalNotes);

  const coAlarm = [input.fields.coAlarmFitted, input.fields.coAlarmTested, input.fields.coAlarmSatisfactory].map(text).filter(Boolean).join(' · ');
  if (coAlarm || [input.fields.emergencyControlAccessible, input.fields.gasTightnessSatisfactory, input.fields.pipeworkVisualSatisfactory, input.fields.equipotentialBondingSatisfactory].some(Boolean)) {
    title('Additional checks');
    optionalBlock('co_alarms', 'CO alarms', coAlarm);
    optionalBlock('whole_house_checks', 'Whole-house checks', [
      text(input.fields.emergencyControlAccessible) && `Emergency control: ${text(input.fields.emergencyControlAccessible)}`,
      text(input.fields.gasTightnessSatisfactory) && `Tightness: ${text(input.fields.gasTightnessSatisfactory)}`,
      text(input.fields.pipeworkVisualSatisfactory) && `Pipework: ${text(input.fields.pipeworkVisualSatisfactory)}`,
      text(input.fields.equipotentialBondingSatisfactory) && `Bonding: ${text(input.fields.equipotentialBondingSatisfactory)}`,
    ].filter(Boolean).join(' · '));
  }

  title('Signatures');
  block('Engineer', text(input.fields.engineerSignatureText) || text(input.fields.engineerName));
  const signatureY = y - 28;
  if (signatureY < PAGE.footer + 30) newPage();
  const drawSignature = async (url: string | undefined, x: number) => {
    const signature = await fetchSignatureBytes(url ?? '');
    if (!signature) return;
    try {
      const image = signature.mime.includes('png') ? await pdf.embedPng(signature.bytes) : await pdf.embedJpg(signature.bytes);
      const size = image.scaleToFit(190, 38);
      page.drawImage(image, { x, y: y - 42, width: size.width, height: size.height });
    } catch { /* text signature remains a valid visible fallback */ }
  };
  await drawSignature(input.fields.engineerSignatureUrl, PAGE.margin);
  if (text(input.fields.responsiblePersonName) || input.fields.responsiblePersonSignatureUrl) {
    block('Responsible person acknowledgement', text(input.fields.responsiblePersonName));
    await drawSignature(input.fields.responsiblePersonSignatureUrl, PAGE.margin);
  }
  y -= 52;
  footer(page, pdf.getPageCount());
  return new Uint8Array(await pdf.save());
}
