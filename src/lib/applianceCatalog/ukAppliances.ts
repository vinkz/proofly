// Per-category make/model catalogs for non-boiler gas appliances a UK Gas Safe
// engineer is likely to encounter. Boilers keep their own richer catalog in
// ./ukBoilers.ts; this file covers gas hobs/cookers, gas fires and gas water
// heaters and is wired in via getApplianceCatalog() below.
//
// Model lists are representative, not exhaustive — the wizard always allows a
// manual "Not listed" entry — and were compiled from current UK retailer /
// manufacturer listings (Valor, Flavel, Gazco, Rinnai, Morco, Stoves, Belling,
// Rangemaster, Leisure, etc., June 2026). Add models by appending to the arrays.

import {
  getMakes as getBoilerMakes,
  getModelsForMake as getBoilerModels,
  getEntry as getBoilerEntry,
  type BoilerModelEntry,
} from './ukBoilers';
import type { Cp12ApplianceCategory } from '@/lib/cp12/applianceConfig';

// Non-boiler entries only need make + model; the optional boiler-style fields are
// left undefined so the shared ApplianceStep's entry-defaulting logic skips them.
export type ApplianceModelEntry = BoilerModelEntry;

export type ApplianceCatalogApi = {
  getMakes: () => string[];
  getModelsForMake: (make: string) => string[];
  getEntry: (make: string, model: string) => ApplianceModelEntry | undefined;
};

// Build a catalog from a { make: [models] } map.
function buildCatalog(byMake: Record<string, string[]>): ApplianceCatalogApi {
  const entries: ApplianceModelEntry[] = Object.entries(byMake).flatMap(([make, models]) =>
    models.map((model) => ({ make, model })),
  );
  const getMakes = () =>
    Array.from(new Set(entries.map((e) => e.make))).sort((a, b) => a.localeCompare(b));
  const getModelsForMake = (make: string) => {
    const key = make.trim().toLowerCase();
    if (!key) return [];
    return entries
      .filter((e) => e.make.toLowerCase() === key)
      .map((e) => e.model)
      .sort((a, b) => a.localeCompare(b));
  };
  const getEntry = (make: string, model: string) => {
    const makeKey = make.trim().toLowerCase();
    const modelKey = model.trim().toLowerCase();
    if (!makeKey || !modelKey) return undefined;
    return entries.find((e) => e.make.toLowerCase() === makeKey && e.model.toLowerCase() === modelKey);
  };
  return { getMakes, getModelsForMake, getEntry };
}

// ---------------------------------------------------------------------------
// Gas hobs & cookers (freestanding cookers, range cookers, built-in gas hobs)
// ---------------------------------------------------------------------------
const HOB_COOKER_BY_MAKE: Record<string, string[]> = {
  Stoves: ['Richmond 600DF', 'Richmond Deluxe 600DF', 'Sterling 600', '600DF', 'Richmond 900Ei'],
  Belling: ['Farmhouse 60G', 'Farmhouse 90DFT', 'Cookcentre 60G', 'Cookcentre 100G', 'Kensington 100G'],
  Rangemaster: [
    'Classic 60',
    'Classic 90',
    'Classic 110',
    'Professional Deluxe 90',
    'Professional Plus 110',
    'Nexus 110',
    'Kitchener 90',
    'Elise 110',
    'Encore Deluxe 110',
  ],
  Leisure: ['CLB60GCC', 'Cookmaster CK90G232', 'Cuisinemaster CS100F520', 'Gourmet GRB6GVC'],
  Flavel: ['Milano G50', 'ML5GRDP', 'FTCG52W'],
  'New World': ['NW601G', 'NW551G', 'NW50G'],
  Cannon: ['Carrick', 'Chichester', 'Kendal'],
  Beko: ['KA52NEW', 'FDG6272TCSM', 'FTG6201K', 'KDG582'],
  Indesit: ['Cloe IS5G1KMW', 'IS5G1PMW'],
  Hotpoint: ['HD5G00KCW', 'HUG61P', 'HAGL51P'],
  Montpellier: ['MDOG50LK', 'MDG600LW'],
  Kenwood: ['KTG606S22'],
  Logik: ['LFTG60B22'],
  Bosch: ['Serie 2 Gas Hob', 'Serie 4 Gas Hob', 'Serie 6 Gas Hob', 'Serie 8 Gas Hob'],
  Neff: ['N30 Gas Hob', 'N50 Gas Hob', 'N70 Gas Hob'],
  Smeg: ['60cm Classic Gas Hob', '70cm Gas Hob', 'Victoria Gas Hob'],
  Zanussi: ['ZGNN645K', 'ZGG65414'],
  AEG: ['HG654550NM', 'HKB64540NB'],
  Other: ['Other'],
};

