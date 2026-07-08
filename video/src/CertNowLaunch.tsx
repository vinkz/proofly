import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import './fonts'; // registers Inter (side-effect import)
import { ColdOpen, Row } from './scenes/ColdOpen';
import { FasterWay } from './scenes/FasterWay';
import { Hero, HeroScreen } from './scenes/Hero';
import { LandlordLink } from './scenes/LandlordLink';
import { WhatsAppShare } from './scenes/WhatsAppShare';
import { CertificateReveal } from './scenes/CertificateReveal';
import { DashboardPan } from './scenes/DashboardPan';
import { Close } from './scenes/Close';
import { Grain } from './components/Grain';
import { Vignette } from './components/Vignette';
import { SafeZone } from './components/SafeZone';
import { fontFamily } from './theme';

export type LaunchProps = {
  showSafeZones: boolean;
  grain: boolean;
  coldOpen: { beat1: Row[]; beat2: Row[] };
  fasterWay: { pre: string; accent: string; post: string };
  hero: { screens: HeroScreen[] };
  landlord: { caption: string; accentWord?: string };
  whatsapp: { landlord: string; incoming: string; filename: string; outgoing: string; caption: string; accentWord?: string };
  certificate: { caption: string; accentWord?: string; image?: string };
  dashboard: { caption: string; accentWord?: string };
  close: { wordmark: string; tagline: string; url: string };
};

// scene timings (30fps) — total 1365 frames = 45.5s
export const TIMINGS = {
  coldOpen: { from: 0, dur: 75 },
  fasterWay: { from: 75, dur: 75 },
  hero: { from: 150, dur: 465 },
  landlord: { from: 615, dur: 140 },
  whatsapp: { from: 755, dur: 165 },
  certificate: { from: 920, dur: 150 },
  dashboard: { from: 1070, dur: 140 },
  close: { from: 1210, dur: 155 },
} as const;

export const CertNowLaunch: React.FC<LaunchProps> = (props) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#111111', fontFamily }}>
      <Sequence from={TIMINGS.coldOpen.from} durationInFrames={TIMINGS.coldOpen.dur}>
        <ColdOpen beat1={props.coldOpen.beat1} beat2={props.coldOpen.beat2} />
      </Sequence>
      <Sequence from={TIMINGS.fasterWay.from} durationInFrames={TIMINGS.fasterWay.dur}>
        <FasterWay {...props.fasterWay} />
      </Sequence>
      <Sequence from={TIMINGS.hero.from} durationInFrames={TIMINGS.hero.dur}>
        <Hero screens={props.hero.screens} />
      </Sequence>
      <Sequence from={TIMINGS.landlord.from} durationInFrames={TIMINGS.landlord.dur}>
        <LandlordLink {...props.landlord} />
      </Sequence>
      <Sequence from={TIMINGS.whatsapp.from} durationInFrames={TIMINGS.whatsapp.dur}>
        <WhatsAppShare {...props.whatsapp} />
      </Sequence>
      <Sequence from={TIMINGS.certificate.from} durationInFrames={TIMINGS.certificate.dur}>
        <CertificateReveal {...props.certificate} />
      </Sequence>
      <Sequence from={TIMINGS.dashboard.from} durationInFrames={TIMINGS.dashboard.dur}>
        <DashboardPan {...props.dashboard} />
      </Sequence>
      <Sequence from={TIMINGS.close.from} durationInFrames={TIMINGS.close.dur}>
        <Close {...props.close} />
      </Sequence>

      {/* global overlays */}
      <Vignette strength={0.32} />
      <Grain enabled={props.grain} opacity={0.04} />
      <SafeZone show={props.showSafeZones} />
    </AbsoluteFill>
  );
};
