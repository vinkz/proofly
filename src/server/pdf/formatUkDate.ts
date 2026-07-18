/**
 * Format a date value as UK numeric format DD/MM/YYYY, deterministically — without
 * depending on the server's ICU/locale data (so it never silently falls back to a
 * US-style order the way toLocaleDateString can on limited-ICU builds).
 *
 * Accepts a Date, an ISO string (YYYY-MM-DD or a full ISO datetime), or an
 * already-UK DD/MM/YYYY string. Returns '' for empty/blank input, and returns the
 * original trimmed string unchanged if it can't be parsed (so unexpected values are
 * shown rather than dropped).
 */
export function formatUkDate(value: string | Date | null | undefined): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return `${String(value.getDate()).padStart(2, '0')}/${String(value.getMonth() + 1).padStart(2, '0')}/${value.getFullYear()}`;
  }
  const v = (value ?? '').toString().trim();
  if (!v) return '';
  const dmy = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${dmy[3]}`;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) {
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
  return v;
}
