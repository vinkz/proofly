import { NextResponse } from 'next/server';

import {
  normalizeAddressLookupResult,
  normalizeAddressLookupSuggestions,
  normalizeUkPostcode,
  type GetAddressAutocompleteResponse,
  type GetAddressDetailsResponse,
} from '@/lib/address-lookup';

const getApiKey = () => process.env.GETADDRESS_API_KEY?.trim() || '';

async function buildProviderError(response: Response, fallback: string) {
  try {
    const payload = await response.json();
    const message =
      typeof payload?.Message === 'string'
        ? payload.Message
        : typeof payload?.message === 'string'
          ? payload.message
          : '';
    return `${fallback}${message ? `: ${message}` : ''}`;
  } catch {
    return fallback;
  }
}

export async function GET(request: Request) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: 'Address lookup is not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const postcodeParam = searchParams.get('postcode') ?? '';
  const id = searchParams.get('id')?.trim() ?? '';

  if (id) {
    const detailsUrl = new URL(`https://api.getAddress.io/get/${encodeURIComponent(id)}`);
    detailsUrl.searchParams.set('api-key', apiKey);

    try {
      const response = await fetch(detailsUrl, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (!response.ok) {
        const error = await buildProviderError(response, `Address lookup failed (${response.status})`);
        return NextResponse.json({ error }, { status: 502 });
      }

      const payload = (await response.json()) as GetAddressDetailsResponse;
      const address = normalizeAddressLookupResult(payload);

      if (!address) {
        return NextResponse.json({ error: 'Address details were incomplete' }, { status: 404 });
      }

      return NextResponse.json({ address }, { status: 200 });
    } catch (error) {
      console.error('Address details lookup error', error);
      return NextResponse.json({ error: 'Address lookup failed' }, { status: 502 });
    }
  }

  const postcode = normalizeUkPostcode(postcodeParam.trim());
  if (!postcode) {
    return NextResponse.json({ error: 'Postcode is required' }, { status: 400 });
  }

  const searchUrl = new URL(`https://api.getAddress.io/autocomplete/${encodeURIComponent(postcode)}`);
  searchUrl.searchParams.set('api-key', apiKey);
  searchUrl.searchParams.set('all', 'true');
  searchUrl.searchParams.set('show-postcode', 'true');

  try {
    const response = await fetch(searchUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      const error = await buildProviderError(response, `Address lookup failed (${response.status})`);
      return NextResponse.json({ error }, { status: 502 });
    }

    const payload = (await response.json()) as GetAddressAutocompleteResponse;
    const suggestions = normalizeAddressLookupSuggestions(payload);

    return NextResponse.json({ suggestions }, { status: 200 });
  } catch (error) {
    console.error('Address lookup error', error);
    return NextResponse.json({ error: 'Address lookup failed' }, { status: 502 });
  }
}
