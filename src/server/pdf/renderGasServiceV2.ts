import 'server-only';

import { Buffer } from 'node:buffer';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';

import { supabaseServerServiceRole } from '@/lib/supabaseServer';
import { pdfSafeText } from '@/lib/pdf-text';
import { formatUkDate } from './formatUkDate';
import type { ApplianceInput, GasServiceFieldMap, RenderGasServiceInput } from './renderGasServicePdf';

// House style shared with the CP12 / GWN v2 renderers: monochrome greys + status.
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
};
const PAGE = { w: 595.28, h: 841.89, margin: 42, footer: 34 };

// Folded to what the standard fonts can encode. pdf-lib throws on anything
// WinAnsi cannot represent, which would fail the whole render rather than
// degrade one field — see @/lib/pdf-text.
const text = (value: unknown) => pdfSafeText(value).trim();
const affirmative = (value: unknown) =>
  value === true || ['yes', 'y', 'true', '1', 'pass', 'ok', 'safe', 'satisfactory'].includes(text(value).toLowerCase());
const negative = (value: unknown) => ['no', 'n', 'false', '0', 'fail', 'unsafe'].includes(text(value).toLowerCase());
// A remedial field holding a bare yes/no answer or "none" is not a real defect
// description — don't let such a value alone trigger the DEFECT badge.
const isMeaningfulRemedial = (value: unknown) => {
  const v = text(value).toLowerCase();
  return v.length > 0 && !['no', 'n', 'false', '0', 'none', 'n/a', 'na', 'nil'].includes(v);
};

