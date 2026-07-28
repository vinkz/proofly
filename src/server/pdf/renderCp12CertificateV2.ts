import 'server-only';

import { Buffer } from 'node:buffer';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';

import { CP12_TEMPLATE_VERSION, cp12FieldShouldRender } from '@/lib/cp12/field-config';
import { supabaseServerServiceRole } from '@/lib/supabaseServer';
import { pdfSafeText } from '@/lib/pdf-text';
import { formatUkDate } from './formatUkDate';
import type { ApplianceInput, Cp12FieldMap } from './renderCp12Certificate';

type RenderCp12V2Input = {
  fields: Cp12FieldMap;
  appliances: ApplianceInput[];
  recordId: string;
  issuedAt: Date;
  companyLogoBytes?: Uint8Array;
};

// ---------------------------------------------------------------------------
// House style — matches renderInvoicePdf.ts: monochrome greys, colored status
// badges. A4 portrait.
// ---------------------------------------------------------------------------
const hex = (value: string) => {
  const n = parseInt(value.replace('#', ''), 16);
  return rgb((n >> 16) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255);
};
const C = {
  black: hex('#111111'),
  dark: hex('#333333'),
  mid: hex('#555555'),
  muted: hex('#888888'),
  border: hex('#e0e0e0'),
  rule: hex('#f0f0f0'),
  panel: hex('#f8f8f8'),
  safeBg: hex('#e7f4ec'),
  safeFg: hex('#1a6d44'),
  warnBg: hex('#fbeecd'),
  warnFg: hex('#8a5a10'),
  dangerBg: hex('#fbe3e3'),
  dangerFg: hex('#9b2020'),
};
const PAGE = { w: 595.28, h: 841.89, margin: 42, footer: 34 };

// Folded to what the standard fonts can encode. pdf-lib throws on anything
// WinAnsi cannot represent, which would fail the whole render rather than
// degrade one field — see @/lib/pdf-text.
const text = (value: unknown) => pdfSafeText(value).trim();
const affirmative = (value: unknown) => value === true || ['true', 'yes', 'pass', 'confirmed', 'satisfactory'].includes(text(value).toLowerCase());

/** Safe | At Risk / ID (unsafe) | neutral, derived from the safe-to-use verdict. */
function applianceStatus(app: ApplianceInput): 'safe' | 'unsafe' | 'neutral' {
  const v = text(app.applianceSafeToUse).toLowerCase();
  if (!v) return 'neutral';
  if (/(^|\b)(no|at risk|immediately dangerous|\bid\b|not safe|unsafe)/.test(v)) return 'unsafe';
  if (/(yes|safe|to current standards)/.test(v)) return 'safe';
  return 'neutral';
}

