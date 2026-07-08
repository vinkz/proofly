/**
 * Shared motion language: spring easing with a slight overshoot on every
 * entrance, tuned to a 0.6–1.2s feel. Use these so all scenes move as one.
 */
import { spring, interpolate } from 'remotion';

/**
 * A springy 0->1 entrance progress with slight overshoot.
 * `feel` is the perceptual duration in seconds (0.6–1.2 typical).
 */
export const entrance = (
  frame: number,
  fps: number,
  { delay = 0, feel = 0.8, overshoot = true }: { delay?: number; feel?: number; overshoot?: boolean } = {},
) =>
  spring({
    frame: frame - delay * fps,
    fps,
    config: {
      // Lower damping => visible overshoot; higher => settle cleanly.
      damping: overshoot ? 12 : 200,
      mass: 0.9,
      stiffness: overshoot ? 120 : 100,
    },
    durationInFrames: Math.round(feel * fps),
  });

/** Map an entrance progress to a rise-and-settle translateY (px). */
export const riseY = (p: number, from = 60) => interpolate(p, [0, 1], [from, 0]);

/** Map an entrance progress to a scale that springs in from `from`. */
export const popScale = (p: number, from = 0.86) => interpolate(p, [0, 1], [from, 1]);

/** Clamp helper for opacity ramps. */
export const fade = (frame: number, [a, b]: [number, number]) =>
  interpolate(frame, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
