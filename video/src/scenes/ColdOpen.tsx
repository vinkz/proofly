import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { colors, fontFamily, weight } from '../theme';
import { entrance, riseY } from '../anim';

export type Row = { t: string; size: number; hero?: boolean; accent?: boolean };

/**
 * 0–2.5s cold open. Kinetic type, hard cuts, white on the dark shade.
 * Frame 1 is NOT black — the first beat is on screen at frame 0 (thumbnail frame).
 */
const Beat: React.FC<{ rows: Row[] }> = ({ rows }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = entrance(frame, fps, { feel: 0.65 });
  const y = riseY(p, 30);
  const scale = interpolate(p, [0, 1], [1.05, 1]);

  return (
    <AbsoluteFill
      style={{ justifyContent: 'center', alignItems: 'center', transform: `translateY(${y}px) scale(${scale})` }}
    >
      <div style={{ textAlign: 'center', fontFamily, lineHeight: 0.94 }}>
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              fontSize: r.size,
              fontWeight: r.hero ? weight.wordmark : weight.medium,
              letterSpacing: r.hero ? '-4px' : '-1px',
              color: r.accent ? colors.action : colors.white,
              opacity: r.hero ? 1 : 0.82,
            }}
          >
            {r.t}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const ColdOpen: React.FC<{ beat1: Row[]; beat2: Row[]; cutFrame?: number }> = ({
  beat1,
  beat2,
  cutFrame = 40,
}) => (
  <AbsoluteFill style={{ background: colors.cta }}>
    <Sequence durationInFrames={cutFrame} layout="none">
      <Beat rows={beat1} />
    </Sequence>
    <Sequence from={cutFrame} layout="none">
      <Beat rows={beat2} />
    </Sequence>
  </AbsoluteFill>
);