function addMonths(dmy: string, months: number): string | null {
  const m = dmy.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (Number.isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + months);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

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

export async function renderCp12CertificateV2Pdf(input: RenderCp12V2Input): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let logo: PDFImage | null = null;
  if (input.companyLogoBytes?.length) {
    try {
      logo = await pdf.embedPng(input.companyLogoBytes);
    } catch {
      try { logo = await pdf.embedJpg(input.companyLogoBytes); } catch { logo = null; }
    }
  }

  const M = PAGE.margin;
  const CONTENT_W = PAGE.w - M * 2;
  let page = pdf.addPage([PAGE.w, PAGE.h]);
  let y = PAGE.h - M;

  // --- low-level primitives ------------------------------------------------
  const draw = (s: string, x: number, yy: number, size: number, f: PDFFont, color = C.dark) =>
    page.drawText(s, { x, y: yy, size, font: f, color });
  const width = (s: string, size: number, f: PDFFont) => f.widthOfTextAtSize(s, size);

  const footer = (target: PDFPage, n: number) => {
    target.drawLine({ start: { x: M, y: PAGE.footer + 12 }, end: { x: PAGE.w - M, y: PAGE.footer + 12 }, thickness: 0.5, color: C.border });
    target.drawText(`Ref: ${input.recordId}`, { x: M, y: PAGE.footer, size: 7.5, font, color: C.muted });
    const right = `${CP12_TEMPLATE_VERSION} · Page ${n}`;
    target.drawText(right, { x: PAGE.w - M - width(right, 7.5, font), y: PAGE.footer, size: 7.5, font, color: C.muted });
  };
  const newPage = () => {
    footer(page, pdf.getPageCount());
    page = pdf.addPage([PAGE.w, PAGE.h]);
    y = PAGE.h - M;
  };
  const ensure = (need: number) => { if (y - need < PAGE.footer + 24) newPage(); };

  const wrap = (s: string, size: number, f: PDFFont, maxW: number) => {
    const words = s.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (line && width(candidate, size, f) > maxW) { lines.push(line); line = w; } else line = candidate;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  };

  const badge = (label: string, x: number, yy: number, bg: ReturnType<typeof hex>, fg: ReturnType<typeof hex>) => {
    const size = 8;
    const padX = 7;
    const w = width(label, size, bold) + padX * 2;
    page.drawRectangle({ x, y: yy - 3, width: w, height: size + 7, color: bg });
    page.drawText(label, { x: x + padX, y: yy, size, font: bold, color: fg });
    return w;
  };

  // Section heading with guaranteed space-before + underline.
  const section = (label: string) => {
    ensure(34);
    y -= 18;
    draw(label.toUpperCase(), M, y, 10, bold, C.black);
    y -= 7;
    page.drawLine({ start: { x: M, y }, end: { x: PAGE.w - M, y }, thickness: 0.8, color: C.dark });
    y -= 14;
  };

  // label:value row (two columns) — only rendered when value present.
  const LABEL_W = 132;
  const kv = (label: string, value: string, x = M, colW = CONTENT_W) => {
    if (!value) return;
    const lines = wrap(value, 9.5, font, colW - LABEL_W);
    ensure(lines.length * 12 + 2);
    draw(label, x, y, 9.5, bold, C.dark);
    lines.forEach((ln, i) => draw(ln, x + LABEL_W, y - i * 12, 9.5, font, C.dark));
    y -= Math.max(15, lines.length * 12 + 3);
  };

  // full-width statement (no label column) — for long confirmations.
  const statement = (value: string, size = 9.5, color = C.dark) => {
    const lines = wrap(value, size, font, CONTENT_W);
    ensure(lines.length * (size + 3) + 2);
    lines.forEach((ln) => { draw(ln, M, y, size, font, color); y -= size + 3; });
    y -= 4;
  };

  // ------------------------------------------------------------------ header
  const headerTop = y;
  let leftY = headerTop;
  if (logo) {
    const dims = logo.scaleToFit(150, 46);
    page.drawImage(logo, { x: M, y: headerTop - dims.height + 8, width: dims.width, height: dims.height });
    leftY = headerTop - dims.height - 4;
  }
  const businessName = text(input.fields.companyName);
  if (businessName) { draw(businessName, M, leftY, 13, bold, C.black); leftY -= 16; }
  const bizLines = [
    [input.fields.companyAddressLine1, input.fields.companyAddressLine2, input.fields.companyTown, input.fields.companyPostcode].map(text).filter(Boolean).join(', '),
    [input.fields.companyPhone, input.fields.companyEmail].map(text).filter(Boolean).join('  ·  '),
  ].filter(Boolean);
  bizLines.forEach((ln) => { draw(ln, M, leftY, 9, font, C.mid); leftY -= 12; });

  // right column — document identity
  const rX = PAGE.w - M - 200;
  let rY = headerTop;
  draw('LANDLORD GAS SAFETY RECORD', rX, rY, 9, bold, C.black); rY -= 13;
  draw('CP12 · Gas Safety (Installation and Use) Regulations 1998', rX, rY, 6.8, font, C.muted); rY -= 16;
  const ref = text(input.fields.certNumber) || input.recordId;
  draw('Certificate', rX, rY, 8.5, font, C.muted); draw(ref, rX + 66, rY, 9.5, bold, C.black); rY -= 14;
  const inspDate = formatUkDate(text(input.fields.issueDate)) || formatUkDate(input.issuedAt);
  draw('Inspection', rX, rY, 8.5, font, C.muted); draw(inspDate, rX + 66, rY, 9.5, bold, C.black); rY -= 16;

  // record-level status badge
  const anyUnsafe = input.appliances.some((a) => applianceStatus(a) === 'unsafe');
  const anyDefect = Boolean(text(input.fields.defectsIdentified)) || anyUnsafe;
  if (anyDefect) badge('DEFECTS IDENTIFIED', rX, rY, C.warnBg, C.warnFg);
  else badge('SATISFACTORY', rX, rY, C.safeBg, C.safeFg);
  rY -= 4;

  y = Math.min(leftY, rY) - 6;
  page.drawLine({ start: { x: M, y }, end: { x: PAGE.w - M, y }, thickness: 1, color: C.dark });
  y -= 4;

  // next-inspection callout (conventional but wanted; auto +12mo fallback)
  const nextDue = formatUkDate(text(input.fields.nextInspectionDue)) || addMonths(inspDate, 12) || '';
  if (nextDue) {
    ensure(24);
    const label = `Next inspection due by ${nextDue}`;
    page.drawRectangle({ x: M, y: y - 17, width: CONTENT_W, height: 20, color: C.panel });
    draw(label, M + 8, y - 12, 9.5, bold, C.dark);
    y -= 26;
  }

  // ------------------------------------------------- property + landlord (2 col)
  section('Property & landlord');
  const colGap = 18;
  const colW = (CONTENT_W - colGap) / 2;
  const startY = y;
  const propLines = [
    input.fields.propertyAddressName,
    input.fields.propertyAddressLine1,
    input.fields.propertyAddressLine2,
    input.fields.propertyTown,
    input.fields.propertyPostcode,
  ].map(text).filter(Boolean);
  const landLines = [
    input.fields.landlordName,
    input.fields.landlordCompany,
    input.fields.landlordAddressLine1,
    input.fields.landlordAddressLine2,
    input.fields.landlordTown,
    input.fields.landlordPostcode,
  ].map(text).filter(Boolean);
  const col = (heading: string, lines: string[], x: number) => {
    let cy = startY;
    draw(heading, x, cy, 8.5, bold, C.muted); cy -= 13;
    (lines.length ? lines : ['—']).forEach((ln) => { draw(ln, x, cy, 9.5, font, C.dark); cy -= 12; });
    return cy;
  };
  const propEnd = col('PROPERTY ADDRESS', propLines, M);
  const landEnd = col('LANDLORD / AGENT', landLines, M + colW + colGap);
  y = Math.min(propEnd, landEnd) - 4;
  kv('Landlord tel', text(input.fields.landlordTel));

  // ------------------------------------------------------------- engineer
  section('Engineer');
  kv('Engineer', text(input.fields.engineerName));
  kv('Gas Safe reg. no.', text(input.fields.gasSafeRegistrationNumber));
  kv('ID card no.', text(input.fields.engineerIdNumber));

  // ------------------------------------------------------------- appliances
  section('Appliances & flues checked');
  input.appliances.forEach((app, i) => {
    ensure(70);
    const status = applianceStatus(app);
    const heading = `Appliance ${i + 1}: ${text(app.description) || text(app.type) || '—'}`;
    draw(heading, M, y, 10, bold, C.black);
    if (status !== 'neutral') {
      const label = status === 'safe' ? 'SAFE' : 'AT RISK / ID';
      const [bg, fg] = status === 'safe' ? [C.safeBg, C.safeFg] : [C.dangerBg, C.dangerFg];
      const bw = width(label, 8, bold) + 14;
      badge(label, PAGE.w - M - bw, y, bg, fg);
    }
    y -= 15;

    // Identity + safety verdict — part of the Reg 36(3) appliance description
    // required for every appliance/flue listed (audit/cp12-field-analysis.md).
    const identityAttrs: Array<[string, string]> = [];
    const pushIdentity = (label: string, v?: string) => { const t = text(v); if (t) identityAttrs.push([label, t]); };
    pushIdentity('Location', app.location);
    pushIdentity('Type', app.type);
    pushIdentity('Safe to use', app.applianceSafeToUse);

    // Readings & checks — conventional detail (audit: "readings, CO alarms, next
    // inspection date..." are Tier-2, not part of the Reg 36(3) legal minimum).
    const readingAttrs: Array<[string, string]> = [];
    const pushReading = (label: string, v?: string) => { const t = text(v); if (t) readingAttrs.push([label, t]); };
    pushReading('Flue type', app.flueType);
    pushReading('Flue location', app.flueLocation);
    pushReading('Operating pressure', app.operatingPressure);
    pushReading('Heat input', app.heatInput);
    pushReading('Safety device', app.safetyDevice);
    pushReading('Ventilation', app.ventilationSatisfactory);
    pushReading('Flue termination', app.flueTerminationSatisfactory);
    pushReading('Cooker stability', app.cookerStability);
    pushReading('Spillage test', app.spillageTest);
    pushReading('Serviced', app.applianceServiced);

    const aColW = (CONTENT_W - colGap) / 2;
    const aLabelW = 108;
    const drawAttrGrid = (attrs: Array<[string, string]>) => {
      for (let r = 0; r < attrs.length; r += 2) {
        ensure(13);
        const row = attrs.slice(r, r + 2);
        row.forEach(([label, v], c) => {
          const x = M + c * (aColW + colGap);
          draw(label, x, y, 8.5, font, C.muted);
          const vLines = wrap(v, 9, font, aColW - aLabelW);
          draw(vLines[0] + (vLines.length > 1 ? '…' : ''), x + aLabelW, y, 9, font, C.dark);
        });
        y -= 13;
      }
    };
    drawAttrGrid(identityAttrs);

    // Combustion readings render full-width so CO/CO₂/ratio are never truncated.
    const combHigh = [app.combustionHighCoPpm && `CO ${text(app.combustionHighCoPpm)}ppm`, app.combustionHighCo2 && `CO2 ${text(app.combustionHighCo2)}%`, app.combustionHighRatio && `ratio ${text(app.combustionHighRatio)}`].filter(Boolean).join('  /  ') || text(app.combustionHigh);
    const combLow = [app.combustionLowCoPpm && `CO ${text(app.combustionLowCoPpm)}ppm`, app.combustionLowCo2 && `CO2 ${text(app.combustionLowCo2)}%`, app.combustionLowRatio && `ratio ${text(app.combustionLowRatio)}`].filter(Boolean).join('  /  ') || text(app.combustionLow);
    const combLabelW = 128;

    if (readingAttrs.length || combHigh || combLow) {
      ensure(11);
      draw('READINGS & CHECKS', M, y, 7.5, bold, C.muted);
      y -= 11;
      drawAttrGrid(readingAttrs);
      [['Combustion (high)', combHigh], ['Combustion (low)', combLow]].forEach(([label, v]) => {
        if (!v) return;
        ensure(13);
        draw(label, M, y, 8.5, font, C.muted);
        draw(v, M + combLabelW, y, 9, font, C.dark);
        y -= 13;
      });
    }
    // per-appliance Reg 26(9) — reflects the actual captured flag
    const reg = affirmative(app.reg26Confirmed) ? 'Reg 26(9): confirmed for this appliance/flue' : 'Reg 26(9): not confirmed';
    draw(reg, M, y, 8.5, bold, affirmative(app.reg26Confirmed) ? C.safeFg : C.dangerFg); y -= 13;
    if (text(app.remedialActionTaken)) { statement(`Action: ${text(app.remedialActionTaken)}`, 9, C.dark); }
    if (i < input.appliances.length - 1) { page.drawLine({ start: { x: M, y: y + 2 }, end: { x: PAGE.w - M, y: y + 2 }, thickness: 0.5, color: C.rule }); y -= 8; }
  });

  // ------------------------------------------------ defects & remedial (always)
  section('Defects & remedial action');
  kv('Defects identified', text(input.fields.defectsIdentified) || 'None identified');
  kv('Remedial action taken', text(input.fields.remedialWorksRequired) || 'None required');
  if (cp12FieldShouldRender('notes', input.fields.warningNoticeIssued)) kv('Warning notice', text(input.fields.warningNoticeIssued));
  // Reg 26(9) record-level confirmation — always present, full width (no overlap).
  const regRecord = input.appliances.length && input.appliances.every((a) => affirmative(a.reg26Confirmed))
    ? 'Regulation 26(9) confirmation: the safety checks required by Reg 26(9)(a)-(d) were completed for each appliance and flue listed above.'
    : 'Regulation 26(9) confirmation: recorded per appliance above.';
  statement(regRecord, 9, C.mid);
  if (cp12FieldShouldRender('notes', input.fields.additionalNotes)) kv('Additional notes', text(input.fields.additionalNotes));

  // ------------------------------------------------ additional checks (optional)
  const coAlarm = [
    input.fields.coAlarmFitted && `Fitted: ${text(input.fields.coAlarmFitted)}`,
    input.fields.coAlarmTested && `Tested: ${text(input.fields.coAlarmTested)}`,
    input.fields.coAlarmSatisfactory && `Satisfactory: ${text(input.fields.coAlarmSatisfactory)}`,
  ].filter(Boolean).join('  ·  ');
  const house = [
    input.fields.emergencyControlAccessible && `Emergency control: ${text(input.fields.emergencyControlAccessible)}`,
    input.fields.gasTightnessSatisfactory && `Tightness: ${text(input.fields.gasTightnessSatisfactory)}`,
    input.fields.pipeworkVisualSatisfactory && `Pipework: ${text(input.fields.pipeworkVisualSatisfactory)}`,
    input.fields.equipotentialBondingSatisfactory && `Bonding: ${text(input.fields.equipotentialBondingSatisfactory)}`,
  ].filter(Boolean).join('  ·  ');
  if (coAlarm || house) {
    section('Additional checks');
    if (coAlarm) kv('CO alarms', coAlarm);
    if (house) kv('Whole-house', house);
  }

  // -------------------------------------------------------------- signatures
  section('Signatures');
  ensure(70);
  const sigColW = (CONTENT_W - colGap) / 2;
  const sigBaseY = y;
  const drawSig = async (heading: string, name: string, url: string | undefined, x: number) => {
    draw(heading, x, sigBaseY, 8.5, bold, C.muted);
    const sig = url ? await fetchSignatureBytes(url) : null;
    if (sig) {
      try {
        const img = sig.mime.includes('png') ? await pdf.embedPng(sig.bytes) : await pdf.embedJpg(sig.bytes);
        const dims = img.scaleToFit(sigColW - 10, 34);
        page.drawImage(img, { x, y: sigBaseY - 44, width: dims.width, height: dims.height });
      } catch { /* fall back to typed name */ }
    }
    page.drawLine({ start: { x, y: sigBaseY - 48 }, end: { x: x + sigColW - 10, y: sigBaseY - 48 }, thickness: 0.5, color: C.border });
    draw(name || '—', x, sigBaseY - 60, 9.5, font, C.dark);
  };
  await drawSig('ENGINEER', text(input.fields.engineerSignatureText) || text(input.fields.engineerName), input.fields.engineerSignatureUrl, M);
  // customer/received-by — only when a signature was actually captured (the name
  // alone comes from the job and would leave an empty signature box otherwise).
  if (input.fields.responsiblePersonSignatureUrl) {
    await drawSig('RECEIVED BY', text(input.fields.responsiblePersonName), input.fields.responsiblePersonSignatureUrl, M + sigColW + colGap);
  }
  y = sigBaseY - 72;

  footer(page, pdf.getPageCount());
  return new Uint8Array(await pdf.save());
}
