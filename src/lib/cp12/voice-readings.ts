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

export type Cp12VoiceReadingScope = 'all' | 'pressure' | 'high' | 'low' | 'combustion';

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
      new RegExp(`\\b(?:high|hi|maximum|max|full\\s+rate|full\\s+load|high\\s+rate|high\\s+fire|high\\s+load|combustion\\s+high|high\\s+combustion)(?:\\s+reading|\\s+readings)?\\s+(?:co|carbon\\s+monoxide)(?:\\s+ppm)?\\b\\s*${NUMBER_CAPTURE}`, 'i'),
      new RegExp(`\\b(?:co|carbon\\s+monoxide)(?:\\s+ppm)?\\s+(?:high|hi|maximum|max|full\\s+rate|full\\s+load|high\\s+rate|high\\s+fire|high\\s+load)\\b\\s*${NUMBER_CAPTURE}`, 'i'),
    ],
  },
  {
    key: 'highCo2Percent',
    patterns: [
      new RegExp(`\\b(?:high|hi|maximum|max|full\\s+rate|full\\s+load|high\\s+rate|high\\s+fire|high\\s+load|combustion\\s+high|high\\s+combustion)(?:\\s+reading|\\s+readings)?\\s+(?:co2|carbon\\s+dioxide)\\b\\s*${NUMBER_CAPTURE}`, 'i'),
      new RegExp(`\\b(?:co2|carbon\\s+dioxide)\\s+(?:high|hi|maximum|max|full\\s+rate|full\\s+load|high\\s+rate|high\\s+fire|high\\s+load)\\b\\s*${NUMBER_CAPTURE}`, 'i'),
    ],
  },
  {
    key: 'highRatio',
    patterns: [
      new RegExp(`\\b(?:high|hi|maximum|max|full\\s+rate|full\\s+load|high\\s+rate|high\\s+fire|high\\s+load|combustion\\s+high|high\\s+combustion)(?:\\s+reading|\\s+readings)?\\s+(?:(?:co|carbon\\s+monoxide)\\s+(?:co2|carbon\\s+dioxide)\\s+)?(?:ratio|combustion\\s+ratio|co\\s+co2\\s+ratio)\\b\\s*${NUMBER_CAPTURE}`, 'i'),
      new RegExp(`\\b(?:ratio|combustion\\s+ratio|co\\s+co2\\s+ratio)\\s+(?:high|hi|maximum|max|full\\s+rate|full\\s+load|high\\s+rate|high\\s+fire|high\\s+load)\\b\\s*${NUMBER_CAPTURE}`, 'i'),
    ],
  },
  {
    key: 'lowCoPpm',
    patterns: [
      new RegExp(`\\b(?:low|lo|minimum|min|low\\s+rate|low\\s+fire|low\\s+load|load\\s+rate|load\\s+fire|combustion\\s+low|low\\s+combustion)(?:\\s+reading|\\s+readings)?\\s+(?:co|carbon\\s+monoxide)(?:\\s+ppm)?\\b\\s*${NUMBER_CAPTURE}`, 'i'),
      new RegExp(`\\b(?:co|carbon\\s+monoxide)(?:\\s+ppm)?\\s+(?:low|lo|minimum|min|low\\s+rate|low\\s+fire|low\\s+load|load\\s+rate|load\\s+fire)\\b\\s*${NUMBER_CAPTURE}`, 'i'),
    ],
  },
  {
    key: 'lowCo2Percent',
    patterns: [
      new RegExp(`\\b(?:low|lo|minimum|min|low\\s+rate|low\\s+fire|low\\s+load|load\\s+rate|load\\s+fire|combustion\\s+low|low\\s+combustion)(?:\\s+reading|\\s+readings)?\\s+(?:co2|carbon\\s+dioxide)\\b\\s*${NUMBER_CAPTURE}`, 'i'),
      new RegExp(`\\b(?:co2|carbon\\s+dioxide)\\s+(?:low|lo|minimum|min|low\\s+rate|low\\s+fire|low\\s+load|load\\s+rate|load\\s+fire)\\b\\s*${NUMBER_CAPTURE}`, 'i'),
    ],
  },
  {
    key: 'lowRatio',
    patterns: [
      new RegExp(`\\b(?:low|lo|minimum|min|low\\s+rate|low\\s+fire|low\\s+load|load\\s+rate|load\\s+fire|combustion\\s+low|low\\s+combustion)(?:\\s+reading|\\s+readings)?\\s+(?:(?:co|carbon\\s+monoxide)\\s+(?:co2|carbon\\s+dioxide)\\s+)?(?:ratio|combustion\\s+ratio|co\\s+co2\\s+ratio)\\b\\s*${NUMBER_CAPTURE}`, 'i'),
      new RegExp(`\\b(?:ratio|combustion\\s+ratio|co\\s+co2\\s+ratio)\\s+(?:low|lo|minimum|min|low\\s+rate|low\\s+fire|low\\s+load|load\\s+rate|load\\s+fire)\\b\\s*${NUMBER_CAPTURE}`, 'i'),
    ],
  },
  {
    key: 'workingPressure',
    patterns: [
      new RegExp(`\\b(?:working|operating|operation|burner|gas|dynamic|running|appliance)\\s+pressure\\b\\s*${NUMBER_CAPTURE}`, 'i'),
      new RegExp(`\\b(?:inlet|standing)\\s+pressure\\b\\s*${NUMBER_CAPTURE}`, 'i'),
      new RegExp(`\\b(?:wp|op)\\b\\s*${NUMBER_CAPTURE}`, 'i'),
      new RegExp(`\\bpressure\\b\\s*${NUMBER_CAPTURE}`, 'i'),
    ],
  },
  {
    key: 'heatInput',
    patterns: [
      new RegExp(`\\b(?:net|gross|max|maximum|nominal)?\\s*heat\\s+(?:input|in\\s+put|imput|inlet|output|rating|rate)\\b\\s*${NUMBER_CAPTURE}`, 'i'),
      new RegExp(`\\b(?:heating\\s+put|heat\\s+and\\s+put|heat\\s+in\\s+put|heat\\s+inn\\s+put|heater\\s+input|heatinput|heat\\s+imput)\\b\\s*${NUMBER_CAPTURE}`, 'i'),
      new RegExp(`\\b(?:gas\\s+rate|gas\\s+rating|rated\\s+input|rated\\s+output|rated\\s+heat\\s+input|appliance\\s+input|appliance\\s+rating|input\\s+rate|kw\\s+input|kilowatt\\s+input|kw\\s+rating|kilowatt\\s+rating)\\b\\s*${NUMBER_CAPTURE}`, 'i'),
      new RegExp(`\\binput\\b\\s*${NUMBER_CAPTURE}`, 'i'),
    ],
  },
  {
    key: 'coPpm',
    patterns: [
      new RegExp(`(?<!high\\s)(?<!hi\\s)(?<!low\\s)(?<!max\\s)(?<!min\\s)\\b(?:co|carbon\\s+monoxide)(?:\\s+ppm)?\\b\\s*${NUMBER_CAPTURE}`, 'i'),
    ],
  },
];

