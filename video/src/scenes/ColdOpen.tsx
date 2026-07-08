import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { colors, fontFamily, weight } from '../theme';
import { entrance, riseY } from '../anim';

export type Row = { t: string; size: number; hero?: boolean; accent?: boolean };

/**
 * 0–3s cold open. Kinetic type, hard cuts, white on the dark shade. An eyebrow
 * names the audience up front (UK gas engineers), so frame 1 — the thumbnail —
 * makes it immediately obvious who this is for. Frame 1 is NOT black.
 */
const Beat: React.FC<{ rows: Row[]; eyebrow?: string }> = ({ rows, eyebrow }) => {
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
        {eyebrow ? (
          <div
            style={{
              fontSize: 40,
              fontWeight: weight.medium,
              textTransform: 'uppercase',
              letterSpacing: '4px',
              color: colors.action,
              marginBottom: 34,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
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

export const ColdOpen: React.FC<{ audience: string; beat1: Row[]; beat2: Row[]; cutFrame?: number }> = ({
  audience,
  beat1,
  beat2,
  cutFrame = 48,
}) => (
  <AbsoluteFill style={{ background: colors.cta }}>
    <Sequence durationInFrames={cutFrame} layout="none">
      <Beat rows={beat1} eyebrow={audience} />
    </Sequence>
    <Sequence from={cutFrame} layout="none">
      <Beat rows={beat2} />
    </Sequence>
  </AbsoluteFill>
);
