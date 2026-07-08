import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { colors, fontFamily, weight } from '../theme';
import { entrance, riseY } from '../anim';

/**
 * 2.5–5s. "There's a faster way." — accent colour on the emphasised word.
 * Words rise in sequence (kinetic), white on the dark shade.
 */
export const FasterWay: React.FC<{ pre: string; accent: string; post: string }> = ({ pre, accent, post }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = [
    { t: pre, delay: 0, accent: false },
    { t: accent, delay: 0.18, accent: true },
    { t: post, delay: 0.34, accent: false },
  ];

  return (
    <AbsoluteFill style={{ background: colors.cta, justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          fontFamily,
          fontSize: 116,
          fontWeight: weight.medium,
          letterSpacing: '-2px',
          lineHeight: 1.06,
          textAlign: 'center',
          maxWidth: 880,
          color: colors.white,
        }}
      >
        {words.map((w, i) => {
          const p = entrance(frame, fps, { delay: w.delay, feel: 0.7 });
          const y = riseY(p, 34);
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                margin: '0 14px',
                transform: `translateY(${y}px)`,
                opacity: interpolate(p, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' }),
                color: w.accent ? colors.action : colors.white,
                fontWeight: w.accent ? weight.wordmark : weight.medium,
              }}
            >
              {w.t}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
