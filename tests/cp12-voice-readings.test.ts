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

  it('parses natural high-rate and low-rate boiler service reading blocks', () => {
    const result = parseCp12VoiceReadings(
      'operating pressure 20 point 5 millibar heat input 24 kilowatts high rate co 12 ppm co2 9 point 2 ratio 0 point 0008 low rate co 8 ppm co2 8 point 9 ratio 0 point 0007',
    );

    expect(result.parsed).toMatchObject({
      workingPressure: '20.5',
      heatInput: '24',
      highCoPpm: '12',
      highCo2Percent: '9.2',
      highRatio: '0.0008',
      lowCoPpm: '8',
      lowCo2Percent: '8.9',
      lowRatio: '0.0007',
    });
    expect(result.warnings).toEqual([]);
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

  it('maps bare combustion readings into high fields when scoped high', () => {
    const result = parseCp12VoiceReadings('co 8 co2 9 point 2 ratio 0 point 0008', { scope: 'high' });

    expect(result.parsed).toMatchObject({
      highCoPpm: '8',
      highCo2Percent: '9.2',
      highRatio: '0.0008',
      lowCoPpm: null,
      lowCo2Percent: null,
      lowRatio: null,
    });
    expect(result.warnings).toEqual([]);
  });

  it('maps bare combustion readings into low fields when scoped low', () => {
    const result = parseCp12VoiceReadings('co 6 co2 8 point 8 ratio 0 point 0006', { scope: 'low' });

    expect(result.parsed).toMatchObject({
      highCoPpm: null,
      highCo2Percent: null,
      highRatio: null,
      lowCoPpm: '6',
      lowCo2Percent: '8.8',
      lowRatio: '0.0006',
    });
    expect(result.warnings).toEqual([]);
  });

  it('limits scoped pressure parsing to pressure and heat input', () => {
    const result = parseCp12VoiceReadings('pressure 20 heat input 24 co 8', { scope: 'pressure' });

    expect(result.parsed).toMatchObject({
      workingPressure: '20',
      heatInput: '24',
      coPpm: null,
      highCoPpm: null,
      lowCoPpm: null,
    });
  });

  it('accepts compact heat input phrases in scoped pressure mode', () => {
    const result = parseCp12VoiceReadings('operating pressure 20 input 24', { scope: 'pressure' });

    expect(result.parsed).toMatchObject({
      workingPressure: '20',
      heatInput: '24',
    });
  });

  it('accepts common spoken variations for pressure and heat input', () => {
    const result = parseCp12VoiceReadings('dynamic pressure 19 gas rate 22', { scope: 'pressure' });

    expect(result.parsed).toMatchObject({
      workingPressure: '19',
      heatInput: '22',
    });
  });

  it('accepts compact boiler service heat input variations', () => {
    const result = parseCp12VoiceReadings('inlet pressure 21 rated input 26 point 5', { scope: 'pressure' });

    expect(result.parsed).toMatchObject({
      workingPressure: '21',
      heatInput: '26.5',
    });
  });

  it('accepts misheard heat input phrases in scoped pressure mode', () => {
    const result = parseCp12VoiceReadings('operating pressure 20 heating put 24 gas rating 24', { scope: 'pressure' });

    expect(result.parsed).toMatchObject({
      workingPressure: '20',
      heatInput: '24',
    });
  });

  it('fills pressure and heat input by order when scoped pressure has only numbers', () => {
    const result = parseCp12VoiceReadings('20 24 point 5', { scope: 'pressure' });

    expect(result.parsed).toMatchObject({
      workingPressure: '20',
      heatInput: '24.5',
    });
    expect(result.warnings).toContain('Filled missing values by recording order. Review before applying.');
  });

  it('fills high combustion readings by order when scoped high has only numbers', () => {
    const result = parseCp12VoiceReadings('8 9 point 2 point 0008', { scope: 'high' });

    expect(result.parsed).toMatchObject({
      highCoPpm: '8',
      highCo2Percent: '9.2',
      highRatio: '0.0008',
    });
  });

  it('fills low combustion readings by order when scoped low has only numbers', () => {
    const result = parseCp12VoiceReadings('six eight point eight zero point zero zero zero six', { scope: 'low' });

    expect(result.parsed).toMatchObject({
      lowCoPpm: '6',
      lowCo2Percent: '8.80',
      lowRatio: '0.0006',
    });
  });

  it('accepts common low-reading mishearings and reversed field order', () => {
    const result = parseCp12VoiceReadings('load rate carbon monoxide 6 CO to 8 point 8 CO CO2 ratio point 0006', {
      scope: 'low',
    });

    expect(result.parsed).toMatchObject({
      lowCoPpm: '6',
      lowCo2Percent: '8.8',
      lowRatio: '0.0006',
    });
  });

  it('limits combustion scope to high and low combustion values', () => {
    const result = parseCp12VoiceReadings(
      'pressure 20 heat input 24 high fire co 9 co2 9 point 1 ratio point 0009 low fire co 7 co2 8 point 7 ratio point 0007',
      { scope: 'combustion' },
    );

    expect(result.parsed).toMatchObject({
      workingPressure: null,
      heatInput: null,
      highCoPpm: '9',
      highCo2Percent: '9.1',
      highRatio: '0.0009',
      lowCoPpm: '7',
      lowCo2Percent: '8.7',
      lowRatio: '0.0007',
    });
  });

  it('accepts common spoken variations for scoped combustion readings', () => {
    const result = parseCp12VoiceReadings('carbon monoxide 7 carbon dioxide 9 point 1 combustion ratio 0 point 0007', {
      scope: 'high',
    });

    expect(result.parsed).toMatchObject({
      highCoPpm: '7',
      highCo2Percent: '9.1',
      highRatio: '0.0007',
    });
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
