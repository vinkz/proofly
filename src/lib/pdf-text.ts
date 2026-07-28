/**
 * Make text safe for the standard PDF fonts.
 *
 * The renderers draw with StandardFonts.Helvetica, which is WinAnsi-encoded.
 * pdf-lib throws on any character it cannot encode — `WinAnsi cannot encode
 * "ł" (0x0142)` — and that exception surfaces as a failed render, not a
 * validation message. An engineer called Paweł, Šarūnas or Ștefan could fill in
 * a whole certificate and get nothing back.
 *
 * WinAnsi covers Latin-1 plus a handful of typographic specials, so accented
 * names common in the UK — Renée, Ødegård, Çelik, Müller — already render
 * correctly and must be left alone. Only characters beyond that are folded:
 * first by stripping combining marks (ū → u, ș → s), then via an explicit map
 * for letters that do not decompose (ł → l), and finally to '?' for scripts
 * that cannot be represented at all.
 *
 * Folding a name is a real degradation, and the proper fix is an embedded
 * Unicode font. This exists so that nobody is blocked from producing a document
 * in the meantime.
 */

/** WinAnsi's additions above Latin-1, all of which encode fine. */
const WIN_ANSI_SPECIALS = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160,
  0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

/** Letters carrying a stroke or bar, which NFD does not decompose. */
const NON_DECOMPOSING: Record<string, string> = {
  ł: 'l', Ł: 'L',
  đ: 'd', Đ: 'D',
  ħ: 'h', Ħ: 'H',
  ŧ: 't', Ŧ: 'T',
  ı: 'i', ȷ: 'j',
  ŋ: 'n', Ŋ: 'N',
  ə: 'e', Ə: 'E',
  ẞ: 'SS',
  œ: 'oe', Œ: 'OE',
  ĸ: 'k',
};

const encodable = (char: string) => {
  const cp = char.codePointAt(0) ?? 0;
  // Latin-1 range, excluding the C1 control block which WinAnsi reuses.
  if (cp <= 0x7f) return true;
  if (cp >= 0xa0 && cp <= 0xff) return true;
  return WIN_ANSI_SPECIALS.has(cp);
};

const foldChar = (char: string): string => {
  if (encodable(char)) return char;

  const mapped = NON_DECOMPOSING[char];
  if (mapped) return mapped;

  // Strip combining marks: ū → u, ș → s, ğ → g.
  const stripped = char.normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (stripped && [...stripped].every(encodable)) return stripped;

  // Nothing sensible to fall back to — a Han or Cyrillic character, say.
  return '?';
};

/**
 * Fold a string to something the standard fonts can draw. Returns the input
 * untouched when it is already safe, which is the overwhelming majority.
 */
export function pdfSafeText(value: unknown): string {
  const raw = value === undefined || value === null ? '' : String(value);
  let unsafe = false;
  for (const char of raw) {
    if (!encodable(char)) {
      unsafe = true;
      break;
    }
  }
  if (!unsafe) return raw;
  return [...raw].map(foldChar).join('');
}
