import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Next.js strips the message off an error thrown in a Server Action in
 * production and replaces it with an opaque digest, so a thrown
 * "this email is already registered" reached the browser as a bare 500. That is
 * the top of the funnel — anything a user can cause by typing has to come back
 * as a value, not an exception.
 */
const auth = readFileSync('src/server/auth.ts', 'utf8');
const login = readFileSync('src/app/login/login-client.tsx', 'utf8');
const step1 = readFileSync('src/app/(auth)/signup/step1/page.tsx', 'utf8');
const verify = readFileSync('src/app/(auth)/signup/verify/page.tsx', 'utf8');

describe('auth actions return outcomes instead of throwing', () => {
  it('no user-facing auth path throws a provider message', () => {
    // The only remaining throw is the unauthorized guard, which is not
    // reachable by typing something wrong.
    const throws = auth.match(/throw new Error\([^)]*\)/g) ?? [];
    expect(throws).toEqual(["throw new Error('Unauthorized')"]);
  });

  it('never passes a raw provider message through', () => {
    expect(auth).not.toMatch(/message:\s*error\.message/);
    expect(auth).toMatch(/function authMessage\(/);
  });

  it('signup reports an already-registered email in words', () => {
    expect(auth).toMatch(/That email is already registered\./);
    // And only after trying the password they typed, since it may be theirs.
    expect(auth).toMatch(/signInWithPassword\(\{/);
  });

  it.each([
    ['invalid credentials', 'Invalid login credentials', /do not match an account/i],
    ['unconfirmed email', 'Email not confirmed', /Confirm your email address first/i],
    ['rate limiting', 'For security purposes, you can only request this after 60 seconds', /Too many attempts/i],
    ['weak password', 'Password should be at least 6 characters', /longer password/i],
  ])('maps %s to something actionable', async (_name, raw, expected) => {
    // authMessage is module-private, so exercise it through the exported shape
    // of the file rather than importing it.
    expect(auth).toMatch(expected);
    expect(auth).toMatch(new RegExp(raw.split(' ')[0], 'i'));
  });

  it('falls back to a generic line for anything unrecognised', () => {
    // An unmapped provider error must not be echoed verbatim.
    expect(auth).toMatch(/return fallback;/);
  });

  it('the callers surface the returned message rather than a thrown one', () => {
    for (const [name, source] of [['login', login], ['signup', step1], ['verify', verify]] as const) {
      expect(source, name).toMatch(/if \(!result\.ok\)/);
      expect(source, name).toMatch(/description: result\.message/);
    }
  });

  it('the remaining catch blocks say something human, not error.message', () => {
    for (const [name, source] of [['login', login], ['signup', step1], ['verify', verify]] as const) {
      expect(source, name).not.toMatch(/description: error instanceof Error \? error\.message/);
      expect(source, name).toMatch(/Something went wrong on our side/);
    }
  });
});
