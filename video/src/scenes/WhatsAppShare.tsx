import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { colors, fontFamily, weight, radius } from '../theme';
import { entrance, popScale, riseY } from '../anim';

/**
 * 2.5D "share the CP12 to the landlord via WhatsApp" beat — ILLUSTRATIVE share
 * (not a built-in integration). WhatsApp UI + mark are recreated here purely to
 * depict sharing; WhatsApp brand colours are used only inside this depiction.
 */

// Recreated WhatsApp glyph (green bubble + phone). Illustrative use.
const WhatsAppMark: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
    <circle cx="16" cy="16" r="16" fill="#25D366" />
    <path
      fill="#fff"
      d="M16 7.2c-4.86 0-8.8 3.94-8.8 8.8 0 1.55.41 3.05 1.18 4.37L7.2 24.8l4.55-1.19a8.77 8.77 0 0 0 4.25 1.08h.004c4.85 0 8.79-3.94 8.79-8.8 0-2.35-.915-4.56-2.576-6.22A8.74 8.74 0 0 0 16 7.2Zm5.16 12.44c-.22.62-1.29 1.18-1.77 1.22-.45.05-1.03.07-1.66-.10-.38-.12-.87-.28-1.5-.55-2.64-1.14-4.36-3.8-4.49-3.98-.13-.18-1.08-1.43-1.08-2.73 0-1.3.68-1.94.92-2.2.24-.27.53-.33.7-.33.18 0 .35 0 .5.008.16.007.38-.06.59.45.22.53.75 1.83.82 1.96.06.13.1.29.02.47-.09.18-.13.29-.26.44-.13.15-.28.34-.4.46-.13.13-.27.28-.11.55.16.27.7 1.16 1.51 1.88 1.04.93 1.92 1.22 2.19 1.35.27.13.43.11.59-.07.16-.18.68-.79.86-1.06.18-.27.36-.22.6-.13.24.09 1.54.73 1.8.86.27.13.44.2.5.31.07.11.07.64-.15 1.26Z"
    />
  </svg>
);

