import { describe, expect, it } from 'vitest';

import { normalizeAddressLookupResult, normalizeAddressLookupSuggestions } from '@/lib/address-lookup';

describe('normalizeAddressLookupSuggestions', () => {
  it('returns unique getAddress suggestions for the postcode dropdown', () => {
    const suggestions = normalizeAddressLookupSuggestions({
      suggestions: [
        { id: 'one', address: '10 Downing Street, Westminster, London, SW1A 2AA' },
        { id: 'one', address: '10 Downing Street, Westminster, London, SW1A 2AA' },
        { id: 'two', address: '11 Downing Street, Westminster, London, SW1A 2AA' },
      ],
    });

    expect(suggestions).toEqual([
      { id: 'one', address: '10 Downing Street, Westminster, London, SW1A 2AA', label: '10 Downing Street, Westminster, London, SW1A 2AA' },
      { id: 'two', address: '11 Downing Street, Westminster, London, SW1A 2AA', label: '11 Downing Street, Westminster, London, SW1A 2AA' },
    ]);
  });
});

describe('normalizeAddressLookupResult', () => {
  it('maps getAddress details into the CP12 address fields', () => {
    const result = normalizeAddressLookupResult({
      id: 'addr_123',
      line_1: 'Flat 2',
      line_2: '10 Downing Street',
      town_or_city: 'London',
      postcode: 'sw1a2aa',
      sub_building_name: 'Flat 2',
    });

    expect(result).toEqual({
      id: 'addr_123',
      name: 'Flat 2',
      line1: 'Flat 2',
      line2: '10 Downing Street',
      city: 'London',
      postcode: 'SW1A 2AA',
      summary: 'Flat 2, 10 Downing Street, London',
      label: 'Flat 2, 10 Downing Street, London, SW1A 2AA',
    });
  });
});
