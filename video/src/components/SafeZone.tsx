import { AbsoluteFill, useVideoConfig } from 'remotion';

/**
 * Toggleable safe-zone overlay for the Studio preview.
 * - Green box = middle 75% (all text + key UI must live inside this).
 * - Red bands = TikTok/Reels UI chrome: bottom ~250px, right ~120px.
 * Driven by the `showSafeZones` prop on the composition (default off so it
 * never appears in a render).
 */
export const SafeZone: React.FC<{ show: boolean }> = ({ show }) => {
  const { width, height } = useVideoConfig();
  if (!show) return null;

  const marginX = width * 0.125; // middle 75%
  const marginY = height * 0.125;

  const band: React.CSSProperties = {
    position: 'absolute',
    background: 'rgba(220, 40, 40, 0.16)',
    border: '1px solid rgba(220,40,40,0.5)',
  };

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 9999 }}>
      {/* middle-75% safe box */}
      <div
        style={{
          position: 'absolute',
          left: marginX,
          top: marginY,
          right: marginX,
          bottom: marginY,
          border: '2px dashed rgba(34, 193, 122, 0.9)',
          borderRadius: 8,
        }}
      />
      {/* TikTok bottom chrome (~250px) */}
      <div style={{ ...band, left: 0, right: 0, bottom: 0, height: 250 }} />
      {/* TikTok right rail (~120px) */}
      <div style={{ ...band, top: 0, bottom: 0, right: 0, width: 120 }} />
      <div
        style={{
          position: 'absolute',
          left: marginX + 8,
          top: marginY + 6,
          color: 'rgba(34,193,122,0.95)',
          font: '500 20px Inter, sans-serif',
        }}
      >
        safe · middle 75%
      </div>
    </AbsoluteFill>
  );
};
