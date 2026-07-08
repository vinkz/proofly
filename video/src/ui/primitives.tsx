/**
 * Placeholder UI primitives, styled strictly from the CertNow design tokens.
 * These are STAND-INS for real app screenshots (which are auth-gated and could
 * not be captured in this environment). They are NOT imported app components —
 * they're token-faithful mocks living entirely inside /video so the composition
 * renders end-to-end today. Drop real PNGs into public/assets and flip
 * `useRealScreenshots` to replace them without touching any scene.
 */
import React from 'react';
import { colors, radius, fontFamily, weight } from '../theme';

export const PhoneScreen: React.FC<{ children: React.ReactNode; bg?: string }> = ({
  children,
  bg = colors.backgroundSecondary,
}) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      background: bg,
      fontFamily,
      color: colors.textPrimary,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}
  >
    {children}
  </div>
);

export const AppHeader: React.FC<{ title: string; right?: React.ReactNode }> = ({ title, right }) => (
  <div
    style={{
      height: 96,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 34px',
      background: colors.backgroundPrimary,
      borderBottom: `0.5px solid ${colors.borderTertiary}`,
    }}
  >
    <span style={{ fontSize: 30, fontWeight: weight.wordmark, letterSpacing: '-0.5px' }}>
      cert<span style={{ color: colors.action }}>now</span>
    </span>
    <span style={{ fontSize: 22, color: colors.textSecondary, fontWeight: weight.medium }}>{title}</span>
    <div style={{ width: 40, textAlign: 'right' }}>{right}</div>
  </div>
);

export const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: 18,
      textTransform: 'uppercase',
      letterSpacing: '2.4px',
      color: colors.textEyebrow,
      fontWeight: weight.medium,
      marginBottom: 14,
    }}
  >
    {children}
  </div>
);

export const StepDots: React.FC<{ total: number; active: number; labels?: string[] }> = ({
  total,
  active,
  labels,
}) => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 30 }}>
    {Array.from({ length: total }).map((_, i) => (
      <React.Fragment key={i}>
        <div
          style={{
            height: 10,
            flex: 1,
            borderRadius: radius.full,
            background: i <= active ? colors.action : colors.borderSecondary,
          }}
        />
      </React.Fragment>
    ))}
    {labels && (
      <span style={{ fontSize: 20, color: colors.textTertiary, marginLeft: 8, whiteSpace: 'nowrap' }}>
        {labels[active]}
      </span>
    )}
  </div>
);

export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      borderRadius: radius.card,
      border: `0.5px solid ${colors.borderTertiary}`,
      background: colors.backgroundPrimary,
      padding: 26,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Field: React.FC<{ label: string; value?: string; placeholder?: string; filled?: boolean }> = ({
  label,
  value,
  placeholder,
  filled,
}) => (
  <div style={{ marginBottom: 22 }}>
    <div style={{ fontSize: 19, color: colors.textSecondary, marginBottom: 10, fontWeight: weight.medium }}>{label}</div>
    <div
      style={{
        height: 68,
        borderRadius: radius.banner,
        border: `1px solid ${filled ? colors.borderPrimary : colors.borderSecondary}`,
        background: colors.backgroundPrimary,
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        fontSize: 24,
        color: filled ? colors.textPrimary : colors.textTertiary,
        fontWeight: filled ? weight.medium : weight.regular,
      }}
    >
      {filled ? value : placeholder}
    </div>
  </div>
);

export const Chip: React.FC<{ children: React.ReactNode; selected?: boolean }> = ({ children, selected }) => (
  <div
    style={{
      height: 62,
      padding: '0 28px',
      borderRadius: radius.full,
      display: 'flex',
      alignItems: 'center',
      fontSize: 22,
      fontWeight: weight.medium,
      border: `1px solid ${selected ? colors.action : colors.borderPrimary}`,
      background: selected ? colors.actionBg : colors.backgroundPrimary,
      color: selected ? colors.action : colors.textSecondary,
    }}
  >
    {children}
  </div>
);

export type PillTone = 'action' | 'amber' | 'red' | 'blue' | 'muted';
const pillMap: Record<PillTone, { bg: string; fg: string }> = {
  action: { bg: colors.actionBg, fg: colors.action },
  amber: { bg: colors.amberBg, fg: colors.amber },
  red: { bg: colors.redBg, fg: colors.red },
  blue: { bg: colors.blueBg, fg: colors.blue },
  muted: { bg: colors.backgroundTertiary, fg: colors.textSecondary },
};

export const Pill: React.FC<{ tone: PillTone; children: React.ReactNode }> = ({ tone, children }) => {
  const c = pillMap[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        borderRadius: radius.full,
        padding: '8px 18px',
        fontSize: 19,
        fontWeight: weight.medium,
        background: c.bg,
        color: c.fg,
      }}
    >
      <span style={{ width: 12, height: 12, borderRadius: radius.full, background: c.fg }} />
      {children}
    </span>
  );
};

export const CtaButton: React.FC<{ children: React.ReactNode; tone?: 'cta' | 'action'; disabled?: boolean }> = ({
  children,
  tone = 'cta',
  disabled,
}) => (
  <div
    style={{
      height: 84,
      borderRadius: radius.full,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 26,
      fontWeight: weight.medium,
      background: disabled ? colors.backgroundTertiary : tone === 'action' ? colors.action : colors.cta,
      color: disabled ? colors.textTertiary : tone === 'action' ? colors.actionFg : colors.ctaFg,
    }}
  >
    {children}
  </div>
);