function addMonths(dmyOrIso: string, months: number): string | null {
  const dmy = dmyOrIso.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = dmyOrIso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let d: Date | null = null;
  if (dmy) d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  else if (iso) d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  if (!d || Number.isNaN(d.getTime())) return null;
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

export async function renderGasServiceV2Pdf(input: RenderGasServiceInput): Promise<Uint8Array> {
  const f: GasServiceFieldMap = input.fields;
  const appliance: ApplianceInput | undefined = input.appliances?.[0];
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let logo: PDFImage | null = null;
  if (input.companyLogoBytes?.length) {
    try { logo = await pdf.embedPng(input.companyLogoBytes); }
    catch { try { logo = await pdf.embedJpg(input.companyLogoBytes); } catch { logo = null; } }
  }

  const M = PAGE.margin;
  const CONTENT_W = PAGE.w - M * 2;
  const colGap = 18;
  let page = pdf.addPage([PAGE.w, PAGE.h]);
  let y = PAGE.h - M;

  const draw = (s: string, x: number, yy: number, size: number, ft: PDFFont, color = C.dark) =>
    page.drawText(s, { x, y: yy, size, font: ft, color });
  const width = (s: string, size: number, ft: PDFFont) => ft.widthOfTextAtSize(s, size);

  const footer = (target: PDFPage, n: number) => {
    target.drawLine({ start: { x: M, y: PAGE.footer + 12 }, end: { x: PAGE.w - M, y: PAGE.footer + 12 }, thickness: 0.5, color: C.border });
    target.drawText(`Ref: ${input.recordId}`, { x: M, y: PAGE.footer, size: 7.5, font, color: C.muted });
    const mid = 'Service in line with manufacturer instructions / Benchmark · GSIUR Reg 26(9)';
    target.drawText(mid, { x: M + (PAGE.w - M * 2 - width(mid, 7, font)) / 2, y: PAGE.footer, size: 7, font, color: C.muted });
    const right = `gas-service-template-v2 · Page ${n}`;
    target.drawText(right, { x: PAGE.w - M - width(right, 7.5, font), y: PAGE.footer, size: 7.5, font, color: C.muted });
  };
  const newPage = () => { footer(page, pdf.getPageCount()); page = pdf.addPage([PAGE.w, PAGE.h]); y = PAGE.h - M; };
  const ensure = (need: number) => { if (y - need < PAGE.footer + 24) newPage(); };

  const wrap = (s: string, size: number, ft: PDFFont, maxW: number) => {
    const words = s.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (line && width(candidate, size, ft) > maxW) { lines.push(line); line = w; } else line = candidate;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  };

  const badge = (labelText: string, x: number, yy: number, bg: ReturnType<typeof hex>, fg: ReturnType<typeof hex>) => {
    const size = 8; const padX = 7;
    const w = width(labelText, size, bold) + padX * 2;
    page.drawRectangle({ x, y: yy - 3, width: w, height: size + 7, color: bg });
    page.drawText(labelText, { x: x + padX, y: yy, size, font: bold, color: fg });
    return w;
  };

  const section = (labelText: string) => {
    ensure(34); y -= 18;
    draw(labelText.toUpperCase(), M, y, 10, bold, C.black);
    y -= 7;
    page.drawLine({ start: { x: M, y }, end: { x: PAGE.w - M, y }, thickness: 0.8, color: C.dark });
    y -= 14;
  };

  const LABEL_W = 150;
  const kv = (labelText: string, value: string) => {
    if (!value) return;
    const lines = wrap(value, 9.5, font, CONTENT_W - LABEL_W);
    ensure(lines.length * 12 + 2);
    draw(labelText, M, y, 9.5, bold, C.dark);
    lines.forEach((ln, i) => draw(ln, M + LABEL_W, y - i * 12, 9.5, font, C.dark));
    y -= Math.max(15, lines.length * 12 + 3);
  };

  const statement = (value: string, size = 9.5, color = C.dark) => {
    const lines = wrap(value, size, font, CONTENT_W);
    ensure(lines.length * (size + 3) + 2);
    lines.forEach((ln) => { draw(ln, M, y, size, font, color); y -= size + 3; });
    y -= 4;
  };

  // Two-column result rows (label → value), render-if-captured. Colours pass/fail.
  const resultRows = (rows: Array<[string, string]>) => {
    const rowW = (CONTENT_W - colGap) / 2;
    const rowLabelW = 132;
    for (let r = 0; r < rows.length; r += 2) {
      ensure(13);
      rows.slice(r, r + 2).forEach(([labelText, value], c) => {
        const x = M + c * (rowW + colGap);
        draw(labelText, x, y, 8.5, font, C.muted);
        const color = affirmative(value) ? C.safeFg : negative(value) ? C.warnFg : C.dark;
        draw(wrap(value, 9, font, rowW - rowLabelW)[0], x + rowLabelW, y, 9, font, color);
      });
      y -= 13;
    }
  };

  // ---------------------------------------------------------------- header
  const headerTop = y;
  let leftY = headerTop;
  if (logo) {
    const dims = logo.scaleToFit(150, 46);
    page.drawImage(logo, { x: M, y: headerTop - dims.height + 8, width: dims.width, height: dims.height });
    leftY = headerTop - dims.height - 4;
  }
  const businessName = text(f.companyName);
  if (businessName) { draw(businessName, M, leftY, 13, bold, C.black); leftY -= 16; }
  [
    [f.companyAddressLine1, f.companyAddressLine2, f.companyTown, f.companyPostcode].map(text).filter(Boolean).join(', '),
    [text(f.companyPhone), text(f.gasSafeNumber) && `Gas Safe ${text(f.gasSafeNumber)}`].filter(Boolean).join('  ·  '),
  ].filter(Boolean).forEach((ln) => { draw(ln, M, leftY, 9, font, C.mid); leftY -= 12; });

  const rX = PAGE.w - M - 210;
  let rY = headerTop;
  draw('GAS APPLIANCE SERVICE RECORD', rX, rY, 10.5, bold, C.black); rY -= 15;
  const serviceDate = formatUkDate(text(f.issuedDate)) || formatUkDate(input.issuedAt);
  draw('Reference', rX, rY, 8.5, font, C.muted); draw(text(f.certNumber) || input.recordId, rX + 66, rY, 9.5, bold, C.black); rY -= 13;
  draw('Service date', rX, rY, 8.5, font, C.muted); draw(serviceDate, rX + 66, rY, 9.5, bold, C.black); rY -= 16;
  const defect = negative(f.applianceSafe) || isMeaningfulRemedial(appliance?.remedialActionTaken);
  if (defect) badge('DEFECT IDENTIFIED', rX, rY, C.warnBg, C.warnFg);
  else if (affirmative(f.applianceSafe)) badge('APPLIANCE SAFE', rX, rY, C.safeBg, C.safeFg);
  rY -= 4;

  y = Math.min(leftY, rY) - 6;
  page.drawLine({ start: { x: M, y }, end: { x: PAGE.w - M, y }, thickness: 1, color: C.dark });
  y -= 4;

  // next service due callout
  const nextService = formatUkDate(text(f.nextServiceDate)) || addMonths(serviceDate, 12) || '';
  if (nextService) {
    ensure(24);
    page.drawRectangle({ x: M, y: y - 17, width: CONTENT_W, height: 20, color: C.panel });
    draw(`Next service due by ${nextService}`, M + 8, y - 12, 9.5, bold, C.dark);
    y -= 26;
  }

  // ------------------------------------------------- property + client (2 col)
  section('Property & client');
  const colW = (CONTENT_W - colGap) / 2;
  const startY = y;
  const propLines = [f.jobName, f.jobAddressLine1, f.jobAddressLine2, f.jobTown, f.jobPostcode].map(text).filter(Boolean);
  const clientLines = [f.clientName, f.clientCompany, f.clientAddressLine1, f.clientAddressLine2, f.clientTown, f.clientPostcode]
    .map(text).filter(Boolean);
  const col = (heading: string, lines: string[], x: number) => {
    let cy = startY;
    draw(heading, x, cy, 8.5, bold, C.muted); cy -= 13;
    (lines.length ? lines : ['—']).forEach((ln) => { draw(ln, x, cy, 9.5, font, C.dark); cy -= 12; });
    return cy;
  };
  const pe = col('PROPERTY ADDRESS (SERVICE LOCATION)', propLines, M);
  const ce = col('CLIENT', clientLines, M + colW + colGap);
  y = Math.min(pe, ce) - 4;

  // ------------------------------------------------------------- engineer
  section('Engineer');
  kv('Engineer', text(f.engineerName));
  kv('Gas Safe reg. no.', text(f.gasSafeNumber));
  kv('ID card no.', text(f.engineerId));

  // ------------------------------------------------------------- appliance
  section('Appliance serviced');
  kv('Type', text(appliance?.type) || text(f.applianceType));
  kv('Make / model', [text(appliance?.make ?? f.applianceMake), text(appliance?.model ?? f.applianceModel)].filter(Boolean).join(' ') || text(appliance?.description));
  kv('Serial number', text(appliance?.serial) || text(f.applianceSerial));
  kv('Location', text(appliance?.location) || text(f.applianceLocation));
  kv('Flue type', text(appliance?.flueType));

  // ------------------------------------------ safety examination (Reg 26(9)) — required
  section('Safety examination (Reg 26(9))');
  resultRows(([
    ['Flue effectiveness', text(f.applianceFlueingSafe)],
    ['Combustion air / ventilation', text(f.applianceVentilationSafe)],
    ['Operating pressure', text(f.operatingPressure)],
    ['Heat input', text(f.heatInput)],
    ['Safe functioning', text(f.applianceSafe) || text(f.boilerWorkingCorrectly) || text(f.applianceOperatingCorrectly)],
    ['Combustion test', text(f.emissionCombustionTest)],
  ] as Array<[string, string]>).filter(([, v]) => v));

  // combustion readings — render-if-captured. These are Benchmark/manufacturer
  // convention (mandatory only at commissioning, not at a routine service — see
  // audit/gas-service-field-analysis.md), NOT part of the Reg 26(9) legal minimum
  // above, so they get their own section rather than sitting under it.
  const combHigh = [f.highCombustionCoPpm && `CO ${text(f.highCombustionCoPpm)}ppm`, f.highCombustionCo2 && `CO2 ${text(f.highCombustionCo2)}%`, f.highCombustionRatio && `ratio ${text(f.highCombustionRatio)}`].filter(Boolean).join('  /  ');
  const combLow = [f.lowCombustionCoPpm && `CO ${text(f.lowCombustionCoPpm)}ppm`, f.lowCombustionCo2 && `CO2 ${text(f.lowCombustionCo2)}%`, f.lowCombustionRatio && `ratio ${text(f.lowCombustionRatio)}`].filter(Boolean).join('  /  ');
  if (combHigh || combLow) {
    section('Combustion readings');
    if (combHigh) kv('Combustion (high)', combHigh);
    if (combLow) kv('Combustion (low)', combLow);
  }

  // ------------------------------------------------ service checks (Benchmark) — optional
  const serviceChecks: Array<[string, string]> = ([
    ['Controls checked', text(f.applianceControlsChecked)],
    ['Burner pressure / gas rate', text(f.burnerPressureCorrect)],
    ['Gas tightness test', text(f.tightnessTest)],
    ['Pipework free from leaks', text(f.pipeworkFreeFromLeaks)],
    ['Conforms to standards', text(f.applianceConformsStandards)],
    ['Cylinder condition', text(f.cylinderConditionChecked)],
    ['Programmer / controls', text(f.programmerControlsWorking)],
    ['Magnetic filter fitted', text(f.magneticFilterFitted)],
    ['Water quality acceptable', text(f.waterQualityAcceptable)],
    ['Warm-air grills working', text(f.warmAirGrillsWorking)],
    ['Functional parts available', text(f.allFunctionalPartsAvailable)],
    ['CO alarm fitted', text(f.coAlarmFitted)],
  ] as Array<[string, string]>).filter(([, v]) => v);
  if (serviceChecks.length) {
    section('Service checks');
    resultRows(serviceChecks);
  }

  // ------------------------------------------------ recommendations / comments — optional
  const recs = ([
    ['Appliance replacement recommended', text(f.applianceReplacementRecommended)],
    ['System improvements recommended', text(f.systemImprovementsRecommended)],
    ['Warning notice explained', text(f.warningNoticeExplained)],
  ] as Array<[string, string]>).filter(([, v]) => v);
  const remedialText = isMeaningfulRemedial(appliance?.remedialActionTaken) ? text(appliance?.remedialActionTaken) : '';
  if (recs.length || text(f.engineerComments) || remedialText) {
    section('Recommendations & comments');
    // Full-width so long recommendation labels never overlap their value.
    recs.forEach(([labelText, v]) => statement(`${labelText}: ${v}`, 9.5, C.dark));
    if (remedialText) statement(`Defect / remedial: ${remedialText}`, 9.5, C.dark);
    if (text(f.engineerComments)) statement(text(f.engineerComments), 9.5, C.dark);
  }

  // -------------------------------------------------------------- signatures
  ensure(104);
  section('Signatures');
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
      } catch { /* typed name remains a valid fallback */ }
    }
    page.drawLine({ start: { x, y: sigBaseY - 48 }, end: { x: x + sigColW - 10, y: sigBaseY - 48 }, thickness: 0.5, color: C.border });
    draw(name || '—', x, sigBaseY - 60, 9.5, font, C.dark);
  };
  await drawSig('ENGINEER', text(f.issuedByPrintName) || text(f.engineerName), f.engineerSignatureUrl, M);
  // Only show the received-by block when a customer signature was actually
  // captured — the customer name alone (from the job) would otherwise leave an
  // empty signature box on every record.
  if (f.customerSignatureUrl) {
    await drawSig('RECEIVED BY', text(f.receivedByPrintName), f.customerSignatureUrl, M + sigColW + colGap);
  }
  y = sigBaseY - 72;

  footer(page, pdf.getPageCount());
  return new Uint8Array(await pdf.save());
}
