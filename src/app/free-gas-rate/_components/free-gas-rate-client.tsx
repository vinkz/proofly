'use client';

/**
 * The free gas rate calculator.
 *
 * Computes in the browser against the shared, pure calculateGasRate — no API
 * call, so it is instant, works on a bad signal in a plant room, and costs us
 * nothing to serve. It also needs no rate limiting for the same reason.
 *
 * No email capture: this produces no document, and putting a wall in front of
 * a number an engineer can work out on a phone calculator would only teach
 * them the free tools are bait.
 */
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EnumChips } from '@/components/wizard/inputs/enum-chips';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics/events';
import {
  calculateGasRate,
  DEFAULT_CALORIFIC_VALUE_MJ_PER_M3,
  DEFAULT_VOLUME_CORRECTION_FACTOR,
  type GasRateResult,
} from '@/lib/gas-rate-calculator';

const METER_TYPES = [
  { label: 'Metric (m³)', value: 'metric' },
  { label: 'Imperial (ft³)', value: 'imperial' },
];
const VOLUME_MODES = [
  { label: 'Timed volume', value: 'timed' },
  { label: 'Meter readings', value: 'readings' },
];

const num = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

export function FreeGasRateClient() {
  const [meterType, setMeterType] = useState<'metric' | 'imperial'>('metric');
  const [volumeMode, setVolumeMode] = useState<'timed' | 'readings'>('timed');
  const [volume, setVolume] = useState('');
  const [startReading, setStartReading] = useState('');
  const [endReading, setEndReading] = useState('');
  const [duration, setDuration] = useState('');
  const [calorificValue, setCalorificValue] = useState(String(DEFAULT_CALORIFIC_VALUE_MJ_PER_M3));
  const [correctionFactor, setCorrectionFactor] = useState(String(DEFAULT_VOLUME_CORRECTION_FACTOR));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [started, setStarted] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const unit = meterType === 'imperial' ? 'ft³' : 'm³';

  const markStarted = () => {
    if (started) return;
    setStarted(true);
    track(ANALYTICS_EVENTS.freeGasRateStarted);
  };

  /**
   * Recomputed as they type. The calculator throws for incomplete input, which
   * is the normal state of a half-filled form — so the error only surfaces
   * after they have asked for a result.
   */
  const { result, error } = useMemo<{ result: GasRateResult | null; error: string | null }>(() => {
    try {
      return {
        result: calculateGasRate({
          meterType,
          durationSeconds: num(duration) ?? 0,
          volume: volumeMode === 'timed' ? num(volume) : null,
          startReading: volumeMode === 'readings' ? num(startReading) : null,
          endReading: volumeMode === 'readings' ? num(endReading) : null,
          calorificValue: num(calorificValue),
          correctionFactor: num(correctionFactor),
        }),
        error: null,
      };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : 'Check the values and try again.' };
    }
  }, [meterType, volumeMode, volume, startReading, endReading, duration, calorificValue, correctionFactor]);

  const handleCalculate = () => {
    setAttempted(true);
    if (result) track(ANALYTICS_EVENTS.freeGasRateCalculated, { meter_type: meterType });
  };

  return (
    <div>
      <section className="mb-6 rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4 sm:p-5">
        <div className="grid gap-4">
          <EnumChips
            label="Meter type"
            value={meterType}
            options={METER_TYPES}
            onChange={(v) => {
              markStarted();
              setMeterType(v as 'metric' | 'imperial');
            }}
          />
          <EnumChips
            label="How did you measure it?"
            value={volumeMode}
            options={VOLUME_MODES}
            onChange={(v) => {
              markStarted();
              setVolumeMode(v as 'timed' | 'readings');
            }}
          />

          {volumeMode === 'timed' ? (
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-[var(--color-text-secondary)]">
                Volume used ({unit})
              </span>
              <Input
                inputMode="decimal"
                placeholder={meterType === 'imperial' ? '0.25' : '0.05'}
                value={volume}
                onChange={(e) => {
                  markStarted();
                  setVolume(e.target.value);
                }}
              />
            </label>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-[var(--color-text-secondary)]">
                  Start reading ({unit})
                </span>
                <Input
                  inputMode="decimal"
                  value={startReading}
                  onChange={(e) => {
                    markStarted();
                    setStartReading(e.target.value);
                  }}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-[var(--color-text-secondary)]">
                  End reading ({unit})
                </span>
                <Input
                  inputMode="decimal"
                  value={endReading}
                  onChange={(e) => {
                    markStarted();
                    setEndReading(e.target.value);
                  }}
                />
              </label>
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--color-text-secondary)]">
              Test duration (seconds)
            </span>
            <Input
              inputMode="decimal"
              placeholder="120"
              value={duration}
              onChange={(e) => {
                markStarted();
                setDuration(e.target.value);
              }}
            />
          </label>

          <button
            type="button"
            className="justify-self-start text-[13px] font-medium text-[var(--color-text-secondary)] underline"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? 'Hide' : 'Change'} calorific value and correction factor
          </button>

          {showAdvanced ? (
            <div className="grid gap-4 rounded-[12px] bg-[var(--color-background-secondary)] p-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-[var(--color-text-secondary)]">
                  Calorific value (MJ/m³)
                </span>
                <Input
                  inputMode="decimal"
                  value={calorificValue}
                  onChange={(e) => setCalorificValue(e.target.value)}
                />
                <span className="mt-1 block text-[12px] text-[var(--color-text-tertiary)]">
                  From the gas bill or supplier. UK natural gas is usually 38–41.
                </span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-[var(--color-text-secondary)]">
                  Volume correction factor
                </span>
                <Input
                  inputMode="decimal"
                  value={correctionFactor}
                  onChange={(e) => setCorrectionFactor(e.target.value)}
                />
              </label>
            </div>
          ) : null}

          <Button variant="primary" className="justify-self-start" onClick={handleCalculate}>
            Calculate
          </Button>
        </div>
      </section>

      {attempted && error ? (
        <p className="mb-6 text-[13px] text-[var(--color-red)]">{error}</p>
      ) : null}

      {result ? (
        <section className="mb-6 rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4 sm:p-5">
          <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">Result</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[12px] uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
                Heat input
              </p>
              <p className="text-[28px] font-semibold text-[var(--color-text-primary)]">
                {result.heatInputKw} kW
              </p>
            </div>
            <div>
              <p className="text-[12px] uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
                Gas rate
              </p>
              <p className="text-[28px] font-semibold text-[var(--color-text-primary)]">
                {result.gasRateM3PerHour} m³/h
              </p>
              {result.gasRateFt3PerHour !== null ? (
                <p className="text-[13px] text-[var(--color-text-tertiary)]">
                  {result.gasRateFt3PerHour} ft³/h
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 rounded-[12px] bg-[var(--color-background-secondary)] p-3">
            <p className="text-[12px] font-medium text-[var(--color-text-secondary)]">Working</p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-tertiary)]">
              {result.volumeM3} m³ over {result.durationSeconds}s → {result.gasRateM3PerHour} m³/h ×{' '}
              {result.calorificValue} MJ/m³ × {result.correctionFactor} ÷ 3.6 = {result.heatInputKw} kW
            </p>
          </div>

          {result.warnings.length ? (
            <ul className="mt-4 list-disc pl-5 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
