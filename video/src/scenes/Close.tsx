import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { colors, fontFamily, weight } from '../theme';
import { entrance, popScale, riseY } from '../anim';

/**
 * 30–35s close. Wordmark springs in (FROZEN styling — solid extrabold, not
 * recoloured), tagline + URL below, a pulsing accent glow, then a cut to black.
 */
export const Close: React.FC<{ wordmark: string; tagline: string; url: string }> = ({
  wordmark,
  tagline,
  url,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const mark = entrance(frame, fps, { feel: 0.9 });
  const markScale = popScale(mark, 0.8);
  const tag = entrance(frame, fps, { delay: 0.4, feel: 0.8 });
  const urlP = entrance(frame, fps, { delay: 0.62, feel: 0.8 });

  // pulsing brand glow
  const pulse = 0.5 + 0.5 * Math.sin((frame / fps) * Math.PI * 1.4);
  const glow = interpolate(pulse, [0, 1], [0.1, 0.32]);

  // hard cut to black over the final 8 frames
  const toBlack = interpolate(frame, [durationInFrames - 8, durationInFrames - 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: colors.cta, justifyContent: 'center', alignItems: 'center' }}>
      <AbsoluteFill
        style={{ background: `radial-gradient(45% 30% at 50% 46%, ${colors.action}${Math.round(glow * 255).toString(16).padStart(2, '0')} 0%, rgba(0,0,0,0) 70%)` }}
      />
      <div style={{ textAlign: 'center', fontFamily }}>
        <div
          style={{
            fontSize: 200,
            fontWeight: weight.wordmark,
            letterSpacing: '-6px',
            color: colors.white,
            transform: `scale(${markScale})`,
            opacity: interpolate(mark, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          {wordmark}
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 74,
            fontWeight: weight.medium,
            letterSpacing: '-1px',
            color: colors.white,
            maxWidth: 860,
            lineHeight: 1.08,
            transform: `translateY(${riseY(tag, 34)}px)`,
            opacity: interpolate(tag, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          {tagline}
        </div>
        <div
          style={{
            marginTop: 44,
            fontSize: 46,
            fontWeight: weight.medium,
            color: colors.action,
            letterSpacing: '0.5px',
            transform: `translateY(${riseY(urlP, 28)}px)`,
            opacity: interpolate(urlP, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          {url}
        </div>
      </div>
      <AbsoluteFill style={{ background: '#000', opacity: toBlack }} />
    </AbsoluteFill>
  );
};
