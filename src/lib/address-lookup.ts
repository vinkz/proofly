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

export type GetAddressAutocompleteSuggestion = {
  id?: string;
  address?: string;
};

export type GetAddressAutocompleteResponse = {
  suggestions?: GetAddressAutocompleteSuggestion[];
};

export type GetAddressDetailsResponse = {
  id?: string;
  postcode?: string;
  line_1?: string;
  line_2?: string;
  line_3?: string;
  line_4?: string;
  locality?: string;
  town_or_city?: string;
  county?: string;
  building_name?: string;
  building_number?: string;
  sub_building_name?: string;
  sub_building_number?: string;
  formatted_address?: string[];
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

export function normalizeAddressLookupSuggestions(response: GetAddressAutocompleteResponse) {
  const seen = new Set<string>();
  return (response.suggestions ?? [])
    .map((suggestion) => {
      const id = suggestion.id?.trim();
      const address = suggestion.address?.trim();
      if (!id || !address) return null;
      return { id, address, label: address };
    })
    .filter((suggestion): suggestion is AddressLookupSuggestion => Boolean(suggestion))
    .filter((suggestion) => {
      const key = `${suggestion.id}|${suggestion.address}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function normalizeAddressLookupResult(result: GetAddressDetailsResponse): AddressLookupResult | null {
  const line1 = pickText(result.line_1, result.formatted_address?.[0]);
  const line2 = [result.line_2, result.line_3, result.line_4, result.locality].filter((value) => value && value.trim()).join(', ');
  const city = pickText(result.town_or_city, result.formatted_address?.[3], result.county);
  const postcode = normalizeUkPostcode(pickText(result.postcode, result.formatted_address?.at(-1)));
  const summary = [line1, line2, city].filter(Boolean).join(', ');

  if (!line1) return null;

  return {
    id: String(result.id ?? summary),
    name: pickText(result.sub_building_name, result.building_name, result.sub_building_number, result.building_number),
    line1,
    line2,
    city,
    postcode,
    summary,
    label: [summary, postcode].filter(Boolean).join(', '),
  };
}
