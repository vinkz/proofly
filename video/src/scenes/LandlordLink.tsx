import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { colors, fontFamily, weight } from '../theme';
import { DeviceFrame } from '../components/DeviceFrame';
import { LandlordVault } from '../ui/mock';
import { entrance, popScale, riseY } from '../anim';

/**
 * 17–24s. Landlord property vault (stylised UI) in a tilted device frame, with
 * a caption over it. Text stays inside the middle-75% safe zone.
 */
export const LandlordLink: React.FC<{ caption: string; accentWord?: string }> = ({ caption, accentWord }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const dev = entrance(frame, fps, { feel: 0.9 });
  const devScale = popScale(dev, 0.92);
  const drift = interpolate(frame, [0, 210], [0, -26]);
  const cap = entrance(frame, fps, { delay: 0.25, feel: 0.8 });

  return (
    <AbsoluteFill style={{ background: colors.cta }}>
      <AbsoluteFill style={{ background: `radial-gradient(55% 40% at 50% 60%, ${colors.action}22 0%, rgba(0,0,0,0) 70%)` }} />
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', perspective: 1700, paddingBottom: 150 }}>
        <div style={{ transform: `rotateX(6deg) rotateZ(-2deg) scale(${devScale}) translateY(${drift}px)` }}>
          <DeviceFrame content={<LandlordVault />} width={600} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: 250 }}>
        <div
          style={{
            transform: `translateY(${riseY(cap, 40)}px)`,
            opacity: interpolate(cap, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }),
            fontFamily,
            fontSize: 104,
            fontWeight: weight.medium,
            letterSpacing: '-2px',
            lineHeight: 1.04,
            textAlign: 'center',
            maxWidth: 820,
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