const SCOPED_COMBUSTION_PATTERNS = {
  coPpm: [new RegExp(`\\b(?:co|carbon\\s+monoxide)(?:\\s+ppm)?\\b\\s*${NUMBER_CAPTURE}`, 'i')],
  co2Percent: [new RegExp(`\\b(?:co2|carbon\\s+dioxide)\\b\\s*${NUMBER_CAPTURE}`, 'i')],
  ratio: [new RegExp(`\\b(?:(?:co|carbon\\s+monoxide)\\s+(?:co2|carbon\\s+dioxide)\\s+)?(?:ratio|combustion\\s+ratio|co\\s+co2\\s+ratio|co2\\s+ratio)\\b\\s*${NUMBER_CAPTURE}`, 'i')],
};

const SCOPED_PRESSURE_PATTERNS = {
  heatInput: [
    new RegExp(`\\b(?:net|gross|max|maximum|nominal)?\\s*heat\\s+(?:input|in\\s+put|imput|inlet|output|rating|rate)\\b\\s*${NUMBER_CAPTURE}`, 'i'),
    new RegExp(`\\b(?:heating\\s+put|heat\\s+and\\s+put|heat\\s+in\\s+put|heat\\s+inn\\s+put|heater\\s+input|heatinput|heat\\s+imput)\\b\\s*${NUMBER_CAPTURE}`, 'i'),
    new RegExp(`\\b(?:gas\\s+rate|gas\\s+rating|rated\\s+input|rated\\s+output|rated\\s+heat\\s+input|appliance\\s+input|appliance\\s+rating|input\\s+rate|kw\\s+input|kilowatt\\s+input|kw\\s+rating|kilowatt\\s+rating|input)\\b\\s*${NUMBER_CAPTURE}`, 'i'),
  ],
};

