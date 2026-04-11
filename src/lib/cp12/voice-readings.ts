export type Cp12VoiceReadingsParsed = {
  workingPressure: string | null;
  heatInput: string | null;
  coPpm: string | null;
  highCoPpm: string | null;
  highCo2Percent: string | null;
  highRatio: string | null;
  lowCoPpm: string | null;
  lowCo2Percent: string | null;
  lowRatio: string | null;
};

export type Cp12VoiceReadingsResult = {
  transcript: string;
  parsed: Cp12VoiceReadingsParsed;
  warnings: string[];
};

export const CP12_VOICE_READING_FIELDS: Array<{ key: keyof Cp12VoiceReadingsParsed; label: string; unit?: string }> = [
  { key: 'workingPressure', label: 'Working pressure', unit: 'mbar' },
  { key: 'heatInput', label: 'Heat input', unit: 'kW' },
  { key: 'coPpm', label: 'CO ppm', unit: 'ppm' },
  { key: 'highCoPpm', label: 'High CO ppm', unit: 'ppm' },
  { key: 'highCo2Percent', label: 'High CO2 %', unit: '%' },
  { key: 'highRatio', label: 'High ratio' },
  { key: 'lowCoPpm', label: 'Low CO ppm', unit: 'ppm' },
  { key: 'lowCo2Percent', label: 'Low CO2 %', unit: '%' },
  { key: 'lowRatio', label: 'Low ratio' },
];

const EMPTY_PARSED: Cp12VoiceReadingsParsed = {
  workingPressure: null,
  heatInput: null,
  coPpm: null,
  highCoPpm: null,
  highCo2Percent: null,
  highRatio: null,
  lowCoPpm: null,
  lowCo2Percent: null,
  lowRatio: null,
};

const DIGIT_WORDS: Record<string, string> = {
  zero: '0',
  oh: '0',
  o: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
};

const SMALL_NUMBERS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const DECIMAL_TOKENS = new Set(['point', 'dot', 'decimal']);
const UNIT_TOKENS = new Set(['ppm', 'percent', 'kw', 'mbar', 'bar']);
const FILLER_TOKENS = new Set(['is', 'was', 'at', 'reading', 'readings', 'value', 'equals', 'equal', 'of']);

const NUMBER_CAPTURE = '([a-z0-9.%\\s-]{1,48})';

const FIELD_PATTERNS: Array<{ key: keyof Cp12VoiceReadingsParsed; patterns: RegExp[] }> = [
  {
    key: 'highCoPpm',
    patterns: [
      new RegExp(`\\b(?:high|combustion\\s+high|high\\s+combustion)(?:\\s+reading)?\\s+co(?:\\s+ppm)?\\b\\s*${NUMBER_CAPTURE}`, 'i'),
    ],
  },
  {
    key: 'highCo2Percent',
    patterns: [
      new RegExp(`\\b(?:high|combustion\\s+high|high\\s+combustion)(?:\\s+reading)?\\s+co2\\b\\s*${NUMBER_CAPTURE}`, 'i'),
    ],
  },
  {
    key: 'highRatio',
    patterns: [
      new RegExp(`\\b(?:high|combustion\\s+high|high\\s+combustion)(?:\\s+reading)?\\s+(?:co\\s+co2\\s+)?ratio\\b\\s*${NUMBER_CAPTURE}`, 'i'),
    ],
  },
  {
    key: 'lowCoPpm',
    patterns: [
      new RegExp(`\\b(?:low|combustion\\s+low|low\\s+combustion)(?:\\s+reading)?\\s+co(?:\\s+ppm)?\\b\\s*${NUMBER_CAPTURE}`, 'i'),
    ],
  },
  {
    key: 'lowCo2Percent',
    patterns: [
      new RegExp(`\\b(?:low|combustion\\s+low|low\\s+combustion)(?:\\s+reading)?\\s+co2\\b\\s*${NUMBER_CAPTURE}`, 'i'),
    ],
  },
  {
    key: 'lowRatio',
    patterns: [
      new RegExp(`\\b(?:low|combustion\\s+low|low\\s+combustion)(?:\\s+reading)?\\s+(?:co\\s+co2\\s+)?ratio\\b\\s*${NUMBER_CAPTURE}`, 'i'),
    ],
  },
  {
    key: 'workingPressure',
    patterns: [
      new RegExp(`\\b(?:working|operating)\\s+pressure\\b\\s*${NUMBER_CAPTURE}`, 'i'),
      new RegExp(`\\bpressure\\b\\s*${NUMBER_CAPTURE}`, 'i'),
    ],
  },
  {
    key: 'heatInput',
    patterns: [
      new RegExp(`\\bheat\\s+input\\b\\s*${NUMBER_CAPTURE}`, 'i'),
    ],
  },
  {
    key: 'coPpm',
    patterns: [
      new RegExp(`(?<!high\\s)(?<!low\\s)\\bco(?:\\s+ppm)?\\b\\s*${NUMBER_CAPTURE}`, 'i'),
    ],
  },
];

