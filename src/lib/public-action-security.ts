import 'server-only';

import { createHmac } from 'node:crypto';

import { headers } from 'next/headers';

import { env } from '@/lib/env';
import { supabaseServerServiceRole } from '@/lib/supabaseServer';

type RateLimitRpcResult = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
};

type RpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export type PublicActionRateLimit = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const firstForwardedAddress = (value: string | null) => value?.split(',')[0]?.trim() || '';

/**
 * Resolve the edge-provided client address for a public Server Action. The value
 * is never persisted directly; it is HMACed before it reaches the database.
 */
export async function publicActionClientIdentifier() {
  const requestHeaders = await headers();
  return (
    firstForwardedAddress(requestHeaders.get('x-forwarded-for')) ||
    requestHeaders.get('x-real-ip')?.trim() ||
    'unknown'
  );
}

function digestIdentifier(identifier: string) {
  return createHmac('sha256', env.SUPABASE_SERVICE_ROLE_KEY)
    .update(`certnow-public-action-v1:${identifier.trim().toLowerCase()}`)
    .digest('hex');
}

/**
 * Consume one durable fixed-window bucket through a service-role-only RPC.
 * Fail closed: email/database-writing public actions must not silently become
 * unlimited if the backing migration is missing or Supabase is unavailable.
 */
export async function consumePublicActionRateLimit(input: {
  action: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}): Promise<PublicActionRateLimit> {
  const admin = (await supabaseServerServiceRole()) as unknown as RpcClient;
  const { data, error } = await admin.rpc('consume_public_action_rate_limit', {
    p_action: input.action,
    p_key_hash: digestIdentifier(input.identifier),
    p_limit: input.limit,
    p_window_seconds: input.windowSeconds,
  });

  if (error) {
    console.error('[public-action-security] durable rate limit failed', {
      action: input.action,
      error: error.message,
    });
    throw new Error('This form is temporarily unavailable. Please try again shortly.');
  }

  const row = (Array.isArray(data) ? data[0] : data) as RateLimitRpcResult | null;
  if (!row || typeof row.allowed !== 'boolean') {
    throw new Error('This form is temporarily unavailable. Please try again shortly.');
  }

  return {
    allowed: row.allowed,
    remaining: Number(row.remaining) || 0,
    retryAfterSeconds: Number(row.retry_after_seconds) || 0,
  };
}

export async function assertPublicActionAllowed(input: {
  action: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}) {
  const result = await consumePublicActionRateLimit(input);
  if (!result.allowed) {
    throw new Error('Too many requests. Please wait a little while and try again.');
  }
  return result;
}
