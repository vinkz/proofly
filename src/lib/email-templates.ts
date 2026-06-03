import 'server-only';

export type EmailRow = {
  label: string;
  value: string | null | undefined;
  rawValue?: boolean;
};

export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function titleCase(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatSortCode(code: string): string {
  const clean = code.replace(/\D/g, '');
  return clean.length === 6 ? `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}` : code;
}

export function joinAddress(parts: Array<string | null | undefined>, fallback = 'Not provided'): string {
  const address = parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(', ');
  return address || fallback;
}

export function baseEmail(
  content: string,
  options: {
    subject?: string;
    sentOnBehalfOf?: string;
  } = {},
): string {
  const footer = options.sentOnBehalfOf
    ? `Sent on behalf of ${escapeHtml(titleCase(options.sentOnBehalfOf))} · <a href="https://certnow.uk" style="color:#aaa">certnow.uk</a>`
    : `CertNow · <a href="https://certnow.uk" style="color:#aaa">certnow.uk</a>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(options.subject ?? 'CertNow')}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:28px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8e8e8">
    <div style="padding:16px 24px;border-bottom:1px solid #e8e8e8;display:flex;align-items:center">
      <span style="font-size:15px;font-weight:600;color:#111;letter-spacing:-0.3px">certnow</span>
    </div>
    <div style="padding:24px">
      ${content}
    </div>
    <div style="padding:14px 24px;border-top:1px solid #f0f0f0;text-align:center">
      <p style="font-size:11px;color:#aaa;margin:0">${footer}</p>
    </div>
  </div>
</body>
</html>`;
}

export function emailTitle(title: string): string {
  return `<h1 style="font-size:18px;font-weight:500;color:#111;margin:0 0 8px">${escapeHtml(title)}</h1>`;
}

export function emailSubtitle(subtitle: string): string {
  return `<p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 18px">${escapeHtml(subtitle)}</p>`;
}

export function infoCard(title: string, rows: EmailRow[]): string {
  const visibleRows = rows.filter((row) => String(row.value ?? '').trim().length > 0);
  const renderedRows = visibleRows
    .map((row, index) => {
      const border = index === visibleRows.length - 1 ? '' : 'border-bottom:1px solid #f0f0f0;';
      const value = row.rawValue ? String(row.value ?? '') : escapeHtml(row.value);
      return `<div style="display:flex;gap:12px;padding:5px 0;${border}">
  <span style="font-size:13px;color:#888;min-width:120px;flex-shrink:0">${escapeHtml(row.label)}</span>
  <span style="font-size:13px;color:#111;font-weight:500">${value}</span>
</div>`;
    })
    .join('');

  return `<div style="background:#f9f9f9;border-radius:8px;padding:16px;margin:16px 0">
  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#888;margin-bottom:10px">${escapeHtml(title)}</div>
  ${renderedRows}
</div>`;
}

export function ctaButton(label: string, url: string, variant: 'dark' | 'green' = 'dark'): string {
  const background = variant === 'green' ? '#1a7a52' : '#111';
  return `<a href="${escapeHtml(url)}" style="display:block;background:${background};color:#fff;text-align:center;padding:12px 20px;border-radius:24px;font-size:14px;font-weight:500;text-decoration:none;margin-top:20px">${escapeHtml(label)} →</a>`;
}

export function note(text: string): string {
  return `<p style="font-size:12px;color:#888;line-height:1.6;margin:14px 0 0">${escapeHtml(text)}</p>`;
}

export function paragraph(text: string): string {
  return `<p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 16px">${escapeHtml(text)}</p>`;
}

export function benefitList(items: string[]): string {
  return `<div style="margin:16px 0">${items
    .map(
      (item) => `<div style="display:flex;align-items:center;gap:10px;padding:5px 0">
  <span style="width:18px;height:18px;border-radius:50%;background:#edf7f2;display:flex;align-items:center;justify-content:center;font-size:10px;color:#1a7a52;font-weight:600;flex-shrink:0">✓</span>
  <span style="font-size:13px;color:#555">${escapeHtml(item)}</span>
</div>`,
    )
    .join('')}</div>`;
}

export function classificationBadge(value: string): string {
  const normalized = value.toUpperCase();
  const styles =
    normalized === 'ID'
      ? { background: '#fcebeb', color: '#a32d2d' }
      : normalized === 'AR'
        ? { background: '#faeeda', color: '#BA7517' }
        : { background: '#f9f9f9', color: '#555' };
  return `<span style="display:inline-block;border-radius:999px;background:${styles.background};color:${styles.color};font-size:12px;font-weight:600;padding:3px 8px">${escapeHtml(normalized)}</span>`;
}
