import React from 'react';
import { Img, staticFile } from 'remotion';
import { colors, radius } from '../theme';

const PANEL_W = 640; // authoring width of stylised panels (src/ui/mock.tsx)

/**
 * A phone device frame. Renders EITHER a stylised UI panel (`content`, authored
 * at PANEL_W and sized to its own content height, like the landing-page mock)
 * or a screenshot image (`src`, fixed phone aspect). Parent applies tilt/push-in.
 */
export const DeviceFrame: React.FC<{
  content?: React.ReactNode; // stylised panel (preferred) — content-height
  src?: string; // OR a screenshot filename in public/assets
  width?: number; // used for screenshot mode
  bare?: boolean;
  focusTop?: number; // screenshot-only: show top fraction
  children?: React.ReactNode; // overlays (e.g. timer)
}> = ({ content, src, width = 660, bare = false, focusTop, children }) => {
  const bezel = bare ? 0 : 20;

  // Stylised panel: device wraps to the panel's natural height (no dead space).
  if (content) {
    return (
      <div style={{ width: PANEL_W + bezel * 2, borderRadius: 52, background: colors.cta, padding: bezel, boxShadow: '0 40px 90px rgba(0,0,0,0.45), 0 8px 20px rgba(0,0,0,0.3)' }}>
        <div style={{ width: PANEL_W, borderRadius: 38, overflow: 'hidden', background: colors.white, position: 'relative' }}>
          {content}
          {children}
        </div>
      </div>
    );
  }

  // Screenshot mode: fixed phone aspect.
  const screenW = width;
  const screenH = Math.round((screenW * 2850) / 1320);
  const imgH = focusTop ? Math.round(screenH / focusTop) : screenH;
  return (
    <div style={{ width: screenW + bezel * 2, height: screenH + bezel * 2, borderRadius: bare ? radius.card : 56, background: colors.cta, padding: bezel, boxShadow: bare ? 'none' : '0 40px 90px rgba(0,0,0,0.45), 0 8px 20px rgba(0,0,0,0.3)', position: 'relative' }}>
      <div style={{ width: screenW, height: screenH, borderRadius: bare ? radius.card : 40, overflow: 'hidden', background: colors.white, position: 'relative' }}>
        <Img src={staticFile(`assets/${src}`)} style={{ width: screenW, height: imgH, objectFit: 'cover', objectPosition: 'top' }} />
        {children}
      </div>
    </div>
  );
};
