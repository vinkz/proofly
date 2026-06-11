'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DEFAULT_CALORIFIC_VALUE_MJ_PER_M3,
  DEFAULT_VOLUME_CORRECTION_FACTOR,
} from '@/lib/gas-rate-calculator';
import type { GasRateResult } from '@/lib/gas-rate-calculator';

type MeterType = 'metric' | 'imperial';
type VolumeMode = 'timed' | 'readings';

type ApiResponse =
  | { ok: true; result: GasRateResult }
  | { ok: false; error: string };

const DEFAULT_CV = String(DEFAULT_CALORIFIC_VALUE_MJ_PER_M3);
const DEFAULT_CF = String(DEFAULT_VOLUME_CORRECTION_FACTOR);

export function GasRateClient() {
  const [meterType, setMeterType] = useState<MeterType>('metric');
  const [volumeMode, setVolumeMode] = useState<VolumeMode>('timed');
  const [volume, setVolume] = useState('');
  const [startReading, setStartReading] = useState('');
  const [endReading, setEndReading] = useState('');
  const [duration, setDuration] = useState('');
  const [calorificValue, setCalorificValue] = useState(DEFAULT_CV);
  const [correctionFactor, setCorrectionFactor] = useState(DEFAULT_CF);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GasRateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const volumeUnit = meterType === 'imperial' ? 'ft³' : 'm³';

  const handleCalculate = async () => {
    setError(null);
    setResult(null);
    setLoading(true);

    const body: Record<string, unknown> = {
      meterType,
      durationSeconds: parseFloat(duration),
      calorificValue: parseFloat(calorificValue) || DEFAULT_CALORIFIC_VALUE_MJ_PER_M3,
      correctionFactor: parseFloat(correctionFactor) || DEFAULT_VOLUME_CORRECTION_FACTOR,
    };

    if (volumeMode === 'timed') {
      body.volume = parseFloat(volume);
    } else {
      body.startReading = parseFloat(startReading);
      body.endReading = parseFloat(endReading);
    }

    try {
      const response = await fetch('/api/tools/gas-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as ApiResponse;
      if (data.ok) {
        setResult(data.result);
      } else {
        setError(data.error ?? 'Unable to calculate.');
      }
    } catch {
      setError('Network error — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <div className="pt-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
          Tools
        </p>
        <h1 className="mt-0.5 text-[22px] font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]">
          Gas rate calculator
        </h1>
      </div>

      <div className="space-y-3 rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
        {/* Meter type */}
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
            Meter type
          </p>
          <div className="flex gap-1.5">
            {(['metric', 'imperial'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => { setMeterType(type); reset(); }}
                className={`rounded-[8px] px-4 py-2 text-[13px] font-medium transition-colors ${
                  meterType === type
                    ? 'bg-[var(--color-action)] text-white'
                    : 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {type === 'metric' ? 'Metric (m³)' : 'Imperial (ft³)'}
              </button>
            ))}
          </div>
        </div>

        {/* Volume mode */}
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
            Volume method
          </p>
          <div className="flex gap-1.5">
            {(['timed', 'readings'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => { setVolumeMode(mode); reset(); }}
                className={`rounded-[8px] px-4 py-2 text-[13px] font-medium transition-colors ${
                  volumeMode === mode
                    ? 'bg-[var(--color-action)] text-white'
                    : 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {mode === 'timed' ? 'Timed volume' : 'Start / end readings'}
              </button>
            ))}
          </div>
        </div>

        {/* Volume inputs */}
        {volumeMode === 'timed' ? (
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
              Volume ({volumeUnit})
            </label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder={`e.g. 0.04`}
              value={volume}
              onChange={(e) => { setVolume(e.target.value); reset(); }}
              min="0"
              step="any"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
                Start ({volumeUnit})
              </label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="e.g. 1234.5"
                value={startReading}
                onChange={(e) => { setStartReading(e.target.value); reset(); }}
                step="any"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
                End ({volumeUnit})
              </label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="e.g. 1234.54"
                value={endReading}
                onChange={(e) => { setEndReading(e.target.value); reset(); }}
                step="any"
              />
            </div>
          </div>
        )}

        {/* Duration */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
            Test duration (seconds)
          </label>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="e.g. 60"
            value={duration}
            onChange={(e) => { setDuration(e.target.value); reset(); }}
            min="1"
            step="1"
          />
        </div>

        {/* Advanced */}
        <div className="border-t-[0.5px] border-[var(--color-border-tertiary)] pt-3">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1 text-[12px] font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
          >
            <ChevronIcon
              width={12}
              height={12}
              className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            />
            Advanced
          </button>

          {showAdvanced ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
                  Calorific value (MJ/m³)
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={calorificValue}
                  onChange={(e) => { setCalorificValue(e.target.value); reset(); }}
                  step="any"
                  min="0"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
                  Correction factor
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={correctionFactor}
                  onChange={(e) => { setCorrectionFactor(e.target.value); reset(); }}
                  step="any"
                  min="0"
                />
              </div>
            </div>
          ) : null}
        </div>

        <Button
          type="button"
          variant="primary"
          className="w-full rounded-[12px]"
          disabled={loading}
          onClick={() => void handleCalculate()}
        >
          {loading ? 'Calculating…' : 'Calculate'}
        </Button>
      </div>

      {/* Error */}
      {error ? (
        <div className="rounded-[12px] border-[0.5px] border-[var(--color-red)]/30 bg-[var(--color-red-bg)] px-4 py-3 text-[13px] text-[var(--color-red)]">
          {error}
        </div>
      ) : null}

      {/* Result */}
      {result ? (
        <div className="space-y-3 rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
            Result
          </p>

          {/* Primary result */}
          <div className="rounded-[12px] bg-[var(--color-action-bg)] px-4 py-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-action)]">
              Heat input
            </p>
            <p className="mt-1 text-[36px] font-bold leading-none tracking-[-0.02em] text-[var(--color-action)]">
              {result.heatInputKw}
              <span className="ml-1.5 text-[18px] font-semibold">kW</span>
            </p>
          </div>

          {/* Secondary */}
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Gas rate" value={`${result.gasRateM3PerHour}`} unit="m³/hr" />
            {result.gasRateFt3PerHour !== null ? (
              <Stat label="Gas rate" value={`${result.gasRateFt3PerHour}`} unit="ft³/hr" />
            ) : null}
            <Stat label="Volume used" value={`${result.inputVolume}`} unit={result.inputVolumeUnit} />
            <Stat label="Duration" value={`${result.durationSeconds}`} unit="sec" />
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 ? (
            <div className="space-y-1">
              {result.warnings.map((warning) => (
                <div
                  key={warning}
                  className="flex items-start gap-2 rounded-[8px] bg-[var(--color-amber-bg)] px-3 py-2.5 text-[12px] text-[var(--color-amber)]"
                >
                  <span className="mt-px shrink-0">⚠</span>
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          ) : null}

          <p className="text-[11px] text-[var(--color-text-tertiary)]">
            CV {result.calorificValue} MJ/m³ · CF {result.correctionFactor}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-[10px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] px-3 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.4px] text-[var(--color-text-eyebrow)]">
        {label}
      </p>
      <p className="mt-0.5 text-[18px] font-semibold leading-none text-[var(--color-text-primary)]">
        {value}
        <span className="ml-1 text-[12px] font-medium text-[var(--color-text-tertiary)]">{unit}</span>
      </p>
    </div>
  );
}

function ChevronIcon({ className, ...props }: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