function normalizeTranscript(text: string) {
  return text
    .toLowerCase()
    .replace(/co₂/g, 'co2')
    .replace(/\bc\s*o\s*2\b/g, 'co2')
    .replace(/\bco[\s-]*two\b/g, 'co2')
    .replace(/\bco\s*\/\s*co2\b/g, 'co co2')
    .replace(/\bm\s*bar\b/g, 'mbar')
    .replace(/\bkilowatts?\b/g, 'kw')
    .replace(/%/g, ' percent ')
    .replace(/[-/]/g, ' ')
    .replace(/[,\n;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeNumericString(value: string) {
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned) return null;
  const [wholeRaw, fractionRaw] = cleaned.split('.');
  if (!wholeRaw) return null;
  const whole = String(Number.parseInt(wholeRaw, 10));
  if (Number.isNaN(Number.parseInt(wholeRaw, 10))) return null;
  if (fractionRaw === undefined) return whole;
  const fraction = fractionRaw.replace(/[^0-9]/g, '');
  if (!fraction) return null;
  return `${whole}.${fraction}`;
}

function parseWholeNumberTokens(tokens: string[]) {
  if (!tokens.length) return null;

  if (tokens.length === 1 && /^[0-9]+(?:\.[0-9]+)?$/.test(tokens[0])) {
    return normalizeNumericString(tokens[0]);
  }

  if (tokens.every((token) => /^[0-9]$/.test(token) || token in DIGIT_WORDS)) {
    const joined = tokens.map((token) => (token in DIGIT_WORDS ? DIGIT_WORDS[token] : token)).join('');
    return normalizeNumericString(joined);
  }

  let total = 0;
  let current = 0;
  let used = false;

  for (const token of tokens) {
    if (token in SMALL_NUMBERS) {
      current += SMALL_NUMBERS[token];
      used = true;
      continue;
    }
    if (token in TENS) {
      current += TENS[token];
      used = true;
      continue;
    }
    if (token === 'hundred') {
      current = (current || 1) * 100;
      used = true;
      continue;
    }
    if (token === 'thousand') {
      total += (current || 1) * 1000;
      current = 0;
      used = true;
      continue;
    }
    return null;
  }

  if (!used) return null;
  return String(total + current);
}

function parseFractionTokens(tokens: string[]) {
  if (!tokens.length) return null;

  if (tokens.length === 1 && /^[0-9]+$/.test(tokens[0])) {
    return tokens[0];
  }

  if (tokens.every((token) => token in DIGIT_WORDS || /^[0-9]$/.test(token))) {
    return tokens.map((token) => (token in DIGIT_WORDS ? DIGIT_WORDS[token] : token)).join('');
  }

  return null;
}

function parseLeadingNumberPhrase(value: string) {
  const tokens = value
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9.]/g, ''))
    .filter(Boolean);

  let cursor = 0;
  while (cursor < tokens.length && FILLER_TOKENS.has(tokens[cursor])) {
    cursor += 1;
  }

  const relevant: string[] = [];
  for (; cursor < tokens.length; cursor += 1) {
    const token = tokens[cursor];
    if (UNIT_TOKENS.has(token)) break;
    if (DECIMAL_TOKENS.has(token) || /^[0-9]+(?:\.[0-9]+)?$/.test(token) || token in DIGIT_WORDS || token in SMALL_NUMBERS || token in TENS || token === 'hundred' || token === 'thousand') {
      relevant.push(token);
      continue;
    }
    break;
  }

  if (!relevant.length) return null;

  const decimalIndexes = relevant.reduce<number[]>((acc, token, index) => {
    if (DECIMAL_TOKENS.has(token)) acc.push(index);
    return acc;
  }, []);

  if (decimalIndexes.length > 1) return null;

  if (decimalIndexes.length === 0) {
    return parseWholeNumberTokens(relevant);
  }

  const [decimalIndex] = decimalIndexes;
  const whole = parseWholeNumberTokens(relevant.slice(0, decimalIndex));
  const fraction = parseFractionTokens(relevant.slice(decimalIndex + 1));
  if (!whole || !fraction) return null;
  return `${whole}.${fraction}`;
}

function extractFieldValue(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const parsed = parseLeadingNumberPhrase(match[1]);
    if (parsed) return parsed;
  }
  return null;
}

export function hasParsedCp12VoiceReadings(parsed: Cp12VoiceReadingsParsed) {
  return Object.values(parsed).some((value) => Boolean(value && value.trim()));
}

export function parseCp12VoiceReadings(transcript: string): Cp12VoiceReadingsResult {
  const normalized = normalizeTranscript(transcript);
  const parsed: Cp12VoiceReadingsParsed = { ...EMPTY_PARSED };
  const warnings: string[] = [];

  if (!normalized) {
    return {
      transcript: transcript.trim(),
      parsed,
      warnings: ['No transcript was returned from the recording.'],
    };
  }

  for (const field of FIELD_PATTERNS) {
    parsed[field.key] = extractFieldValue(normalized, field.patterns);
  }

  if (/(?<!high\s)(?<!low\s)\bco2\b/.test(normalized) && !parsed.highCo2Percent && !parsed.lowCo2Percent) {
    warnings.push('Ignored CO2 value because CP12 combustion readings need high or low context.');
  }

  if (/(?<!high\s)(?<!low\s)\bratio\b/.test(normalized) && !parsed.highRatio && !parsed.lowRatio) {
    warnings.push('Ignored ratio value because CP12 combustion readings need high or low context.');
  }

  if (!hasParsedCp12VoiceReadings(parsed)) {
    warnings.push('Could not confidently match any CP12 reading labels from the transcript.');
  }

  return {
    transcript: transcript.trim(),
    parsed,
    warnings,
  };
}
