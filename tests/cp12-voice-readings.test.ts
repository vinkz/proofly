import { describe, expect, it } from 'vitest';

import { parseCp12VoiceReadings } from '@/lib/cp12/voice-readings';

describe('parseCp12VoiceReadings', () => {
  it('parses core CP12 measurement fields from direct phrases', () => {
    const result = parseCp12VoiceReadings('working pressure 20 mbar heat input 24 kilowatts co ppm 8');

    expect(result.parsed).toMatchObject({
      workingPressure: '20',
      heatInput: '24',
      coPpm: '8',
    });
    expect(result.warnings).toEqual([]);
  });

  it('parses high and low combustion values with spoken decimals', () => {
    const result = parseCp12VoiceReadings(
      'high co 8 high co2 9 point 2 high ratio 0 point 0008 low co 6 low co2 8 point 8 low ratio 0 point 0006',
    );

    expect(result.parsed).toMatchObject({
      highCoPpm: '8',
      highCo2Percent: '9.2',
      highRatio: '0.0008',
      lowCoPpm: '6',
      lowCo2Percent: '8.8',
      lowRatio: '0.0006',
    });
  });

  it('parses spoken word numbers conservatively', () => {
    const result = parseCp12VoiceReadings('pressure twenty heat input twenty four co eight');

    expect(result.parsed).toMatchObject({
      workingPressure: '20',
      heatInput: '24',
      coPpm: '8',
    });
  });

  it('warns when combustion values are missing high or low context', () => {
    const result = parseCp12VoiceReadings('co2 9 point 2 ratio 0 point 0008');

    expect(result.parsed.highCo2Percent).toBeNull();
    expect(result.parsed.lowCo2Percent).toBeNull();
    expect(result.parsed.highRatio).toBeNull();
    expect(result.parsed.lowRatio).toBeNull();
    expect(result.warnings).toContain('Ignored CO2 value because CP12 combustion readings need high or low context.');
    expect(result.warnings).toContain('Ignored ratio value because CP12 combustion readings need high or low context.');
  });

  it('returns a clear warning when nothing can be parsed confidently', () => {
    const result = parseCp12VoiceReadings('everything looked normal');

    expect(result.parsed).toEqual({
      workingPressure: null,
      heatInput: null,
      coPpm: null,
      highCoPpm: null,
      highCo2Percent: null,
      highRatio: null,
      lowCoPpm: null,
      lowCo2Percent: null,
      lowRatio: null,
    });
    expect(result.warnings).toContain('Could not confidently match any CP12 reading labels from the transcript.');
  });
});
