import 'server-only';

import { Buffer } from 'node:buffer';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';

import { supabaseServerServiceRole } from '@/lib/supabaseServer';
import { formatUkDate } from './formatUkDate';
import { getGasWarningClassificationLabel, type GasWarningNoticeFields } from '@/types/gas-warning-notice';

type RenderGasWarningV2Input = {
  fields: GasWarningNoticeFields;
  issuedAt: string;
  recordId: string;
  companyLogoBytes?: Uint8Array;
};

// House style shared with the CP12 v2 renderer: monochrome greys + status colours.
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
  white: hex('#ffffff'),
  idBg: hex('#b3261e'), // Immediately Dangerous — deep red
  arBg: hex('#b7791f'), // At Risk — amber/ochre
  dangerFg: hex('#9b2020'),
};
const PAGE = { w: 595.28, h: 841.89, margin: 42, footer: 34 };

const text = (value: unknown) => String(value ?? '').trim();
const isTruthy = (value: unknown) =>
  value === true || ['yes', 'y', 'true', '1'].includes(text(value).toLowerCase());

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

const DEFECT_CATEGORIES: Array<[keyof GasWarningNoticeFields, string]> = [
  ['gas_escape_issue', 'Gas escape'],
  ['pipework_issue', 'Pipework'],
  ['ventilation_issue', 'Ventilation'],
  ['meter_issue', 'Meter'],
  ['chimney_flue_issue', 'Chimney / flue'],
  ['other_issue', 'Other'],
];

// Action flags recorded in the "Action taken" section (notification flags handled separately).
const ACTION_FLAGS: Array<[keyof GasWarningNoticeFields, string]> = [
  ['gas_supply_isolated', 'Gas supply isolated'],
  ['appliance_capped_off', 'Appliance capped off'],
  ['danger_do_not_use_label_fitted', '“Danger — Do Not Use” label fitted'],
  ['meter_or_appliance_tagged', 'Meter / appliance tagged'],
  ['customer_refused_isolation', 'Customer refused isolation'],
  ['emergency_services_contacted', 'Gas emergency service notified'],
];

