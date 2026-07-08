import React from 'react';
import { interpolate, spring } from 'remotion';
import { colors, radius, fontFamily, weight } from '../theme';

const fmt = (totalSeconds: number) => {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
};

/**
 * Counts up from 0:00 and locks at 2:47 (=167s) at `lockFrame`, with a
 * spring "snap" scale beat on lock. `frame` is the hero-scene-local frame.
 */
export const CountUpTimer: React.FC<{
  frame: number;
  fps: number;
  startFrame: number;
  lockFrame: number;
}> = ({ frame, fps, startFrame, lockFrame }) => {
  const locked = frame >= lockFrame;
  const seconds = interpolate(frame, [startFrame, lockFrame], [0, 167], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // snap-scale beat right when it locks
  const beat = spring({ frame: frame - lockFrame, fps, config: { damping: 9, mass: 0.6, stiffness: 180 } });
  const scale = locked ? interpolate(beat, [0, 1], [1.35, 1]) : 1;

  return (
    <div
      style={{
        position: 'absolute',
        top: 34,
        left: '50%',
        transform: `translateX(-50%) scale(${scale})`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 26px',
        borderRadius: radius.full,
        background: locked ? colors.action : 'rgba(17,17,17,0.86)',
        color: colors.white,
        fontFamily,
        fontWeight: weight.medium,
        fontSize: 34,
        letterSpacing: '0.5px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: radius.full,
          background: locked ? colors.white : '#ff5a5a',
        }}
      />
      {locked ? fmt(167) : fmt(seconds)}
    </div>
  );
};
