/**
 * CertNow video theme — mirrors DESIGN_TOKENS.md + src/app/globals.css exactly.
 *
 * NO new colours, fonts, or radii may be introduced anywhere in this project.
 * Every value below is copied verbatim from the app's light-mode token set
 * (the UI screenshots are captured in light theme). The cold-open uses the
 * `cta` dark shade (#111111) as its "dark shade" background per the brief.
 */

export const colors = {
  // Primary green — links, accents, active tab, icon tiles, stats
  action: '#1a7a52',
  actionBg: '#edf7f2',
  actionFg: '#ffffff',
  actionRing: 'rgba(26, 122, 82, 0.12)',

  // Dark CTA shade — used as the cold-open / close background ("our dark shade")
  cta: '#111111',
  ctaFg: '#ffffff',

  // Status colours (dashboard rows: green / amber / red)
  amber: '#ba7517',
  amberBg: '#faeeda',
  red: '#a32d2d',
  redBg: '#fcebeb',
  blue: '#185fa5',
  blueBg: '#e6f1fb',

  // Backgrounds
  backgroundPrimary: '#ffffff',
  backgroundSecondary: '#fafafa',
  backgroundTertiary: '#f5f5f5',

  // Text
  textPrimary: '#111111',
  textSecondary: '#555555',
  textTertiary: '#8a8a8a',
  textEyebrow: '#6b6b6b',

  // Borders (hairlines)
  borderPrimary: '#d4d4d4',
  borderSecondary: '#e5e5e5',
  borderTertiary: '#ededed',

  white: '#ffffff',
} as const;

/** Radius values in use — no others allowed. */
export const radius = {
  card: 16, // cards & tables
  tile: 12, // icon tiles
  banner: 8, // small banners / inline code
  full: 9999, // pills, badges, buttons
} as const;

/** Font — Inter, matching `font-sans` -> Inter, system-ui, sans-serif. */
export const fontFamily = 'Inter, system-ui, sans-serif';

/**
 * Weights — regular (400) body, medium (500) headings/emphasis, extrabold (800)
 * ONLY for the frozen `certnow` wordmark.
 */
export const weight = {
  regular: 400,
  medium: 500,
  wordmark: 800,
} as const;

/** Marketing type scale (px), from DESIGN_TOKENS.md. */
export const type = {
  h1: 30,
  h2: 24,
  cardTitle: 15,
  bodyLead: 15,
  bodyCard: 13,
  button: 15,
  meta: 12,
  eyebrow: 11,
} as const;
