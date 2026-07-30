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

/**
 * Known failures that have a useful recovery path. These run before the
 * internal-marker filter so a database constraint can become product language
 * without exposing the constraint itself.
 */
const USER_MESSAGE_RULES: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern:
      /duplicate key.*certificate.*job|certificate.*already (?:exists|generated)|certificates?_job[^ ]*.*unique/i,
    message: 'A certificate has already been generated for this job. Open the job to view or resend it.',
  },
  {
    pattern: /duplicate key.*invoice|invoice.*already (?:exists|created)/i,
    message: 'An invoice already exists for this job. Open the existing invoice to continue.',
  },
  {
    pattern:
      /unauthori[sz]ed|authentication required|not authenticated|requires authenticated user|auth session missing|rls mismatch/i,
    message: 'Your session has expired. Sign in again and retry this action.',
  },
  {
    pattern: /job not found|job is no longer available/i,
    message: 'This job is no longer available, or you do not have access to it.',
  },
  {
    pattern: /invoice not found/i,
    message: 'This invoice is no longer available, or you do not have access to it.',
  },
  {
    pattern: /client not found/i,
    message: 'This landlord or client is no longer available. Choose another record or add it again.',
  },
  {
    pattern: /property not found/i,
    message: 'This property is no longer available. Choose another property or enter the address again.',
  },
  {
    pattern: /request not found/i,
    message: 'This request is no longer available. Refresh the page and choose another request.',
  },
  {
    pattern: /template not found/i,
    message: 'This template is no longer available. Choose another template and try again.',
  },
  {
    pattern: /no pdf (?:is )?(?:available|found)|report not found/i,
    message: 'No PDF is available yet. Generate the document first, then try again.',
  },
  {
    pattern: /prefill link has expired|signature link is no longer active/i,
    message: 'This link has expired. Ask the engineer to send a new one.',
  },
  {
    pattern: /too many requests|rate limit/i,
    message: 'Too many attempts. Wait a little while, then try again.',
  },
];

/** Fragments that mean the text was written for a developer, not a user. */
const INTERNAL_MARKERS = [
  'pgrst',
  'duplicate key',
  'violates',
  'constraint',
  'permission denied',
  'invalid input syntax',
  'null value in column',
  'foreign key',
  'schema cache',
  'could not find the',
  'relation "',
  'column "',
  'syntax error',
  'sqlstate',
  'postgres',
  'jwt',
  'supabase',
  'storage bucket',
  'bucket not found',
  'stripe',
  'resend',
  'api key',
  'price_id',
  'service role',
  'fetch failed',
  'failed to fetch',
  'econnrefused',
  'enotfound',
  'socket hang up',
  'network error',
  'internal server error',
  'status code',
  'request id',
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
  'next_redirect',
];

const MAX_SENSIBLE_LENGTH = 200;

export function toUserMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const message = raw.trim();
  if (!message) return fallback;

  // A wall of text is a stack or a provider dump, not a sentence.
  if (message.length > MAX_SENSIBLE_LENGTH) return fallback;
  if (message.includes('\n')) return fallback;

  for (const rule of USER_MESSAGE_RULES) {
    if (rule.pattern.test(message)) return rule.message;
  }

  const lowered = message.toLowerCase();
  if (INTERNAL_MARKERS.some((marker) => lowered.includes(marker))) return fallback;

  // Bare codes and identifiers tell a user nothing.
  if (/^[A-Z0-9_]+$/.test(message)) return fallback;
  if (/^\d+$/.test(message)) return fallback;

  return message;
}
