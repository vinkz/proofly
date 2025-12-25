export type BoilerType = 'combi' | 'system' | 'regular' | 'other' | 'unknown';
export type MountType = 'wall' | 'floor' | 'unknown';
export type GasType = 'natural_gas' | 'lpg' | 'unknown';

export type BoilerModelEntry = {
  make: string;
  model: string;
  types?: BoilerType[];
  defaultType?: BoilerType;
  mountTypes?: MountType[];
  defaultMount?: MountType;
  fuels?: GasType[];
  defaultFuel?: GasType;
  aliases?: string[];
};

const NATURAL_WALL_DEFAULTS = {
  mountTypes: ['wall'] as MountType[],
  defaultMount: 'wall' as MountType,
  fuels: ['natural_gas'] as GasType[],
  defaultFuel: 'natural_gas' as GasType,
};

const combi = (make: string, model: string): BoilerModelEntry => ({
  make,
  model,
  types: ['combi'],
  defaultType: 'combi',
  ...NATURAL_WALL_DEFAULTS,
});

const system = (make: string, model: string): BoilerModelEntry => ({
  make,
  model,
  types: ['system'],
  defaultType: 'system',
  ...NATURAL_WALL_DEFAULTS,
});

const regular = (make: string, model: string): BoilerModelEntry => ({
  make,
  model,
  types: ['regular'],
  defaultType: 'regular',
  ...NATURAL_WALL_DEFAULTS,
});

export const UK_BOILER_CATALOG: BoilerModelEntry[] = [
  combi('Worcester Bosch', 'Greenstar 25i'),
  combi('Worcester Bosch', 'Greenstar 30i'),
  combi('Worcester Bosch', 'Greenstar 35i'),
  combi('Worcester Bosch', 'Greenstar 4000 25kW'),
  combi('Worcester Bosch', 'Greenstar 4000 30kW'),
  combi('Worcester Bosch', 'Greenstar 8000 Life 30kW'),
  combi('Worcester Bosch', 'Greenstar 8000 Life 35kW'),
  system('Worcester Bosch', 'Greenstar 30Ri'),
  regular('Worcester Bosch', 'Greenstar 30CDi Regular'),

  combi('Ideal', 'Logic Combi 24'),
  combi('Ideal', 'Logic Combi 30'),
  combi('Ideal', 'Logic Combi 35'),
  combi('Ideal', 'Logic Max Combi 24'),
  combi('Ideal', 'Logic Max Combi 30'),
  combi('Ideal', 'Logic Max Combi 35'),
  combi('Ideal', 'Logic+ Combi 24'),
  combi('Ideal', 'Logic+ Combi 30'),
  combi('Ideal', 'Logic+ Combi 35'),
  system('Ideal', 'Logic System 24'),
  regular('Ideal', 'Logic Regular 24'),

  combi('Baxi', '800 Combi 2 24kW'),
  combi('Baxi', '800 Combi 2 30kW'),
  combi('Baxi', '800 Combi 2 36kW'),
  combi('Baxi', '600 Combi 24kW'),
  combi('Baxi', '600 Combi 30kW'),
  system('Baxi', '800 System 2 24kW'),
  regular('Baxi', '400 Heat 18kW'),

  combi('Viessmann', 'Vitodens 100-W 25kW'),
  combi('Viessmann', 'Vitodens 100-W 30kW'),
  combi('Viessmann', 'Vitodens 100-W 35kW'),
  system('Viessmann', 'Vitodens 050-W System 25kW'),

  combi('Vaillant', 'ecoTEC plus 825'),
  combi('Vaillant', 'ecoTEC plus 832'),
  combi('Vaillant', 'ecoTEC plus 835'),
  combi('Vaillant', 'ecoFIT pure 825'),
  combi('Vaillant', 'ecoFIT pure 830'),
  combi('Vaillant', 'ecoFIT pure 835'),
  system('Vaillant', 'ecoTEC plus 630 system'),

  combi('Alpha', 'E-Tec Plus 28kW'),
  combi('Alpha', 'E-Tec Plus 33kW'),
  system('Alpha', 'E-Tec System 24kW'),

  combi('Glow-worm', 'Energy 25kW'),
  combi('Glow-worm', 'Energy 30kW'),
  regular('Glow-worm', 'Ultimate3 24kW'),
  regular('Glow-worm', 'Ultimate3 30kW'),

  { make: 'Other', model: 'Other', types: ['other'], defaultType: 'other', mountTypes: ['unknown'], defaultMount: 'unknown', fuels: ['unknown'], defaultFuel: 'unknown' },
];

export const getMakes = (): string[] => {
  const makes = new Set(UK_BOILER_CATALOG.map((entry) => entry.make));
  return Array.from(makes).sort((a, b) => a.localeCompare(b));
};

export const getModelsForMake = (make: string): string[] => {
  const normalized = make.trim().toLowerCase();
  if (!normalized) return [];
  return UK_BOILER_CATALOG.filter((entry) => entry.make.toLowerCase() === normalized)
    .map((entry) => entry.model)
    .sort((a, b) => a.localeCompare(b));
};

export const getEntry = (make: string, model: string): BoilerModelEntry | undefined => {
  const makeKey = make.trim().toLowerCase();
  const modelKey = model.trim().toLowerCase();
  if (!makeKey || !modelKey) return undefined;
  return UK_BOILER_CATALOG.find(
    (entry) => entry.make.toLowerCase() === makeKey && entry.model.toLowerCase() === modelKey,
  );
};

export const searchModels = (make: string, query: string): string[] => {
  const models = getModelsForMake(make);
  const normalized = query.trim().toLowerCase();
  if (!normalized) return models;
  return models.filter((model) => model.toLowerCase().includes(normalized));
};
