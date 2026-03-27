import { NextResponse } from 'next/server';

import {
  normalizeAddressLookupResult,
  normalizeAddressLookupSuggestions,
  type IdealAutocompleteResponse,
  type IdealResolveResponse,
} from '@/lib/address-lookup';

const getApiKey = () => process.env.IDEAL_POSTCODES_API_KEY?.trim() || '';
const isAddressLookupDisabled = () => process.env.DISABLE_ADDRESS_LOOKUP?.trim().toLowerCase() === 'true';
const IDEAL_POSTCODES_BASE_URL = 'https://api.ideal-postcodes.co.uk/v1';
const MIN_QUERY_LENGTH = 3;

function getProviderFallback(status: number, resource: 'search' | 'address') {
  switch (status) {
    case 400:
      return resource === 'search' ? 'Enter at least 3 characters to search addresses' : 'Invalid address lookup request';
    case 401:
    case 403:
      return 'Address lookup provider rejected the API key';
    case 404:
      return resource === 'search' ? 'No addresses found' : 'Address not found';
    case 429:
    case 503:
      return 'Address lookup rate limit reached';
    default:
      return `Address lookup failed (${status})`;
  }
}

function getClientStatus(status: number) {
  switch (status) {
    case 400:
    case 401:
    case 403:
    case 404:
    case 429:
    case 503:
      return status;
    default:
      return 502;
  }
}

async function buildProviderError(response: Response, resource: 'search' | 'address') {
  const fallback = getProviderFallback(response.status, resource);
  const textResponse = response.clone();

  try {
    const payload = await response.json();
    const message =
      typeof payload?.message === 'string'
        ? payload.message
        : typeof payload?.Message === 'string'
          ? payload.Message
          : typeof payload?.detail === 'string'
            ? payload.detail
            : '';
    return `${fallback}${message && message !== fallback ? `: ${message}` : ''}`;
  } catch {
    try {
      const text = (await textResponse.text()).trim();
      return `${fallback}${text && text !== fallback ? `: ${text}` : ''}`;
    } catch {
      return fallback;
    }
  }
}

async function buildProviderFailure(response: Response, resource: 'search' | 'address') {
  return {
    error: await buildProviderError(response, resource),
    status: getClientStatus(response.status),
  };
}

async function fetchJson(url: URL) {
  return fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
}

export async function GET(request: Request) {
  if (isAddressLookupDisabled()) {
    return NextResponse.json({ error: 'Address lookup is disabled' }, { status: 503 });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: 'Address lookup is not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() ?? '';
  const id = searchParams.get('id')?.trim() ?? '';

  if (id) {
    const detailsUrl = new URL(`${IDEAL_POSTCODES_BASE_URL}/autocomplete/addresses/${encodeURIComponent(id)}/gbr`);
    detailsUrl.searchParams.set('api_key', apiKey);

    try {
      const response = await fetchJson(detailsUrl);

      if (!response.ok) {
        const failure = await buildProviderFailure(response, 'address');
        return NextResponse.json({ error: failure.error }, { status: failure.status });
      }

      const payload = (await response.json()) as IdealResolveResponse;
      const address = normalizeAddressLookupResult(payload);

      if (!address) {
        return NextResponse.json({ error: 'Address details were incomplete' }, { status: 404 });
      }

      return NextResponse.json({ address }, { status: 200 });
    } catch (error) {
      console.error('Address details lookup error', error);
      return NextResponse.json({ error: 'Unable to reach address lookup provider' }, { status: 502 });
    }
  }

  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ error: 'Enter at least 3 characters to search addresses' }, { status: 400 });
  }

  const searchUrl = new URL(`${IDEAL_POSTCODES_BASE_URL}/autocomplete/addresses`);
  searchUrl.searchParams.set('api_key', apiKey);
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('limit', '8');

  try {
    const response = await fetchJson(searchUrl);

    if (!response.ok) {
      const failure = await buildProviderFailure(response, 'search');
      return NextResponse.json({ error: failure.error }, { status: failure.status });
    }

    const payload = (await response.json()) as IdealAutocompleteResponse;
    const suggestions = normalizeAddressLookupSuggestions(payload);

    return NextResponse.json({ suggestions }, { status: 200 });
  } catch (error) {
    console.error('Address lookup error', error);
    return NextResponse.json({ error: 'Unable to reach address lookup provider' }, { status: 502 });
  }
}
