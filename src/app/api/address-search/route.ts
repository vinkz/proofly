import { NextResponse } from 'next/server';

import {
  normalizeAddressLookupResult,
  normalizeAddressLookupSuggestions,
  type IdealAutocompleteResponse,
  type IdealResolveResponse,
} from '@/lib/address-lookup';
import { consumePublicActionRateLimit } from '@/lib/public-action-security';
import { clientKeyFromRequest, rateLimit } from '@/lib/rate-limit';

// This endpoint is reachable unauthenticated (the public /request booking page
// uses it), and each call bills the Ideal Postcodes key. Cap per-IP throughput so
// a scripted loop can't drain the key balance. Generous enough for real typing.
const RATE_LIMIT_MAX = 40;
const RATE_LIMIT_WINDOW_MS = 10_000;

const getApiKey = () => process.env.IDEAL_POSTCODES_API_KEY?.trim() || '';
const isAddressLookupDisabled = () =>
  process.env.ADDRESS_LOOKUP_ENABLED?.trim().toLowerCase() === 'false' ||
  process.env.DISABLE_ADDRESS_LOOKUP?.trim().toLowerCase() === 'true';
const IDEAL_POSTCODES_BASE_URL = 'https://api.ideal-postcodes.co.uk/v1';
const MIN_QUERY_LENGTH = 3;

function getProviderFallback(status: number, resource: 'search' | 'address') {
  switch (status) {
    case 400:
      return resource === 'search'
        ? 'Enter at least 3 characters to search addresses'
        : 'We could not load that address. Enter it manually instead.';
    case 401:
    case 403:
    case 402:
      return 'Address lookup is temporarily unavailable. Enter the address manually instead.';
    case 404:
      return resource === 'search'
        ? 'No addresses found. Try a postcode or enter the address manually.'
        : 'We could not find that address. Enter it manually instead.';
    case 429:
    case 503:
      return 'Address lookup is busy. Try again shortly or enter the address manually.';
    default:
      return 'Address lookup is unavailable. Enter the address manually instead.';
  }
}

function getClientStatus(status: number) {
  switch (status) {
    case 400:
    case 401:
    case 402:
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
  // Provider bodies can contain key, quota, or implementation details. Keep
  // those server-side and give the visitor a useful manual-entry recovery path.
  console.warn('Address lookup provider request failed', {
    resource,
    status: response.status,
  });
  return fallback;
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
  const clientIdentifier = clientKeyFromRequest(request);
  const limit = rateLimit(
    `address-search:${clientIdentifier}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
  );
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many address lookups. Please slow down and try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }
  const durableLimit = await consumePublicActionRateLimit({
    action: 'address_search_ip',
    identifier: clientIdentifier,
    limit: RATE_LIMIT_MAX,
    windowSeconds: RATE_LIMIT_WINDOW_MS / 1000,
  });
  if (!durableLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many address lookups. Please slow down and try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(durableLimit.retryAfterSeconds) } },
    );
  }

  if (isAddressLookupDisabled()) {
    return NextResponse.json({ error: 'Address lookup disabled' }, { status: 403 });
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
