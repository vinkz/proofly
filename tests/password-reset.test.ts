import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabaseServer', () => {
  const auth = {
    resetPasswordForEmail: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    updateUser: vi.fn(),
  } as unknown as {
    resetPasswordForEmail: ReturnType<typeof vi.fn>;
    exchangeCodeForSession: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
  };
  const client = { auth };
  return {
    supabaseServerAction: vi.fn(async () => client),
  };
});

import { requestPasswordReset, applyPasswordReset } from '@/server/password';
import { supabaseServerAction } from '@/lib/supabaseServer';

describe('password reset actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests password reset', async () => {
    const supabase = await supabaseServerAction();
    const auth = supabase.auth as unknown as {
      resetPasswordForEmail: ReturnType<typeof vi.fn>;
    };
    auth.resetPasswordForEmail.mockResolvedValue({ data: null, error: null });

    await expect(requestPasswordReset('user@example.com')).resolves.toEqual({ ok: true });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: expect.stringContaining('/reset-password'),
    });
  });

  it('applies password reset with code', async () => {
    const supabase = await supabaseServerAction();
    const auth = supabase.auth as unknown as {
      exchangeCodeForSession: ReturnType<typeof vi.fn>;
      updateUser: ReturnType<typeof vi.fn>;
    };
    auth.exchangeCodeForSession.mockResolvedValue({ data: null, error: null });
    auth.updateUser.mockResolvedValue({ data: null, error: null });

    await expect(applyPasswordReset({ code: 'abc123', new_password: 'newpass123' })).resolves.toEqual({ ok: true });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('abc123');
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'newpass123' });
  });
});
