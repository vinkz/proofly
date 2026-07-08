import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import './fonts'; // registers Inter (side-effect import)
import { ColdOpen, Row } from './scenes/ColdOpen';
import { FasterWay } from './scenes/FasterWay';
import { Hero, HeroScreen } from './scenes/Hero';
import { CertificateReveal } from './scenes/CertificateReveal';
import { LandlordLink } from './scenes/LandlordLink';
import { WhatsAppShare } from './scenes/WhatsAppShare';
import { Close } from './scenes/Close';
import { CountUpTimer } from './components/CountUpTimer';
import { Grain } from './components/Grain';
import { Vignette } from './components/Vignette';
import { SafeZone } from './components/SafeZone';
import { fontFamily } from './theme';

export type LaunchProps = {
  showSafeZones: boolean;
  grain: boolean;
  coldOpen: { audience: string; beat1: Row[]; beat2: Row[] };
  fasterWay: { pre: string; accent: string; post: string };
  hero: { screens: HeroScreen[] };
  certificate: { caption: string; accentWord?: string; image?: string };
  landlord: { caption: string; accentWord?: string };
  whatsapp: { landlord: string; incoming: string; filename: string; outgoing: string; caption: string; accentWord?: string };
  close: { wordmark: string; tagline: string; url: string };
};

// scene timings (30fps) — total 1115 frames ≈ 37s
export const TIMINGS = {
  coldOpen: { from: 0, dur: 90 },
  fasterWay: { from: 90, dur: 75 },
  hero: { from: 165, dur: 330 },
  certificate: { from: 495, dur: 165 },
  landlord: { from: 660, dur: 135 },
  whatsapp: { from: 795, dur: 165 },
  close: { from: 960, dur: 155 },
} as const;

// The count-up timer runs across the hero and locks at 2:47 as the CP12 reveals.
const TIMER_FROM = TIMINGS.hero.from;
const TIMER_DUR = TIMINGS.certificate.from + TIMINGS.certificate.dur - TIMINGS.hero.from;
const TIMER_LOCK = TIMINGS.certificate.from + 25 - TIMER_FROM;

export const CertNowLaunch: React.FC<LaunchProps> = (props) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#111111', fontFamily }}>
      <Sequence from={TIMINGS.coldOpen.from} durationInFrames={TIMINGS.coldOpen.dur}>
        <ColdOpen {...props.coldOpen} />
      </Sequence>
      <Sequence from={TIMINGS.fasterWay.from} durationInFrames={TIMINGS.fasterWay.dur}>
        <FasterWay {...props.fasterWay} />
      </Sequence>
      <Sequence from={TIMINGS.hero.from} durationInFrames={TIMINGS.hero.dur}>
        <Hero screens={props.hero.screens} />
      </Sequence>
      <Sequence from={TIMINGS.certificate.from} durationInFrames={TIMINGS.certificate.dur}>
        <CertificateReveal {...props.certificate} />
      </Sequence>
      <Sequence from={TIMINGS.landlord.from} durationInFrames={TIMINGS.landlord.dur}>
        <LandlordLink {...props.landlord} />
      </Sequence>
      <Sequence from={TIMINGS.whatsapp.from} durationInFrames={TIMINGS.whatsapp.dur}>
        <WhatsAppShare {...props.whatsapp} />
      </Sequence>
      <Sequence from={TIMINGS.close.from} durationInFrames={TIMINGS.close.dur}>
        <Close {...props.close} />
      </Sequence>

      {/* global count-up timer: hero → certificate lock at 2:47 */}
      <Sequence from={TIMER_FROM} durationInFrames={TIMER_DUR} layout="none">
        <TimerOverlay />
      </Sequence>

      {/* global overlays */}
      <Vignette strength={0.32} />
      <Grain enabled={props.grain} opacity={0.04} />
      <SafeZone show={props.showSafeZones} />
    </AbsoluteFill>
  );
};

const TimerOverlay: React.FC = () => {
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center' }}>
      <TimerInner />
    </AbsoluteFill>
  );
};

// small wrapper to read the sequence-local frame
const TimerInner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <CountUpTimer frame={frame} fps={fps} startFrame={0} lockFrame={TIMER_LOCK} />;
};