const COMBUSTION_BLOCK_MARKER = /\b(high|hi|maximum|max|full\s+rate|full\s+load|high\s+rate|high\s+fire|high\s+load|combustion\s+high|high\s+combustion|low|lo|minimum|min|low\s+rate|low\s+fire|low\s+load|load\s+rate|load\s+fire|combustion\s+low|low\s+combustion)\b/gi;

function normalizeTranscript(text: string) {
  return text
    .toLowerCase()
    .replace(/co₂/g, 'co2')
    .replace(/\bc\s*o\s*2\b/g, 'co2')
    .replace(/\bco\s+(?:over|to|too)\s+co\s*(?:two|to|too|2)\b/g, 'co co2')
    .replace(/\bco\s+(?:over|to|too)\s+co2\b/g, 'co co2')
    .replace(/\bco2\s+ratio\b/g, 'co co2 ratio')
    .replace(/\bco[\s-]*(?:two|to|too|2)\s+ratio\b/g, 'co co2 ratio')
    .replace(/\bco[\s-]*two\b/g, 'co2')
    .replace(/\bco[\s-]*(?:to|too)\b/g, 'co2')
    .replace(/\bcarbon\s+dioxide\b/g, 'co2')
    .replace(/\bcarbon\s+monoxide\b/g, 'co')
    .replace(/\bheating\s+put\b/g, 'heat input')
    .replace(/\bheat\s+and\s+put\b/g, 'heat input')
    .replace(/\bheat\s+(?:in|inn|and)\s+put\b/g, 'heat input')
    .replace(/\bheater\s+input\b/g, 'heat input')
    .replace(/\bheat\s+inlet\b/g, 'heat input')
    .replace(/\brated\s+output\b/g, 'heat input')
    .replace(/\bappliance\s+rating\b/g, 'heat input')
    .replace(/\bheat\s*imput\b/g, 'heat input')
    .replace(/\bheatinput\b/g, 'heat input')
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
  const normalizedWholeRaw = wholeRaw || '0';
  const whole = String(Number.parseInt(normalizedWholeRaw, 10));
  if (Number.isNaN(Number.parseInt(normalizedWholeRaw, 10))) return null;
  if (fractionRaw === undefined) return whole;
  const fraction = fractionRaw.replace(/[^0-9]/g, '');
  if (!fraction) return null;
  return `${whole}.${fraction}`;
}

