/**
 * What kind of browser the visitor is actually in.
 *
 * Two things we could not see before, both learned from real traffic to
 * /free-cp12:
 *
 * - Most of the free-tool traffic arrives from Facebook, which opens links in
 *   an embedded WebView rather than the person's browser. Those WebViews block
 *   anchor-triggered blob downloads, so the certificate a visitor came for can
 *   silently fail to save. Knowing we are in one lets us say so.
 * - Two "visitors" in a week were crawlers reporting a perfectly square
 *   2000x2000 screen, no clicks, and ~430 synthetic mouse events. They are not
 *   people and should not sit in the same counts as people.
 */

/**
 * In-app browser markers, from the user agent.
 *
 * Facebook stamps FB_IAB/FB4A on Android and FBAN/FBIOS on iOS; both also carry
 * FBAV (the app version). Matching any of them is enough — we only need to know
 * that we are inside the app, not which build.
 */
const IN_APP_BROWSERS: ReadonlyArray<{ id: string; label: string; pattern: RegExp }> = [
  { id: 'facebook', label: 'Facebook', pattern: /FB_IAB|FBAN|FBAV/i },
  { id: 'instagram', label: 'Instagram', pattern: /\bInstagram\b/i },
  { id: 'tiktok', label: 'TikTok', pattern: /BytedanceWebview|\bTikTok\b/i },
  { id: 'linkedin', label: 'LinkedIn', pattern: /\bLinkedInApp\b/i },
  { id: 'snapchat', label: 'Snapchat', pattern: /\bSnapchat\b/i },
];

export type InAppBrowser = { id: string; label: string };

/** The in-app browser this user agent belongs to, or null for a real browser. */
export function detectInAppBrowser(userAgent: string | null | undefined): InAppBrowser | null {
  if (!userAgent) return null;
  const match = IN_APP_BROWSERS.find(({ pattern }) => pattern.test(userAgent));
  return match ? { id: match.id, label: match.label } : null;
}

/**
 * A screen that is exactly square is automation, not a display.
 *
 * Both crawler sessions reported 2000x2000 — one of them on Chrome 74, released
 * in 2019. Consumer hardware is not 1:1 at any size, so squareness alone is a
 * safe tell; the lower bound just keeps a stub 0x0 or 1x1 environment from
 * counting. Deliberately a tag rather than a drop: if this is ever wrong we
 * still have the events, and only the reports were filtered.
 */
export function hasAutomationScreen(width: number | undefined, height: number | undefined): boolean {
  if (typeof width !== 'number' || typeof height !== 'number') return false;
  return width === height && width >= 1000;
}

/** Browser-environment properties to attach to every analytics event. */
export function browserEnvProperties(): { in_app_browser: string; is_automated: boolean } {
  if (typeof window === 'undefined') {
    return { in_app_browser: 'none', is_automated: false };
  }
  const inApp = detectInAppBrowser(window.navigator?.userAgent);
  return {
    in_app_browser: inApp?.id ?? 'none',
    is_automated: hasAutomationScreen(window.screen?.width, window.screen?.height),
  };
}
