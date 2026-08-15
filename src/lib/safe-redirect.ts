/**
 * Paths we are willing to send a browser to.
 *
 * Seven places independently wrote `value.startsWith('/') && !value.startsWith('//')`
 * and all of them were wrong in the same way. For a special scheme the URL
 * parser treats a backslash exactly like a forward slash, so `/\evil.com`
 * passes both of those checks and then resolves to `https://evil.com/`:
 *
 *   new URL('/\\evil.com', 'https://certnow.uk').href === 'https://evil.com/'
 *
 * On an auth callback that is a phishing primitive — the link carries our
 * domain and lands on someone else's. It reached production, so this lives in
 * one tested place rather than being re-derived at each call site.
 */

/**
 * Rejected outright. A browser strips tabs and newlines before deciding what a
 * URL means, so a check run before that removal can be reading a different
 * string than the one that gets resolved.
 */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * The path, if it is safe to redirect to, else `fallback`.
 *
 * Safe means same-origin, and still same-origin after the URL parser has had it.
 */
export function safeInternalPath<T extends string | null>(
  value: unknown,
  fallback: T,
): string | T {
  if (typeof value !== 'string') return fallback;

  const path = value.trim();
  if (!path.startsWith('/')) return fallback;

  // `//host` is scheme-relative, and `/\host` becomes scheme-relative once the
  // backslash is normalised. Reject a backslash anywhere: no legitimate path
  // here contains one, and partial checks are what produced this bug.
  if (path.includes('\\')) return fallback;
  if (path.startsWith('//')) return fallback;

  if (CONTROL_CHARACTERS.test(path)) return fallback;

  return path;
}
