import { AbsoluteFill, useCurrentFrame, random } from 'remotion';

/**
 * Subtle animated film grain (~4% opacity). Procedural via SVG feTurbulence,
 * reseeded per frame so it shimmers. Pre-authorised fallback: if grain slows
 * the render, set `enabled=false` on the composition props to drop it.
 */
export const Grain: React.FC<{ enabled: boolean; opacity?: number }> = ({ enabled, opacity = 0.04 }) => {
  const frame = useCurrentFrame();
  if (!enabled) return null;
  // Re-seed a few times per second (not every frame) to keep it filmic, not buzzy.
  const seed = Math.floor(random(`grain-${Math.floor(frame / 2)}`) * 1000);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'overlay', opacity }}>
      <svg width="100%" height="100%">
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};
