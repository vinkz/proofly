import { describe, expect, it } from 'vitest';

import { toUserMessage } from '@/lib/user-errors';

/**
 * Catch blocks across the app used to print error.message straight into a
 * toast. In production Next.js replaces a message thrown from a Server Action
 * with an opaque digest, and in development it passes database and runtime
 * internals through verbatim — so the user saw either noise or schema details.
 */
describe('toUserMessage', () => {
  it('keeps messages we wrote for the user', () => {
    for (const message of [
      'CP12 validation failed: Engineer signature is required',
      'Gas Warning Notice has already been issued for this job.',
      'That email is already registered.',
      'Upgrade to issue unlimited certificates.',
    ]) {
      expect(toUserMessage(new Error(message), 'fallback')).toBe(message);
    }
  });

  it('translates known technical failures into useful recovery messages', () => {
    expect(
      toUserMessage(
        new Error('duplicate key value violates unique constraint "certificates_job_id_key"'),
        'Please try again.',
      ),
    ).toBe(
      'A certificate has already been generated for this job. Open the job to view or resend it.',
    );
    expect(toUserMessage(new Error('Unauthorized'), 'Please try again.')).toBe(
      'Your session has expired. Sign in again and retry this action.',
    );
    expect(
      toUserMessage(new Error('generateCertificatePdf requires authenticated user'), 'Please try again.'),
    ).toBe('Your session has expired. Sign in again and retry this action.');
    expect(toUserMessage(new Error('Job not found'), 'Please try again.')).toBe(
      'This job is no longer available, or you do not have access to it.',
    );
    expect(toUserMessage(new Error('Client not found'), 'Please try again.')).toContain(
      'landlord or client',
    );
  });

  it('hides database internals', () => {
    for (const message of [
      'duplicate key value violates unique constraint "certificates_pkey"',
      'relation "public.job_fields" does not exist',
      'new row violates row-level security policy for table "free_tool_leads"',
      'PGRST116: JSON object requested, multiple rows returned',
      'column "foo" of relation "jobs" does not exist',
      'permission denied for table jobs',
      'invalid input syntax for type uuid: "bad-id"',
      'Could not find the invoices table in the schema cache',
    ]) {
      expect(toUserMessage(new Error(message), 'Please try again.')).toBe('Please try again.');
    }
  });

  it('hides runtime and transport failures', () => {
    for (const message of [
      "Cannot read properties of undefined (reading 'id')",
      'TypeError: fetch failed',
      'connect ECONNREFUSED 127.0.0.1:54321',
      'An error occurred in the Server Components render. The specific message is omitted',
      'Stripe API returned status code 400 with request id req_123',
      'Failed to fetch',
    ]) {
      expect(toUserMessage(new Error(message), 'Please try again.')).toBe('Please try again.');
    }
  });

  it('hides stacks and anything multi-line', () => {
    expect(toUserMessage(new Error('Boom\n    at Object.<anonymous> (/app/x.js:1:1)'), 'fallback')).toBe(
      'fallback',
    );
    expect(toUserMessage(new Error('x'.repeat(400)), 'fallback')).toBe('fallback');
  });

  it('hides bare codes that tell a user nothing', () => {
    expect(toUserMessage(new Error('ERR_INVALID_STATE'), 'fallback')).toBe('fallback');
    expect(toUserMessage(new Error('42703'), 'fallback')).toBe('fallback');
  });

  it('handles non-Error throws and empties', () => {
    expect(toUserMessage('something broke', 'fallback')).toBe('something broke');
    expect(toUserMessage(undefined, 'fallback')).toBe('fallback');
    expect(toUserMessage(new Error('   '), 'fallback')).toBe('fallback');
    expect(toUserMessage({ weird: true }, 'fallback')).toBe('fallback');
  });
});