// ---------------------------------------------------------------------------
// Gas fires (inset, outset, balanced flue, back boiler fire fronts)
// ---------------------------------------------------------------------------
const GAS_FIRE_BY_MAKE: Record<string, string[]> = {
  Valor: [
    'Brazilia F5S',
    'Blenheim Slimline',
    'Brunswick Gas Stove',
    'Excelsior Slimline Homeflame',
    'Masquerade Slimline Homeflame',
    'Seattle Slimline',
    'Dream Convector',
    'Homeflame Slimline',
    'Portrait',
  ],
  Flavel: [
    'Kenilworth HE',
    'Kenilworth Plus',
    'Linear HE',
    'Linear Plus',
    'Calypso Plus',
    'Caress HE Contemporary',
    'Caress HE Traditional',
    'Caress Slimline',
    'Curve HE',
    'Decadence HE',
    'Emberglow',
    'Emberglow Balanced Flue',
    'Expression Plus',
    'Firenza',
    'Jazz HE',
    'Misermatic',
    'Orchestra Balanced Flue',
    'Strata',
    'Regent',
    'Windsor',
  ],
  Gazco: ['Logic HE', 'Logic Convector', 'Logic2', 'Riva2 500', 'Riva2 670', 'Studio 1', 'Studio 2'],
  Baxi: ['Bermuda Inset', 'Bermuda 552'],
  Kinder: ['Camber', 'Nevada', 'Riva'],
  'Robinson Willey': ['Firegem Visa', 'Supereco', 'Sahara'],
  Verine: ['Eclipse', 'Quasar', 'Orbis', 'Frontier'],
  'Crystal Fires': ['Gem', 'Manhattan', 'Montana'],
  Legend: ['Gas Fire'],
  'Be Modern': ['Gas Fire'],
  Other: ['Other'],
};

// ---------------------------------------------------------------------------
// Gas water heaters (instantaneous / multipoint, internal & external)
// ---------------------------------------------------------------------------
const WATER_HEATER_BY_MAKE: Record<string, string[]> = {
  Rinnai: ['Infinity 11i', 'Infinity 17i', 'Infinity 17CE', '11i Multipoint', '17i Multipoint'],
  Morco: ['D61E', 'D61B', 'G11E'],
  Ariston: ['Next Evo X', 'Fast Evo'],
  Vaillant: ['atmoMAG', 'turboMAG'],
  Main: ['Multipoint'],
  Andrews: ['Multipoint'],
  'Heatrae Sadia': ['Multipoint'],
  Other: ['Other'],
};

const HOB_COOKER_CATALOG = buildCatalog(HOB_COOKER_BY_MAKE);
const GAS_FIRE_CATALOG = buildCatalog(GAS_FIRE_BY_MAKE);
const WATER_HEATER_CATALOG = buildCatalog(WATER_HEATER_BY_MAKE);

// The boiler catalog already exports its own helpers; wrap them in the shared shape.
const BOILER_CATALOG: ApplianceCatalogApi = {
  getMakes: getBoilerMakes,
  getModelsForMake: getBoilerModels,
  getEntry: getBoilerEntry,
};

// "Other" category gets every make/model across categories so the engineer can
// still pick a known appliance when it doesn't fit a primary category.
const OTHER_CATALOG: ApplianceCatalogApi = buildCatalog({
  ...HOB_COOKER_BY_MAKE,
  ...GAS_FIRE_BY_MAKE,
  ...WATER_HEATER_BY_MAKE,
});

export function getApplianceCatalog(category: Cp12ApplianceCategory): ApplianceCatalogApi {
  switch (category) {
    case 'hob_cooker':
      return HOB_COOKER_CATALOG;
    case 'gas_fire':
      return GAS_FIRE_CATALOG;
    case 'water_heater':
      return WATER_HEATER_CATALOG;
    case 'other':
      return OTHER_CATALOG;
    case 'boiler':
    default:
      return BOILER_CATALOG;
  }
}
