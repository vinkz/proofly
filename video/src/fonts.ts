/**
 * Loads Inter — the app's `font-sans` family. The app itself loads no webfont
 * (it resolves Inter -> system-ui at runtime); for deterministic rendering we
 * load Inter explicitly so every render is pixel-identical. Same family, no drift.
 */
import { loadFont } from '@remotion/google-fonts/Inter';

// Only the weights the design system uses: 400 body, 500 medium, 800 wordmark.
export const { fontFamily: interFamily } = loadFont('normal', {
  weights: ['400', '500', '800'],
  subsets: ['latin'],
});
