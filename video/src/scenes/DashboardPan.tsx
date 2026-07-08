import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { colors, fontFamily, weight } from '../theme';
import { DeviceFrame } from '../components/DeviceFrame';
import { PropertyList } from '../ui/mock';
import { entrance, popScale, riseY } from '../anim';

/**
 * 24–30s. Dashboard property list (stylised) as a tilted plane with a slow
 * push-in. Green/amber/red status rows are visible. Caption in the bottom safe area.
 */
export const DashboardPan: React.FC<{ caption: string; accentWord?: string }> = ({ caption, accentWord }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = entrance(frame, fps, { feel: 0.9 });
  const scale = popScale(enter, 0.9);
  const push = interpolate(frame, [0, durationInFrames], [1, 1.06], { extrapolateRight: 'clamp' });
  const drift = interpolate(frame, [0, durationInFrames], [10, -10]);
  const cap = entrance(frame, fps, { delay: 0.3, feel: 0.8 });

  return (
    <AbsoluteFill style={{ background: colors.cta, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `radial-gradient(60% 40% at 50% 45%, ${colors.action}22 0%, rgba(0,0,0,0) 70%)` }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', perspective: 2000 }}>
        <div style={{ transform: `rotateX(8deg) rotateZ(-3deg) scale(${scale * push}) translateY(${drift}px)` }}>
          <DeviceFrame content={<PropertyList />} width={640} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(to top, rgba(17,17,17,0.92) 0%, rgba(17,17,17,0) 32%)' }} />
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 300 }}>
        <div
          style={{
            transform: `translateY(${riseY(cap, 40)}px)`,
            opacity: interpolate(cap, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }),
            fontFamily,
            fontSize: 100,
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
