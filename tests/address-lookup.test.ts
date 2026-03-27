import { describe, expect, it } from 'vitest';

import { normalizeAddressLookupResult, normalizeAddressLookupSuggestions } from '@/lib/address-lookup';

describe('normalizeAddressLookupSuggestions', () => {
  it('returns unique Ideal Postcodes suggestions for the dropdown', () => {
    const suggestions = normalizeAddressLookupSuggestions({
      result: {
        hits: [
          { id: 'paf_1', suggestion: '10 Downing Street, Westminster, London, SW1A 2AA' },
          { id: 'paf_1', suggestion: '10 Downing Street, Westminster, London, SW1A 2AA' },
          { id: 'paf_2', suggestion: '11 Downing Street, Westminster, London, SW1A 2AA' },
        ],
      },
    });

    expect(suggestions).toEqual([
      { id: 'paf_1', address: '10 Downing Street, Westminster, London, SW1A 2AA', label: '10 Downing Street, Westminster, London, SW1A 2AA' },
      { id: 'paf_2', address: '11 Downing Street, Westminster, London, SW1A 2AA', label: '11 Downing Street, Westminster, London, SW1A 2AA' },
    ]);
  });
});

describe('normalizeAddressLookupResult', () => {
  it('maps Ideal Postcodes resolve data into the CP12 address fields', () => {
    const result = normalizeAddressLookupResult({
      result: {
        id: 'paf_824800',
        line_1: '10 Downing Street',
        line_2: 'Flat 2',
        post_town: 'London',
        postcode: 'sw1a2aa',
        sub_building_name: 'Flat 2',
      },
    });

    expect(result).toEqual({
      id: 'paf_824800',
      name: 'Flat 2',
      line1: '10 Downing Street',
      line2: 'Flat 2',
      city: 'London',
      postcode: 'SW1A 2AA',
      summary: '10 Downing Street, Flat 2, London',
      label: '10 Downing Street, Flat 2, London, SW1A 2AA',
    });
  });
});