function parseWholeNumberTokens(tokens: string[]) {
  if (!tokens.length) return null;

  if (tokens.length === 1 && /^(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(tokens[0])) {
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
    if (DECIMAL_TOKENS.has(token) || /^(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(token) || token in DIGIT_WORDS || token in SMALL_NUMBERS || token in TENS || token === 'hundred' || token === 'thousand') {
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
  const whole = decimalIndex === 0 ? '0' : parseWholeNumberTokens(relevant.slice(0, decimalIndex));
  const fraction = parseFractionTokens(relevant.slice(decimalIndex + 1));
  if (!whole || !fraction) return null;
  return `${whole}.${fraction}`;
}

function parseLeadingRatioPhrase(value: string) {
  const tokens = value
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9.]/g, ''))
    .filter(Boolean);

  let cursor = 0;
  while (cursor < tokens.length && FILLER_TOKENS.has(tokens[cursor])) {
    cursor += 1;
  }

  const firstToken = tokens[cursor];
  if (firstToken && /^0{2,}[0-9]+$/.test(firstToken)) {
    return `0.${firstToken}`;
  }

  const digitTokens: string[] = [];
  let digitCursor = cursor;
  while (digitCursor < tokens.length && (/^[0-9]$/.test(tokens[digitCursor]) || tokens[digitCursor] in DIGIT_WORDS)) {
    digitTokens.push(tokens[digitCursor]);
    digitCursor += 1;
  }
  const digitString = digitTokens.map((token) => (token in DIGIT_WORDS ? DIGIT_WORDS[token] : token)).join('');
  if (/^0{2,}[0-9]+$/.test(digitString)) {
    return `0.${digitString}`;
  }

  return parseLeadingNumberPhrase(value);
}

function parseNumberAt(tokens: string[], index: number) {
  const token = tokens[index];
  if (!token) return null;

  if (DECIMAL_TOKENS.has(token)) {
    const fractionTokens: string[] = [];
    let cursor = index + 1;
    while (cursor < tokens.length && (/^[0-9]+$/.test(tokens[cursor]) || tokens[cursor] in DIGIT_WORDS)) {
      fractionTokens.push(tokens[cursor]);
      cursor += 1;
    }
    const fraction = parseFractionTokens(fractionTokens);
    return fraction ? { value: `0.${fraction}`, nextIndex: cursor } : null;
  }

  const numericMatch = token.match(/^(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/);
  if (numericMatch) {
    if (tokens[index + 1] && DECIMAL_TOKENS.has(tokens[index + 1])) {
      const fractionTokens: string[] = [];
      let cursor = index + 2;
      while (cursor < tokens.length && (/^[0-9]+$/.test(tokens[cursor]) || tokens[cursor] in DIGIT_WORDS)) {
        fractionTokens.push(tokens[cursor]);
        cursor += 1;
      }
      const whole = normalizeNumericString(token);
      const fraction = parseFractionTokens(fractionTokens);
      if (whole && fraction) return { value: `${whole}.${fraction}`, nextIndex: cursor };
    }

    const value = normalizeNumericString(token);
    return value ? { value, nextIndex: index + 1 } : null;
  }

  if (token in SMALL_NUMBERS || token in TENS) {
    const wordTokens = [token];
    const nextToken = tokens[index + 1];
    if (token in TENS && nextToken && nextToken in SMALL_NUMBERS && SMALL_NUMBERS[nextToken] < 10) {
      wordTokens.push(nextToken);
    }

    const decimalIndex = index + wordTokens.length;
    if (tokens[decimalIndex] && DECIMAL_TOKENS.has(tokens[decimalIndex])) {
      const fractionTokens: string[] = [];
      let cursor = decimalIndex + 1;
      while (cursor < tokens.length && (/^[0-9]+$/.test(tokens[cursor]) || tokens[cursor] in DIGIT_WORDS)) {
        fractionTokens.push(tokens[cursor]);
        cursor += 1;
      }
      const whole = parseWholeNumberTokens(wordTokens);
      const fraction = parseFractionTokens(fractionTokens);
      if (whole && fraction) return { value: `${whole}.${fraction}`, nextIndex: cursor };
    }

    const value = parseWholeNumberTokens(wordTokens);
    return value ? { value, nextIndex: index + wordTokens.length } : null;
  }

  return null;
}

function extractOrderedNumbers(text: string) {
  const tokens = text
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9.]/g, ''))
    .filter(Boolean);

  const values: string[] = [];
  let cursor = 0;
  while (cursor < tokens.length) {
    const parsed = parseNumberAt(tokens, cursor);
    if (!parsed) {
      cursor += 1;
      continue;
    }
    values.push(parsed.value);
    cursor = Math.max(parsed.nextIndex, cursor + 1);
  }

  return values;
}

