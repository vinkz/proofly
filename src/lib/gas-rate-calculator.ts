export const DEFAULT_CALORIFIC_VALUE_MJ_PER_M3 = 39.5;
export const DEFAULT_VOLUME_CORRECTION_FACTOR = 1.02264;
export const CUBIC_FOOT_TO_CUBIC_METRE = 0.028316846592;

export type GasRateMeterType = 'metric' | 'imperial';

export type GasRateInput = {
  meterType: GasRateMeterType;
  durationSeconds: number;
  volume?: number | null;
  startReading?: number | null;
  endReading?: number | null;
  calorificValue?: number | null;
  correctionFactor?: number | null;
};

export type GasRateResult = {
  meterType: GasRateMeterType;
  durationSeconds: number;
  inputVolume: number;
  inputVolumeUnit: 'm3' | 'ft3';
  volumeM3: number;
  gasRateM3PerHour: number;
  gasRateFt3PerHour: number | null;
  heatInputKw: number;
  calorificValue: number;
  correctionFactor: number;
  formula: string;
  warnings: string[];
};

const round = (value: number, decimals = 2) => {
  const multiplier = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
};

const toFiniteNumber = (value: number | null | undefined) => {
  if (typeof value !== 'number') return null;
  return Number.isFinite(value) ? value : null;
};

export function deriveGasRateVolume(input: Pick<GasRateInput, 'volume' | 'startReading' | 'endReading'>) {
  const explicitVolume = toFiniteNumber(input.volume);
  if (explicitVolume !== null) return explicitVolume;

  const startReading = toFiniteNumber(input.startReading);
  const endReading = toFiniteNumber(input.endReading);
  if (startReading === null || endReading === null) return null;

  return endReading - startReading;
}

export function calculateGasRate(input: GasRateInput): GasRateResult {
  const meterType = input.meterType;
  if (meterType !== 'metric' && meterType !== 'imperial') {
    throw new Error('Choose a metric or imperial gas meter.');
  }

  const durationSeconds = toFiniteNumber(input.durationSeconds);
  if (durationSeconds === null || durationSeconds <= 0) {
    throw new Error('Enter a test duration greater than zero seconds.');
  }

  const inputVolume = deriveGasRateVolume(input);
  if (inputVolume === null || inputVolume <= 0) {
    throw new Error('Enter a positive gas volume, or start and end readings that increase.');
  }

  const calorificValue = toFiniteNumber(input.calorificValue) ?? DEFAULT_CALORIFIC_VALUE_MJ_PER_M3;
  if (calorificValue <= 0) {
    throw new Error('Calorific value must be greater than zero.');
  }

  const correctionFactor = toFiniteNumber(input.correctionFactor) ?? DEFAULT_VOLUME_CORRECTION_FACTOR;
  if (correctionFactor <= 0) {
    throw new Error('Correction factor must be greater than zero.');
  }

  const volumeM3 = meterType === 'imperial' ? inputVolume * CUBIC_FOOT_TO_CUBIC_METRE : inputVolume;
  const gasRateM3PerHour = (volumeM3 * 3600) / durationSeconds;
  const heatInputKw = (gasRateM3PerHour * calorificValue * correctionFactor) / 3.6;
  const gasRateFt3PerHour = meterType === 'imperial' ? (inputVolume * 3600) / durationSeconds : null;

  const warnings: string[] = [];
  if (calorificValue < 38 || calorificValue > 41) {
    warnings.push('Calorific value is outside the usual UK natural gas range. Check the value from the gas bill or supplier.');
  }
  if (correctionFactor < 1 || correctionFactor > 1.1) {
    warnings.push('Correction factor is unusual for UK natural gas. Check the value before relying on this result.');
  }
  if (durationSeconds < 20) {
    warnings.push('Very short timed tests can exaggerate small reading errors.');
  }
  if (heatInputKw > 80) {
    warnings.push('Calculated heat input is high for a domestic appliance. Re-check the timed volume and meter units.');
  }

  return {
    meterType,
    durationSeconds: round(durationSeconds, 2),
    inputVolume: round(inputVolume, 5),
    inputVolumeUnit: meterType === 'imperial' ? 'ft3' : 'm3',
    volumeM3: round(volumeM3, 5),
    gasRateM3PerHour: round(gasRateM3PerHour, 3),
    gasRateFt3PerHour: gasRateFt3PerHour === null ? null : round(gasRateFt3PerHour, 3),
    heatInputKw: round(heatInputKw, 2),
    calorificValue: round(calorificValue, 3),
    correctionFactor: round(correctionFactor, 5),
    formula: 'heatInputKw = (volumeM3 * 3600 / seconds) * calorificValue * correctionFactor / 3.6',
    warnings,
  };
}
