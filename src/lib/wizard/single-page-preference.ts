/**
 * Whether the engineer wants certificates on one page rather than stepped.
 *
 * Read by two screens that have to agree: the job form, which decides whether
 * to walk its own steps or hand straight over, and the wizard, which decides
 * whether to stack its steps or show them one at a time. A single key, because
 * the moment they disagree the engineer gets half a stepped flow and half a
 * one-page one, which is worse than either.
 *
 * Per device rather than on the profile: it is a preference about a screen on a
 * phone, so it needs no migration and no round-trip before the first paint.
 * A browser that refuses storage falls back to the stepped flow, which is the
 * behaviour that has always shipped.
 */
const KEY = 'certnow.cp12-wizard.single-page.v1';

export function readSinglePagePreference(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function writeSinglePagePreference(enabled: boolean): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(KEY, enabled ? '1' : '0');
  } catch {
    /* the preference simply will not persist */
  }
}
