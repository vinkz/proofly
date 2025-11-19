'use client';

import { useState, useTransition } from 'react';
import { z } from 'zod';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { requestPasswordReset } from '@/server/password';

const EmailSchema = z.object({
  email: z.string().email({ message: 'Enter a valid email' }),
});

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useToast();

  const handleSubmit = () => {
    startTransition(async () => {
      const parsed = EmailSchema.safeParse({ email });
      if (!parsed.success) {
        pushToast({
          title: 'Invalid email',
          description: parsed.error.issues[0]?.message ?? 'Check your email and try again.',
          variant: 'error',
        });
        return;
      }
      try {
        await requestPasswordReset(parsed.data.email);
        setSent(true);
        pushToast({ title: 'Check your email', description: 'Reset link sent.', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Could not send reset link',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--muted)] to-white">
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-10">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Password reset</p>
          <h1 className="text-3xl font-bold text-[var(--brand)]">Forgot password</h1>
          <p className="text-sm text-muted-foreground/80">Enter your email to receive a reset link.</p>
        </div>
        <Card className="space-y-4 border border-white/50 bg-white/90 p-6 shadow">
          <label className="block text-sm font-semibold text-muted">
            Email
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              placeholder="you@example.com"
              className="mt-2"
              disabled={isPending}
            />
          </label>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !email}
            className="w-full rounded-full bg-[var(--action)] text-white"
          >
            {isPending ? 'Sending…' : 'Send reset link'}
          </Button>
          {sent ? (
            <p className="text-xs text-[var(--brand)]">Check your email for a reset link.</p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
