'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import posthog from 'posthog-js';
import { useToast } from '@/components/ui/use-toast';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics/events';
import { supabaseBrowser } from '@/lib/supabaseClient';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

// Minimal typing for the Google Identity Services global we use.
type GoogleCredentialResponse = { credential: string };
type GoogleId = {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    nonce?: string;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      logo_alignment?: 'left' | 'center';
      width?: number;
    },
  ) => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

function loadGis(): Promise<GoogleId> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve(window.google.accounts.id);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    const onReady = () => {
      if (window.google?.accounts?.id) resolve(window.google.accounts.id);
      else reject(new Error('Google Identity Services failed to load'));
    };
    if (existing) {
      existing.addEventListener('load', onReady, { once: true });
      existing.addEventListener('error', () => reject(new Error('Google script error')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', onReady, { once: true });
    script.addEventListener('error', () => reject(new Error('Google script error')), { once: true });
    document.head.appendChild(script);
  });
}

// Supabase validates a nonce to bind the ID token to this request. Google receives
// the SHA-256 hash; signInWithIdToken receives the raw value. See:
// https://supabase.com/docs/guides/auth/social-login/auth-google (One Tap / nonce).
async function generateNonce(): Promise<[string, string]> {
  const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return [raw, hashed];
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const handleCredential = useCallback(
    async (rawNonce: string, response: GoogleCredentialResponse) => {
      try {
        const supabase = supabaseBrowser();
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: response.credential,
          nonce: rawNonce,
        });
        if (error) throw error;
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          posthog.identify(user.id, { email: user.email });
        }
        // Funnel step 3: account created via Google. Only count this on the signup
        // flow (nextPath into signup), not ordinary Google sign-ins on /login.
        // posthog flushes queued events via sendBeacon on pagehide, so the event
        // survives the window.location redirect below.
        if (nextPath?.includes('signup')) {
          track(ANALYTICS_EVENTS.signupCompleted, { method: 'google' });
        } else {
          track(ANALYTICS_EVENTS.userLoggedIn, { method: 'google' });
        }
        // Session cookies are now set by the SSR browser client; reuse the existing
        // callback route for onboarding/next routing (it no-ops without a `code`).
        const dest = new URL('/auth/callback', window.location.origin);
        if (nextPath) dest.searchParams.set('next', nextPath);
        window.location.assign(dest.toString());
      } catch (error) {
        pushToast({
          title: 'Google sign-in failed',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    },
    [nextPath, pushToast],
  );

  useEffect(() => {
    if (!clientId) return;
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;

    (async () => {
      const [rawNonce, hashedNonce] = await generateNonce();
      const gis = await loadGis();
      if (cancelled || !containerRef.current) return;
      gis.initialize({
        client_id: clientId,
        callback: (response) => handleCredential(rawNonce, response),
        nonce: hashedNonce,
        ux_mode: 'popup',
      });
      const render = () => {
        if (!containerRef.current) return;
        containerRef.current.innerHTML = '';
        gis.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: Math.min(Math.max(containerRef.current.offsetWidth, 200), 400),
        });
      };
      render();
      setReady(true);
      const observer = new ResizeObserver(render);
      observer.observe(el);
      return () => observer.disconnect();
    })().catch((error) => {
      pushToast({
        title: 'Google sign-in unavailable',
        description: error instanceof Error ? error.message : 'Could not load Google.',
        variant: 'error',
      });
    });

    return () => {
      cancelled = true;
    };
  }, [clientId, handleCredential, pushToast]);

  if (!clientId) {
    // Misconfiguration guard: surfaces during dev if the env var is missing.
    return (
      <div className={`text-xs text-[var(--color-text-tertiary)] ${className}`}>
        Google sign-in is not configured.
      </div>
    );
  }

  return (
    <div className={`flex w-full justify-center ${className}`} aria-label={label}>
      <div ref={containerRef} className="w-full" style={{ minHeight: 44 }} />
      {!ready ? <span className="sr-only">Loading Google sign-in…</span> : null}
    </div>
  );
}
