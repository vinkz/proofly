export type AddressLookupSuggestion = {
  id: string;
  address: string;
  label: string;
};

export type AddressLookupResult = {
  id: string;
  name: string;
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  summary: string;
  label: string;
};

export type IdealAutocompleteHit = {
  id?: string;
  suggestion?: string;
};

export type IdealAutocompleteResponse = {
  result?: {
    hits?: IdealAutocompleteHit[];
  };
  code?: number;
  message?: string;
};

export type IdealResolveResponse = {
  result?: {
    id?: string;
    line_1?: string;
    line_2?: string;
    line_3?: string;
    post_town?: string;
    postcode?: string;
    building_name?: string;
    building_number?: string;
    sub_building_name?: string;
    organisation_name?: string;
    premise?: string;
  };
  code?: number;
  message?: string;
};

const pickText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
};

export function normalizeUkPostcode(value: string) {
  const compact = value.replace(/\s+/g, '').toUpperCase();
  if (compact.length <= 3) return compact;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function normalizeAddressLookupSuggestions(response: IdealAutocompleteResponse) {
  const seen = new Set<string>();
  return (response.result?.hits ?? [])
    .map((hit) => {
      const id = hit.id?.trim();
      const suggestion = hit.suggestion?.trim();
      if (!id || !suggestion) return null;
      return { id, address: suggestion, label: suggestion };
    })
    .filter((suggestion): suggestion is AddressLookupSuggestion => Boolean(suggestion))
    .filter((suggestion) => {
      const key = `${suggestion.id}|${suggestion.address}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function normalizeAddressLookupResult(response: IdealResolveResponse): AddressLookupResult | null {
  const result = response.result;
  if (!result) return null;

  const line1 = pickText(result.line_1);
  const line2 = [result.line_2, result.line_3].filter((value) => value && value.trim()).join(', ');
  const city = pickText(result.post_town);
  const postcode = normalizeUkPostcode(pickText(result.postcode));
  const summary = [line1, line2, city].filter(Boolean).join(', ');

  if (!line1) return null;

  return {
    id: String(result.id ?? summary),
    name: pickText(result.sub_building_name, result.organisation_name, result.building_name, result.building_number, result.premise),
    line1,
    line2,
    city,
    postcode,
    summary,
    label: [summary, postcode].filter(Boolean).join(', '),
  };
}
