import type { Metadata } from 'next';

import { GasRateClient } from './gas-rate-client';

export const metadata: Metadata = {
  title: 'Gas rate calculator',
};

export default function GasRatePage() {
  return <GasRateClient />;
}
