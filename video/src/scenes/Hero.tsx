import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { colors, fontFamily, weight, radius } from '../theme';
import { DeviceFrame } from '../components/DeviceFrame';
import { entrance, popScale, riseY } from '../anim';
import { PANELS, PanelKey } from '../ui/mock';

export type HeroScreen = {
  panel: PanelKey; // stylised UI panel
  durationInFrames: number;
  caption?: string; // benefit callout
};

const BenefitCaption: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = entrance(frame, fps, { delay: 0.04, feel: 0.45 });
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 360 }}>
      <div
        style={{
          transform: `translateY(${riseY(p, 30)}px)`,
          opacity: interpolate(p, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }),
          background: colors.cta,
          color: colors.white,
          fontFamily,
          fontSize: 40,
          fontWeight: weight.medium,
          letterSpacing: '-0.5px',
          padding: '20px 40px',
          borderRadius: radius.full,
          boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
          maxWidth: 900,
          textAlign: 'center',
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

const FramedScreen: React.FC<{ panel: PanelKey }> = ({ panel }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const p = entrance(frame, fps, { feel: 0.8 });
  const enterScale = popScale(p, 0.9);
  const enterY = interpolate(p, [0, 1], [50, 0]);
  const opacity = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' });
  const push = interpolate(frame, [0, durationInFrames], [1.0, 1.06], { extrapolateRight: 'clamp' });
  const Panel = PANELS[panel];

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', perspective: 1700, opacity }}>
      <div
        style={{
          transform: `rotateX(6deg) scale(${enterScale * push}) translateY(${enterY}px)`,
          transformStyle: 'preserve-3d',
        }}
      >
        <DeviceFrame content={<Panel />} />
      </div>
    </AbsoluteFill>
  );
};

/**
 * Hero. Real wizard screenshots in sequence inside a tilted device frame with
 * per-screen push-in, benefit callouts, hard cuts, and spring-in entrances.
 * (The count-up timer is a global overlay in CertNowLaunch so it can run on
 * into the certificate reveal, where it locks at 2:47.)
 */
export const Hero: React.FC<{ screens: HeroScreen[] }> = ({ screens }) => {
  let acc = 0;
  const starts = screens.map((s) => {
    const start = acc;
    acc += s.durationInFrames;
    return start;
  });

  return (
    <AbsoluteFill style={{ background: colors.cta }}>
      <AbsoluteFill
        style={{ background: `radial-gradient(60% 40% at 50% 42%, ${colors.action}22 0%, rgba(0,0,0,0) 70%)` }}
      />
      {screens.map((s, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={s.durationInFrames}>
          <FramedScreen panel={s.panel} />
          {s.caption ? <BenefitCaption text={s.caption} /> : null}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