const Tick: React.FC<{ blue?: boolean }> = ({ blue }) => (
  <svg width={26} height={16} viewBox="0 0 26 16" aria-hidden>
    <path d="M2 8l4 4 8-9" fill="none" stroke={blue ? '#53BDEB' : '#8aa'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 12l8-9" fill="none" stroke={blue ? '#53BDEB' : '#8aa'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Phone: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const w = 560;
  const h = Math.round((w * 2850) / 1320);
  return (
    <div style={{ width: w + 40, height: h + 40, borderRadius: 56, background: colors.cta, padding: 20, boxShadow: '0 40px 90px rgba(0,0,0,0.45)' }}>
      <div style={{ width: w, height: h, borderRadius: 40, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily }}>
        {children}
      </div>
    </div>
  );
};

export const WhatsAppShare: React.FC<{
  landlord: string;
  incoming: string;
  filename: string;
  outgoing: string;
  caption: string;
  accentWord?: string;
}> = ({ landlord, incoming, filename, outgoing, caption, accentWord }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const dev = entrance(frame, fps, { feel: 0.9 });
  const send = entrance(frame, fps, { delay: 0.9, feel: 0.7 }); // doc bubble sends
  const ticks = interpolate(frame, [Math.round(2.1 * fps), Math.round(2.7 * fps)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cap = entrance(frame, fps, { delay: 0.3, feel: 0.8 });
  const initials = landlord.split(' ').map((s) => s[0]).join('').slice(0, 2);

  return (
    <AbsoluteFill style={{ background: colors.cta }}>
      <AbsoluteFill style={{ background: `radial-gradient(55% 45% at 50% 55%, #25D36622 0%, rgba(0,0,0,0) 70%)` }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', perspective: 1700 }}>
        <div style={{ transform: `rotateX(6deg) rotateZ(-2deg) scale(${popScale(dev, 0.92)})` }}>
          <Phone>
            {/* header */}
            <div style={{ background: '#075E54', color: '#fff', display: 'flex', alignItems: 'center', gap: 16, padding: '26px 24px' }}>
              <div style={{ fontSize: 34 }}>‹</div>
              <div style={{ width: 60, height: 60, borderRadius: radius.full, background: '#25D366', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: weight.medium }}>{initials}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 28, fontWeight: weight.medium }}>{landlord}</div>
                <div style={{ fontSize: 18, opacity: 0.85 }}>online</div>
              </div>
              <WhatsAppMark size={40} />
            </div>
            {/* chat */}
            <div style={{ flex: 1, background: '#ECE5DD', padding: 26, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* incoming */}
              <div style={{ alignSelf: 'flex-start', maxWidth: '80%', background: '#fff', borderRadius: 18, borderTopLeftRadius: 4, padding: '18px 22px', fontSize: 24, color: '#111', boxShadow: '0 1px 1px rgba(0,0,0,0.12)' }}>
                {incoming}
                <div style={{ fontSize: 16, color: '#999', textAlign: 'right', marginTop: 6 }}>09:14</div>
              </div>
              {/* outgoing document bubble (sends in) */}
              <div
                style={{
                  alignSelf: 'flex-end',
                  maxWidth: '82%',
                  transform: `translateY(${riseY(send, 60)}px) scale(${popScale(send, 0.9)})`,
                  opacity: interpolate(send, [0, 0.3], [0, 1], { extrapolateRight: 'clamp' }),
                }}
              >
                <div style={{ background: '#DCF8C6', borderRadius: 18, borderTopRightRadius: 4, padding: 16, boxShadow: '0 1px 1px rgba(0,0,0,0.12)' }}>
                  {/* document card */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#cdeeb8', borderRadius: 12, padding: 16 }}>
                    <div style={{ width: 58, height: 58, borderRadius: 10, background: colors.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: weight.medium }}>PDF</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 24, fontWeight: weight.medium, color: '#111' }}>{filename}</div>
                      <div style={{ fontSize: 18, color: '#555', marginTop: 4 }}>1 page · PDF</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 24, color: '#111', marginTop: 12 }}>{outgoing}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                    <span style={{ fontSize: 16, color: '#667' }}>09:15</span>
                    <span style={{ opacity: interpolate(ticks, [0, 0.2], [0, 1], { extrapolateRight: 'clamp' }) }}>
                      <Tick blue={ticks > 0.6} />
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {/* input */}
            <div style={{ background: '#F0F0F0', display: 'flex', alignItems: 'center', gap: 14, padding: 20 }}>
              <div style={{ flex: 1, height: 64, borderRadius: radius.full, background: '#fff', display: 'flex', alignItems: 'center', padding: '0 24px', fontSize: 22, color: '#999' }}>Message</div>
              <div style={{ width: 64, height: 64, borderRadius: radius.full, background: '#075E54', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={30} height={30} viewBox="0 0 24 24" aria-hidden><path fill="#fff" d="M2 21l21-9L2 3v7l15 2-15 2z" /></svg>
              </div>
            </div>
          </Phone>
        </div>
      </AbsoluteFill>
      {/* caption */}
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: 150 }}>
        <div
          style={{
            transform: `translateY(${riseY(cap, 40)}px)`,
            opacity: interpolate(cap, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }),
            fontFamily,
            fontSize: 86,
            fontWeight: weight.medium,
            letterSpacing: '-2px',
            lineHeight: 1.04,
            textAlign: 'center',
            maxWidth: 840,
          }}
        >
          {caption.split(' ').map((w, i) => {
            const isAccent = accentWord && w.replace(/[.,]/g, '') === accentWord;
            return (
              <span key={i} style={{ color: isAccent ? colors.action : colors.white }}>
                {w}{' '}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
