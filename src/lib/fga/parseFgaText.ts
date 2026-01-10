type FgaParsed = {
  co_ppm?: number;
  co2_pct?: number;
  o2_pct?: number;
  ratio?: number;
  flue_temp_c?: number;
  ambient_temp_c?: number;
  efficiency_pct?: number;
};

const numberRegex = /([0-9]+(?:\.[0-9]+)?)/;
const degreeSymbol = '\\u00b0';

function parseNumber(value: string | undefined) {
  if (!value) return undefined;
  const cleaned = value.replace(/,/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function findValue(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseNumber(match[1]);
      if (value !== undefined) return value;
    }
  }
  return undefined;
}

export function parseFgaText(text: string): FgaParsed {
  const normalized = text ?? '';

  const co_ppm = findValue(normalized, [
    new RegExp(`\\bCO\\b\\s*[:=]?\\s*${numberRegex.source}\\s*ppm\\b`, 'i'),
    new RegExp(`\\bCO\\b\\s+${numberRegex.source}\\s*ppm\\b`, 'i'),
  ]);

  const co2_pct = findValue(normalized, [
    new RegExp(`\\bCO2\\b\\s*[:=]?\\s*${numberRegex.source}\\s*%\\b`, 'i'),
    new RegExp(`\\bCO2\\b\\s+${numberRegex.source}\\s*%\\b`, 'i'),
  ]);

  const o2_pct = findValue(normalized, [
    new RegExp(`\\bO2\\b\\s*[:=]?\\s*${numberRegex.source}\\s*%\\b`, 'i'),
    new RegExp(`\\bO2\\b\\s+${numberRegex.source}\\s*%\\b`, 'i'),
  ]);

  const ratio = findValue(normalized, [
    new RegExp(`\\b(?:co\\s*/\\s*co2\\s*)?ratio\\b\\s*[:=]?\\s*${numberRegex.source}`, 'i'),
  ]);

  const flue_temp_c = findValue(normalized, [
    new RegExp(`\\bflue\\s*temp(?:erature)?\\b\\s*[:=]?\\s*${numberRegex.source}\\s*(?:${degreeSymbol}\\s*)?c\\b`, 'i'),
    new RegExp(`\\bflue\\s*temp(?:erature)?\\b\\s+${numberRegex.source}\\s*(?:${degreeSymbol}\\s*)?c\\b`, 'i'),
  ]);

  const ambient_temp_c = findValue(normalized, [
    new RegExp(`\\b(?:ambient|room)\\s*temp(?:erature)?\\b\\s*[:=]?\\s*${numberRegex.source}\\s*(?:${degreeSymbol}\\s*)?c\\b`, 'i'),
    new RegExp(`\\b(?:ambient|room)\\s*temp(?:erature)?\\b\\s+${numberRegex.source}\\s*(?:${degreeSymbol}\\s*)?c\\b`, 'i'),
  ]);

  const efficiency_pct = findValue(normalized, [
    new RegExp(`\\befficiency\\b\\s*[:=]?\\s*${numberRegex.source}\\s*%\\b`, 'i'),
    new RegExp(`\\befficiency\\b\\s+${numberRegex.source}\\s*%\\b`, 'i'),
  ]);

  return {
    co_ppm,
    co2_pct,
    o2_pct,
    ratio,
    flue_temp_c,
    ambient_temp_c,
    efficiency_pct,
  };
}

// Examples:
// parseFgaText('CO 12 ppm, CO2 9.1%, O2 4.5%') -> { co_ppm: 12, co2_pct: 9.1, o2_pct: 4.5 }
// parseFgaText('Flue Temp: 180C, Ambient Temp 22 C, Efficiency 82.3%') ->
//   { flue_temp_c: 180, ambient_temp_c: 22, efficiency_pct: 82.3 }
// parseFgaText('CO:12ppm CO/CO2 ratio: 0.0008') -> { co_ppm: 12, ratio: 0.0008 }