export async function renderGasWarningNoticeV2Pdf(input: RenderGasWarningV2Input): Promise<Uint8Array> {
  const f = input.fields;
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

  const label = getGasWarningClassificationLabel(f.classification, f.classification_code);
  const isID = label === 'Immediately Dangerous';
  const isAR = label === 'At Risk';

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
    const mid = 'Gas Industry Unsafe Situations Procedure (IGEM/G/11)';
    target.drawText(mid, { x: M + (PAGE.w - M * 2 - width(mid, 7, font)) / 2, y: PAGE.footer, size: 7, font, color: C.muted });
    const right = `gwn-template-v2 · Page ${n}`;
    target.drawText(right, { x: PAGE.w - M - width(right, 7.5, font), y: PAGE.footer, size: 7.5, font, color: C.muted });
  };
  const newPage = () => {
    footer(page, pdf.getPageCount());
    page = pdf.addPage([PAGE.w, PAGE.h]);
    y = PAGE.h - M;
  };
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

  const section = (labelText: string) => {
    ensure(34);
    y -= 18;
    draw(labelText.toUpperCase(), M, y, 10, bold, C.black);
    y -= 7;
    page.drawLine({ start: { x: M, y }, end: { x: PAGE.w - M, y }, thickness: 0.8, color: C.dark });
    y -= 14;
  };

  const LABEL_W = 138;
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

  // ---------------------------------------------------------------- header
  const headerTop = y;
  let leftY = headerTop;
  if (logo) {
    const dims = logo.scaleToFit(150, 46);
    page.drawImage(logo, { x: M, y: headerTop - dims.height + 8, width: dims.width, height: dims.height });
    leftY = headerTop - dims.height - 4;
  }
  const businessName = text(f.engineer_company);
  if (businessName) { draw(businessName, M, leftY, 13, bold, C.black); leftY -= 16; }
  [
    [f.company_address, f.company_postcode].map(text).filter(Boolean).join(', '),
    [text(f.company_phone), text(f.gas_safe_number) && `Gas Safe ${text(f.gas_safe_number)}`].filter(Boolean).join('  ·  '),
  ].filter(Boolean).forEach((ln) => { draw(ln, M, leftY, 9, font, C.mid); leftY -= 12; });

  const rX = PAGE.w - M - 200;
  let rY = headerTop;
  draw('GAS WARNING NOTICE', rX, rY, 11, bold, C.black); rY -= 13;
  draw('Unsafe situation record', rX, rY, 8, font, C.muted); rY -= 15;
  const issueDate = formatUkDate(text(f.issued_at)) || formatUkDate(input.issuedAt);
  draw('Reference', rX, rY, 8.5, font, C.muted); draw(text(f.record_id) || input.recordId, rX + 62, rY, 9.5, bold, C.black); rY -= 13;
  draw('Date', rX, rY, 8.5, font, C.muted); draw(issueDate, rX + 62, rY, 9.5, bold, C.black); rY -= 6;

  y = Math.min(leftY, rY) - 8;

  // -------------------------------------------------- classification banner (spine)
  ensure(46);
  const bannerBg = isID ? C.idBg : isAR ? C.arBg : C.panel;
  const bannerFg = isID || isAR ? C.white : C.dark;
  const bannerH = 40;
  page.drawRectangle({ x: M, y: y - bannerH, width: CONTENT_W, height: bannerH, color: bannerBg });
  const title = isID ? 'IMMEDIATELY DANGEROUS' : isAR ? 'AT RISK' : (label || 'UNSAFE SITUATION').toUpperCase();
  draw(title, M + 14, y - 18, 16, bold, bannerFg);
  const sub = isID
    ? 'Do not use. Disconnected / turned off — a danger to life or property if used.'
    : isAR
      ? 'A recognised fault that may become dangerous. Turned off with permission.'
      : 'Classification not recorded.';
  draw(sub, M + 14, y - 32, 8.5, font, bannerFg);
  if (text(f.classification_code)) {
    const codeLabel = text(f.classification_code).toUpperCase();
    draw(codeLabel, PAGE.w - M - 14 - width(codeLabel, 15, bold), y - 20, 15, bold, bannerFg);
  }
  y -= bannerH + 6;

  // ------------------------------------------------- property + responsible person
  section('Property & responsible person');
  const colW = (CONTENT_W - colGap) / 2;
  const startY = y;
  const propLines = [f.job_address_name, f.job_address_line1, f.job_address_line2, f.job_address_city, f.job_postcode ?? f.postcode]
    .map(text).filter(Boolean);
  const fallbackProp = propLines.length ? propLines : [text(f.property_address), text(f.postcode)].filter(Boolean);
  const personLines = [
    f.customer_name,
    f.customer_company,
    f.customer_address ?? [f.customer_address_line1, f.customer_address_line2, f.customer_city].map(text).filter(Boolean).join(', '),
    f.customer_postcode,
    f.customer_contact,
  ].map(text).filter(Boolean);
  const col = (heading: string, lines: string[], x: number) => {
    let cy = startY;
    draw(heading, x, cy, 8.5, bold, C.muted); cy -= 13;
    (lines.length ? lines : ['—']).forEach((ln) => { draw(ln, x, cy, 9.5, font, C.dark); cy -= 12; });
    return cy;
  };
  const pe = col('PREMISES (WHERE THE APPLIANCE IS)', fallbackProp, M);
  const re = col('RESPONSIBLE PERSON (GIVEN TO)', personLines, M + colW + colGap);
  y = Math.min(pe, re) - 4;

  // ------------------------------------------------------------ unsafe appliance
  section('Unsafe appliance');
  kv('Type', text(f.appliance_type));
  kv('Make / model', text(f.make_model));
  kv('Serial number', text(f.serial_number));
  kv('Location', text(f.appliance_location));

  // ------------------------------------------------------------ the unsafe situation
  section('Unsafe situation');
  const categories = DEFECT_CATEGORIES.filter(([key]) => isTruthy(f[key])).map(([, l]) => l);
  if (text(f.other_issue_details)) categories.push(text(f.other_issue_details));
  if (categories.length) kv('Defect category', categories.join(', '));
  if (text(f.unsafe_situation_description)) kv('Fault details', text(f.unsafe_situation_description));
  if (text(f.underlying_cause)) kv('Underlying cause', text(f.underlying_cause));

  // ------------------------------------------------------------ action taken
  section('Action taken');
  if (text(f.actions_taken)) statement(text(f.actions_taken), 9.5, C.dark);
  const takenFlags = ACTION_FLAGS.filter(([key]) => isTruthy(f[key])).map(([, l]) => l);
  if (takenFlags.length) {
    takenFlags.forEach((flagLabel) => {
      ensure(13);
      draw('•', M, y, 9.5, bold, C.dark);
      draw(flagLabel, M + 12, y, 9.5, font, C.dark);
      y -= 13;
    });
  }
  if (isAR && !isTruthy(f.danger_do_not_use_label_fitted)) {
    statement('No “Danger — Do Not Use” label fitted (At Risk).', 8.5, C.muted);
  }

  // ------------------------------------------------------------ RIDDOR (ID only)
  if (isID) {
    section('RIDDOR report (Immediately Dangerous)');
    const reported = isTruthy(f.riddor_11_1_reported) || isTruthy(f.riddor_11_2_reported) || Boolean(text(f.emergency_reference));
    statement(
      reported
        ? 'Reported to HSE under RIDDOR 2013 Reg 6(2) (dangerous gas fitting).'
        : 'Immediately Dangerous fittings must be reported to HSE under RIDDOR within 14 days.',
      9,
      reported ? C.dark : C.dangerFg,
    );
    if (text(f.emergency_reference)) kv('Report / emergency ref.', text(f.emergency_reference));
  }

  // ------------------------------------------------- responsible person notification
  section('Responsible person notification');
  const customerPresent = f.customer_present === undefined ? true : isTruthy(f.customer_present);
  const notifyFlags = [
    [isTruthy(f.customer_informed), 'Responsible person informed of the defect'],
    [!customerPresent && isTruthy(f.notice_left_on_premises), 'Notice left on the premises (responsible person not present)'],
    [isTruthy(f.customer_understands_risks), 'Responsible person understands the risks'],
  ].filter(([ok]) => ok) as Array<[boolean, string]>;
  (notifyFlags.length ? notifyFlags.map(([, l]) => l) : ['Responsible person notified of the defect and action required.']).forEach((ln) => {
    ensure(13);
    draw('•', M, y, 9.5, bold, C.dark);
    draw(ln, M + 12, y, 9.5, font, C.dark);
    y -= 13;
  });

  // -------------------------------------------------------------- signatures
  // Reserve header + signature-block height up front so the heading never
  // orphans onto the previous page.
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
  await drawSig('ENGINEER', text(f.engineer_name), f.engineer_signature_url, M);
  if (customerPresent && (text(f.customer_name) || f.customer_signature_url)) {
    await drawSig('RESPONSIBLE PERSON', text(f.customer_name), f.customer_signature_url, M + sigColW + colGap);
  }
  y = sigBaseY - 72;

  footer(page, pdf.getPageCount());
  return new Uint8Array(await pdf.save());
}