function extractFieldValue(text: string, patterns: RegExp[], valueKind: 'number' | 'ratio' = 'number') {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const parsed = valueKind === 'ratio' ? parseLeadingRatioPhrase(match[1]) : parseLeadingNumberPhrase(match[1]);
    if (parsed) return parsed;
  }
  return null;
}

export function hasParsedCp12VoiceReadings(parsed: Cp12VoiceReadingsParsed) {
  return Object.values(parsed).some((value) => Boolean(value && value.trim()));
}

function getCombustionMarkerKind(marker: string): 'high' | 'low' {
  return /\b(?:low|lo|minimum|min|load)\b/.test(marker) ? 'low' : 'high';
}

function extractCombustionValuesFromText(text: string) {
  return {
    coPpm: extractFieldValue(text, SCOPED_COMBUSTION_PATTERNS.coPpm),
    co2Percent: extractFieldValue(text, SCOPED_COMBUSTION_PATTERNS.co2Percent),
    ratio: extractFieldValue(text, SCOPED_COMBUSTION_PATTERNS.ratio, 'ratio'),
  };
}

function applyCombustionBlockParsing(parsed: Cp12VoiceReadingsParsed, normalized: string) {
  const markers = Array.from(normalized.matchAll(COMBUSTION_BLOCK_MARKER)).map((match) => ({
    kind: getCombustionMarkerKind(match[0]),
    index: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));

  if (!markers.length) return parsed;

  const nextParsed = { ...parsed };
  markers.forEach((marker, index) => {
    const nextMarker = markers[index + 1];
    const segment = normalized.slice(marker.end, nextMarker?.index ?? normalized.length);
    const values = extractCombustionValuesFromText(segment);

    if (marker.kind === 'high') {
      nextParsed.highCoPpm = nextParsed.highCoPpm ?? values.coPpm;
      nextParsed.highCo2Percent = nextParsed.highCo2Percent ?? values.co2Percent;
      nextParsed.highRatio = nextParsed.highRatio ?? values.ratio;
      return;
    }

    nextParsed.lowCoPpm = nextParsed.lowCoPpm ?? values.coPpm;
    nextParsed.lowCo2Percent = nextParsed.lowCo2Percent ?? values.co2Percent;
    nextParsed.lowRatio = nextParsed.lowRatio ?? values.ratio;
  });

  return nextParsed;
}

function applyScope(parsed: Cp12VoiceReadingsParsed, normalized: string, scope: Cp12VoiceReadingScope) {
  if (scope === 'all') return parsed;

  const scoped: Cp12VoiceReadingsParsed = { ...EMPTY_PARSED };
  if (scope === 'pressure') {
    scoped.workingPressure = parsed.workingPressure;
    scoped.heatInput = parsed.heatInput ?? extractFieldValue(normalized, SCOPED_PRESSURE_PATTERNS.heatInput);
    return scoped;
  }

  if (scope === 'combustion') {
    scoped.highCoPpm = parsed.highCoPpm;
    scoped.highCo2Percent = parsed.highCo2Percent;
    scoped.highRatio = parsed.highRatio;
    scoped.lowCoPpm = parsed.lowCoPpm;
    scoped.lowCo2Percent = parsed.lowCo2Percent;
    scoped.lowRatio = parsed.lowRatio;
    return scoped;
  }

  const coPpm = parsed.coPpm ?? extractFieldValue(normalized, SCOPED_COMBUSTION_PATTERNS.coPpm);
  const co2Percent = extractFieldValue(normalized, SCOPED_COMBUSTION_PATTERNS.co2Percent);
  const ratio = extractFieldValue(normalized, SCOPED_COMBUSTION_PATTERNS.ratio, 'ratio');

  if (scope === 'high') {
    scoped.highCoPpm = parsed.highCoPpm ?? coPpm;
    scoped.highCo2Percent = parsed.highCo2Percent ?? co2Percent;
    scoped.highRatio = parsed.highRatio ?? ratio;
    return scoped;
  }

  scoped.lowCoPpm = parsed.lowCoPpm ?? coPpm;
  scoped.lowCo2Percent = parsed.lowCo2Percent ?? co2Percent;
  scoped.lowRatio = parsed.lowRatio ?? ratio;
  return scoped;
}

function applyOrderedScopeFallback(
  parsed: Cp12VoiceReadingsParsed,
  normalized: string,
  scope: Cp12VoiceReadingScope,
) {
  if (scope === 'all') return { parsed, used: false };

  const values = extractOrderedNumbers(normalized);
  if (!values.length) return { parsed, used: false };

  const nextParsed = { ...parsed };
  let used = false;
  const applyByOrder = (keys: Array<keyof Cp12VoiceReadingsParsed>, offset = 0) => {
    keys.forEach((key, index) => {
      const value = values[index + offset];
      if (!nextParsed[key] && value) {
        nextParsed[key] = value;
        used = true;
      }
    });
  };

  if (scope === 'pressure') {
    applyByOrder(['workingPressure', 'heatInput']);
    return { parsed: nextParsed, used };
  }

  if (scope === 'high') {
    applyByOrder(['highCoPpm', 'highCo2Percent', 'highRatio']);
    return { parsed: nextParsed, used };
  }

  if (scope === 'low') {
    applyByOrder(['lowCoPpm', 'lowCo2Percent', 'lowRatio']);
    return { parsed: nextParsed, used };
  }

  applyByOrder(['highCoPpm', 'highCo2Percent', 'highRatio']);
  applyByOrder(['lowCoPpm', 'lowCo2Percent', 'lowRatio'], 3);
  return { parsed: nextParsed, used };
}

export function parseCp12VoiceReadings(
  transcript: string,
  options: { scope?: Cp12VoiceReadingScope } = {},
): Cp12VoiceReadingsResult {
  const normalized = normalizeTranscript(transcript);
  let parsed: Cp12VoiceReadingsParsed = { ...EMPTY_PARSED };
  const warnings: string[] = [];
  const scope = options.scope ?? 'all';

  if (!normalized) {
    return {
      transcript: transcript.trim(),
      parsed,
      warnings: ['No transcript was returned from the recording.'],
    };
  }

  for (const field of FIELD_PATTERNS) {
    parsed[field.key] = extractFieldValue(normalized, field.patterns, field.key.toLowerCase().includes('ratio') ? 'ratio' : 'number');
  }

  parsed = applyCombustionBlockParsing(parsed, normalized);
  parsed = applyScope(parsed, normalized, scope);
  const orderedFallback = applyOrderedScopeFallback(parsed, normalized, scope);
  parsed = orderedFallback.parsed;
  if (orderedFallback.used) {
    warnings.push('Filled missing values by recording order. Review before applying.');
  }

  if ((scope === 'all' || scope === 'combustion') && /(?<!high\s)(?<!low\s)\bco2\b/.test(normalized) && !parsed.highCo2Percent && !parsed.lowCo2Percent) {
    warnings.push('Ignored CO2 value because CP12 combustion readings need high or low context.');
  }

  if ((scope === 'all' || scope === 'combustion') && /(?<!high\s)(?<!low\s)\bratio\b/.test(normalized) && !parsed.highRatio && !parsed.lowRatio) {
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
