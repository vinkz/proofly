import React from 'react';
import { Composition } from 'remotion';
import { CertNowLaunch, LaunchProps } from './CertNowLaunch';

const FPS = 30;
const TOTAL = 1077; // ~36s

// All copy is prop-driven so variants are possible later. Assets are the real
// captured production screenshots in public/assets.
const defaultProps: LaunchProps = {
  showSafeZones: false,
  grain: true,
  coldOpen: {
    audience: 'For UK gas engineers',
    rows: [
      { t: '40', size: 380, hero: true },
      { t: 'minutes per CP12.', size: 100 },
    ],
  },
  fasterWay: { pre: 'There should be a', accent: 'faster', post: 'way.' },
  hero: {
    screens: [
      { panel: 'newJob', durationInFrames: 120, caption: 'Reuse saved details, or ask the landlord' },
      { panel: 'clientReuse', durationInFrames: 100, caption: 'Auto-filled from the last visit' },
      { panel: 'appliance', durationInFrames: 110, caption: 'Appliances in seconds' },
    ],
  },
  landlord: { caption: 'No chasing landlords. Ever.', accentWord: 'Ever' },
  whatsapp: {
    landlord: 'Mike Brown',
    incoming: 'Hi, do you have the gas certificate for 22 Oak Street?',
    filename: 'CP12 – 22 Oak Street.pdf',
    outgoing: "Here's your CP12 — all done.",
    caption: 'Send it in a tap.',
    accentWord: 'tap',
  },
  certificate: { caption: 'A proper CP12, on the spot.', accentWord: 'CP12', image: 'cp12-page1.png' }, // real CP12 PDF page 1
  close: { wordmark: 'certnow', tagline: 'Done before you leave the driveway.', url: 'certnow.uk' },
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="CertNowLaunch"
      component={CertNowLaunch}
      durationInFrames={TOTAL}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={defaultProps}
    />
    {/* Same video with the safe-zone overlay on, for checking margins in Studio. */}
    <Composition
      id="CertNowLaunch-SafeZones"
      component={CertNowLaunch}
      durationInFrames={TOTAL}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ ...defaultProps, showSafeZones: true, grain: false }}
    />
  </>
);
