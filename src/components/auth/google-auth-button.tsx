'use client';

import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabaseBrowser } from '@/lib/supabaseClient';

function getAuthRedirectUrl() {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}/auth/callback`;
}

export function GoogleAuthButton({
  label = 'Continue with Google',
  className = '',
  nextPath,
}: {
  label?: string;
  className?: string;
  nextPath?: string;
}) {
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleGoogleAuth = () => {
    startTransition(async () => {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: nextPath
            ? `${getAuthRedirectUrl()}?next=${encodeURIComponent(nextPath)}`
            : getAuthRedirectUrl(),
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        pushToast({
          title: 'Google sign-in failed',
          description: error.message,
          variant: 'error',
        });
      }
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleGoogleAuth}
      disabled={isPending}
      className={`w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 ${className}`}
    >
      <span className="mr-2 text-base" aria-hidden="true">
        G
      </span>
      {isPending ? 'Redirecting…' : label}
    </Button>
  );
}
