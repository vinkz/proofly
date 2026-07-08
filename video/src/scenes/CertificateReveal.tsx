import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { colors, fontFamily, weight, radius } from '../theme';
import { entrance, popScale, riseY } from '../anim';

/**
 * Reveal of the output CP12 (Landlord Gas Safety Record). If `image` is set
 * (a real PDF page dropped into public/assets), it renders that; otherwise it
 * renders a faithful recreation from the real job data. Swap by setting `image`.
 */

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, padding: '10px 0', borderBottom: `1px solid ${colors.borderTertiary}` }}>
    <span style={{ color: colors.textTertiary, fontSize: 20 }}>{label}</span>
    <span style={{ color: colors.textPrimary, fontSize: 20, fontWeight: weight.medium, textAlign: 'right' }}>{value}</span>
  </div>
);

const CP12Doc: React.FC = () => (
  <div style={{ width: 760, height: 1074, background: '#fff', borderRadius: radius.banner, overflow: 'hidden', fontFamily, color: colors.textPrimary, display: 'flex', flexDirection: 'column' }}>
    {/* header band */}
    <div style={{ background: colors.action, color: '#fff', padding: '26px 34px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 30, fontWeight: weight.medium }}>Landlord Gas Safety Record</div>
        <div style={{ fontSize: 20, opacity: 0.9, marginTop: 2 }}>CP12 · Reg 36 Gas Safety (I&U)</div>
      </div>
      <div style={{ fontSize: 34, fontWeight: weight.wordmark }}>certnow</div>
    </div>
    <div style={{ padding: '26px 34px', display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
      <div style={{ display: 'flex', gap: 30 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.textEyebrow, marginBottom: 8 }}>Engineer</div>
          <Row label="Business" value="Jones Gas Services" />
          <Row label="Engineer" value="Alex Jones" />
          <Row label="Gas Safe" value="654321" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.textEyebrow, marginBottom: 8 }}>Property</div>
          <Row label="Address" value="22 Oak Street" />
          <Row label="Postcode" value="London SW1 1AA" />
          <Row label="Landlord" value="Mike Brown" />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.textEyebrow, marginBottom: 8 }}>Appliance</div>
        <div style={{ display: 'flex', gap: 12, fontSize: 18, color: colors.textSecondary, marginBottom: 6 }}>
          <span style={{ flex: 2, fontWeight: weight.medium, color: colors.textPrimary }}>Vaillant Combi boiler</span>
          <span style={{ flex: 1 }}>Kitchen</span>
          <span style={{ flex: 1 }}>ecoTEC plus</span>
        </div>
        <Row label="Flue / ventilation" value="Pass" />
        <Row label="Operating pressure" value="20.1 mbar" />
        <Row label="Safety devices" value="Pass" />
        <Row label="Combustion analysis" value="Pass" />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, background: colors.actionBg, color: colors.action, borderRadius: radius.banner, padding: '14px 18px', fontSize: 20, fontWeight: weight.medium }}>Appliance safe to use</div>
        <div style={{ flex: 1, background: colors.backgroundTertiary, borderRadius: radius.banner, padding: '14px 18px', fontSize: 20 }}>Next check: 7 Jul 2027</div>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: `1px solid ${colors.borderSecondary}`, paddingTop: 16 }}>
        <div>
          <div style={{ fontSize: 16, color: colors.textTertiary }}>Engineer signature</div>
          <div style={{ fontFamily: 'cursive', fontSize: 40, marginTop: 4 }}>A. Jones</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 18, color: colors.textSecondary }}>Issued 7 Jul 2026</div>
      </div>
    </div>
  </div>
);

export const CertificateReveal: React.FC<{ caption: string; accentWord?: string; image?: string }> = ({
  caption,
  accentWord,
  image,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const rev = entrance(frame, fps, { feel: 1.0 });
  const rot = interpolate(rev, [0, 1], [8, 0]);
  const push = interpolate(frame, [0, durationInFrames], [1, 1.07], { extrapolateRight: 'clamp' });
  const scale = popScale(rev, 0.86) * push;
  const cap = entrance(frame, fps, { delay: 0.35, feel: 0.8 });
  // light sweep across the document
  const sweep = interpolate(frame, [Math.round(1.2 * fps), Math.round(2.4 * fps)], [-100, 200], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: colors.cta }}>
      <AbsoluteFill style={{ background: `radial-gradient(55% 40% at 50% 55%, ${colors.action}22 0%, rgba(0,0,0,0) 70%)` }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', perspective: 1800, paddingTop: 180 }}>
        <div style={{ transform: `rotateX(${rot}deg) rotateZ(-1.5deg) scale(${scale})`, boxShadow: '0 50px 100px rgba(0,0,0,0.55)', borderRadius: radius.banner, position: 'relative', overflow: 'hidden' }}>
          {image ? (
            <Img src={staticFile(`assets/${image}`)} style={{ width: 1020, borderRadius: radius.banner, display: 'block' }} />
          ) : (
            <CP12Doc />
          )}
          {/* light sweep */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${sweep}%`, width: '30%', background: 'linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0) 100%)', pointerEvents: 'none' }} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: 220 }}>
        <div
          style={{
            transform: `translateY(${riseY(cap, 40)}px)`,
            opacity: interpolate(cap, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }),
            fontFamily,
            fontSize: 96,
            fontWeight: weight.medium,
            letterSpacing: '-2px',
            textAlign: 'center',
            maxWidth: 840,
          }}
        >
          {caption.split(' ').map((w, i) => {
            const isAccent = accentWord && w.replace(/[.,]/g, '') === accentWord;
            return (
              <span key={i} style={{ color: isAccent ? colors.action : colors.white }}>
                {w}{' '}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
