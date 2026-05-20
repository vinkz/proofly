import { describe, expect, it } from 'vitest';

import { calculateGasRate, deriveGasRateVolume } from '@/lib/gas-rate-calculator';

describe('calculateGasRate', () => {
  it('calculates heat input from a metric timed volume', () => {
    const result = calculateGasRate({
      meterType: 'metric',
      volume: 0.01,
      durationSeconds: 30,
      calorificValue: 39.5,
      correctionFactor: 1.02264,
    });

    expect(result).toMatchObject({
      inputVolumeUnit: 'm3',
      volumeM3: 0.01,
      gasRateM3PerHour: 1.2,
      heatInputKw: 13.46,
    });
    expect(result.warnings).toEqual([]);
  });

  it('converts imperial cubic feet to cubic metres before calculating', () => {
    const result = calculateGasRate({
      meterType: 'imperial',
      volume: 1,
      durationSeconds: 80,
      calorificValue: 39.5,
      correctionFactor: 1.02264,
    });

    expect(result.inputVolumeUnit).toBe('ft3');
    expect(result.volumeM3).toBe(0.02832);
    expect(result.gasRateFt3PerHour).toBe(45);
    expect(result.heatInputKw).toBe(14.3);
  });

  it('can derive volume from start and end readings', () => {
    expect(deriveGasRateVolume({ startReading: 1234.56, endReading: 1234.58 })).toBeCloseTo(0.02, 5);
  });

  it('rejects non-positive test durations and volumes', () => {
    expect(() =>
      calculateGasRate({
        meterType: 'metric',
        volume: 0,
        durationSeconds: 30,
      }),
    ).toThrow('Enter a positive gas volume');

    expect(() =>
      calculateGasRate({
        meterType: 'metric',
        volume: 0.01,
        durationSeconds: 0,
      }),
    ).toThrow('Enter a test duration');
  });
});
