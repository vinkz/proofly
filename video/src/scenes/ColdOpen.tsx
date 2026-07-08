import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { colors, fontFamily, weight } from '../theme';
import { entrance, riseY } from '../anim';

export type Row = { t: string; size: number; hero?: boolean; accent?: boolean };

/**
 * 0–2.4s cold open — a single page. An eyebrow names the audience (UK gas
 * engineers) and the pain sits under it ("40 minutes per CP12"). Frame 1 — the
 * thumbnail — makes it immediately obvious who this is for, and is NOT black.
 */
export const ColdOpen: React.FC<{ audience: string; rows: Row[] }> = ({ audience, rows }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = entrance(frame, fps, { feel: 0.65 });
  const y = riseY(p, 30);
  const scale = interpolate(p, [0, 1], [1.05, 1]);

  return (
    <AbsoluteFill style={{ background: colors.cta, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ textAlign: 'center', fontFamily, lineHeight: 0.96, transform: `translateY(${y}px) scale(${scale})` }}>
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
          {audience}
        </div>
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              fontSize: r.size,
              fontWeight: r.hero ? weight.wordmark : weight.medium,
              letterSpacing: r.hero ? '-4px' : '-1px',
              color: r.accent ? colors.action : colors.white,
              opacity: r.hero ? 1 : 0.82,
              marginTop: r.hero ? 0 : 8,
            }}
          >
            {r.t}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
