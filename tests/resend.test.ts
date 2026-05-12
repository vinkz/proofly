import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isEmailConfigured, sendEmail } from '@/lib/resend';

const originalEnv = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
};

const restoreEnv = () => {
  if (originalEnv.RESEND_API_KEY === undefined) {
    delete process.env.RESEND_API_KEY;
  } else {
    process.env.RESEND_API_KEY = originalEnv.RESEND_API_KEY;
  }

  if (originalEnv.EMAIL_FROM === undefined) {
    delete process.env.EMAIL_FROM;
  } else {
    process.env.EMAIL_FROM = originalEnv.EMAIL_FROM;
  }
};

describe('sendEmail', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    restoreEnv();
  });

  it('posts a transactional email to Resend when configured', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.EMAIL_FROM = 'CertNow <notifications@certnow.uk>';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'email_123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await sendEmail({
      to: 'engineer@example.com',
      subject: 'New landlord job request',
      text: 'A landlord submitted a request.',
      html: '<p>A landlord submitted a request.</p>',
      replyTo: 'landlord@example.com',
    });

    expect(result).toEqual({ status: 'sent', id: 'email_123' });
    expect(isEmailConfigured()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test_key',
          'Content-Type': 'application/json',
        }),
      }),
    );

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      from: 'CertNow <notifications@certnow.uk>',
      to: 'engineer@example.com',
      subject: 'New landlord job request',
      text: 'A landlord submitted a request.',
      html: '<p>A landlord submitted a request.</p>',
      reply_to: 'landlord@example.com',
    });
  });

  it('does not call Resend when email is not configured', async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await expect(
      sendEmail({
        to: 'engineer@example.com',
        subject: 'New landlord job request',
        text: 'A landlord submitted a request.',
      }),
    ).resolves.toEqual({ status: 'not_configured' });
    expect(isEmailConfigured()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
