/**
 * Turn a caught error into something worth showing a person.
 *
 * Two things reach these catch blocks. Our own validation messages — "CP12
 * validation failed: Engineer signature is required" — are genuinely useful and
 * should be shown. Everything else is noise: in production Next.js replaces a
 * message thrown from a Server Action with an opaque digest, and in development
 * it passes through database and runtime internals verbatim. Neither helps
 * anyone, and the second leaks schema details.
 *
 * So this shows a message only when it looks like one we wrote for a user, and
 * falls back otherwise. It is a net, not a substitute for returning expected
 * outcomes as values — see AuthActionResult in @/server/auth for that pattern,
 * which is the better fix where a condition is predictable.
 */

/** Fragments that mean the text was written for a developer, not a user. */
const INTERNAL_MARKERS = [
  'pgrst',
  'duplicate key',
  'violates',
  'constraint',
  'relation "',
  'column "',
  'syntax error',
  'jwt',
  'supabase',
  'fetch failed',
  'econnrefused',
  'enotfound',
  'socket hang up',
  'network error',
  'server components render',
  'server action',
  'digest',
  'typeerror',
  'referenceerror',
  'cannot read propert',
  'undefined is not',
  'is not a function',
  'unexpected token',
  'stack',
  '    at ',
  'rls',
  'row-level security',
  'service_role',
  'anon key',
];

const MAX_SENSIBLE_LENGTH = 200;

export function toUserMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const message = raw.trim();
  if (!message) return fallback;

  // A wall of text is a stack or a provider dump, not a sentence.
  if (message.length > MAX_SENSIBLE_LENGTH) return fallback;
  if (message.includes('\n')) return fallback;

  const lowered = message.toLowerCase();
  if (INTERNAL_MARKERS.some((marker) => lowered.includes(marker))) return fallback;

  // Bare codes and identifiers tell a user nothing.
  if (/^[A-Z0-9_]+$/.test(message)) return fallback;
  if (/^\d+$/.test(message)) return fallback;

  return message;
}
