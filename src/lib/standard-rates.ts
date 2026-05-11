export const STANDARD_RATE_KEYS = ['cp12', 'boiler_service', 'cp12_boiler_service'] as const;

export type StandardRateKey = (typeof STANDARD_RATE_KEYS)[number];

export type StandardRates = Partial<Record<StandardRateKey, number>>;

export const STANDARD_RATE_LABELS: Record<StandardRateKey, string> = {
  cp12: 'CP12',
  boiler_service: 'Boiler Service',
  cp12_boiler_service: 'CP12 + Boiler Service',
};

export const STANDARD_RATE_DESCRIPTIONS: Record<StandardRateKey, string> = {
  cp12: 'Gas Safety Certificate (CP12)',
  boiler_service: 'Boiler Service Record',
  cp12_boiler_service: 'Gas Safety Certificate (CP12) + Boiler Service Record',
};

export function normalizeStandardRates(value: unknown): StandardRates {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return STANDARD_RATE_KEYS.reduce<StandardRates>((rates, key) => {
    const raw = (value as Record<string, unknown>)[key];
    const amount = typeof raw === 'string' ? Number(raw) : raw;
    if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
      rates[key] = amount;
    }
    return rates;
  }, {});
}

