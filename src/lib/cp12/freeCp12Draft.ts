/**
 * Browser-side storage for a free CP12 in progress.
 *
 * The free tool used to hold everything in React state and nothing else, so a
 * refresh, a back button, a dead tab or a tap on the signup CTA destroyed a
 * finished certificate. An engineer up a loft on bad signal lost twenty minutes
 * of work at the final click.
 *
 * This keeps the answers in the visitor's own browser. It does not weaken the
 * promise the tool makes: nothing is sent to us until they ask for the PDF, and
 * we still store no copy of the certificate. `localStorage` is the visitor's
 * device, not our server — but it IS the landlord's and the property's details
 * sitting on what may be a shared work phone, so both slots expire and the
 * draft is cleared the moment it is no longer needed.
 *
 * Two slots, deliberately separate:
 *   - DRAFT     — autosaved as they type, restored on return, cleared once the
 *                 certificate has been downloaded.
 *   - CARRYOVER — written only when they explicitly choose to create an account
 *                 and keep the certificate. Consumed once, after they land in
 *                 the app.
 *
 * Keys are versioned. A change to the payload shape must bump VERSION so an old
 * draft is discarded rather than restored into a form that no longer matches it.
 */
import {
  FreeCp12PayloadSchema,
  emptyFreeCp12Payload,
  type FreeCp12Payload,
} from './freeCp12Payload';

// v2: gas_type moved off the record and onto each appliance. A v1 draft parses
// cleanly against the new schema — Zod strips the unknown record-level key and
// defaults the new appliance one — so it would restore looking complete while
// having quietly dropped the fuel. Discarding it is the honest outcome.
const VERSION = 'v2';
const DRAFT_KEY = `certnow.free-cp12.draft.${VERSION}`;
const CARRYOVER_KEY = `certnow.free-cp12.carryover.${VERSION}`;

/**
 * How long a stored draft stays usable.
 *
 * Long enough to survive the whole signup detour, which can include confirming
 * an email in another tab or on another day; short enough that a property's
 * details do not sit on a shared device indefinitely.
 */
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type StoredDraft = {
  savedAt: number;
  payload: unknown;
};

type Slot = 'draft' | 'carryover';

const keyFor = (slot: Slot) => (slot === 'draft' ? DRAFT_KEY : CARRYOVER_KEY);

/** localStorage throws in private mode and when the origin has no storage. */
function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Write a draft, and say whether it stuck.
 *
 * A signature is a data URL and can be a few hundred KB, so a quota failure is
 * plausible on a phone with a full origin. Callers treat a false return as "no
 * safety net" rather than an error to show — the visitor can still finish and
 * download, which is the thing that actually matters to them.
 */
export function saveFreeCp12Draft(payload: FreeCp12Payload, slot: Slot = 'draft'): boolean {
  const store = storage();
  if (!store) return false;
  try {
    const entry: StoredDraft = { savedAt: Date.now(), payload };
    store.setItem(keyFor(slot), JSON.stringify(entry));
    return true;
  } catch {
    // Most likely QuotaExceededError. Drop the older slot and try once more, so
    // a stale carry-over cannot permanently block autosave of live work.
    try {
      store.removeItem(slot === 'draft' ? CARRYOVER_KEY : DRAFT_KEY);
      store.setItem(keyFor(slot), JSON.stringify({ savedAt: Date.now(), payload }));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Read a draft back, or null if there is nothing usable.
 *
 * Anything unparseable, expired or no longer matching the payload schema is
 * removed rather than returned. Restoring a half-valid certificate would be
 * worse than restoring nothing: the engineer would not know which answers
 * survived.
 */
export function readFreeCp12Draft(slot: Slot = 'draft'): FreeCp12Payload | null {
  const store = storage();
  if (!store) return null;
  const raw = store.getItem(keyFor(slot));
  if (!raw) return null;

  const drop = () => {
    try {
      store.removeItem(keyFor(slot));
    } catch {
      /* nothing further to try */
    }
    return null;
  };

  try {
    const entry = JSON.parse(raw) as StoredDraft;
    if (!entry || typeof entry.savedAt !== 'number') return drop();
    if (Date.now() - entry.savedAt > DRAFT_TTL_MS) return drop();
    const parsed = FreeCp12PayloadSchema.safeParse(entry.payload);
    if (!parsed.success) return drop();
    return parsed.data;
  } catch {
    return drop();
  }
}

export function clearFreeCp12Draft(slot: Slot = 'draft') {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(keyFor(slot));
  } catch {
    /* nothing further to try */
  }
}

/**
 * True when the payload holds anything worth restoring.
 *
 * The form always has a fully-formed payload object, so presence alone says
 * nothing — an untouched form still arrives here with an appliance defaulted to
 * a combi boiler. Without this, opening the page and leaving would store an
 * empty draft and then offer to restore it.
 *
 * Compares against a fresh empty payload rather than testing for non-empty
 * strings, so a value that merely matches its own default does not count and a
 * new default added later is picked up automatically.
 */
export function freeCp12DraftHasContent(payload: FreeCp12Payload): boolean {
  const baseline = emptyFreeCp12Payload();
  if (payload.appliances.length !== baseline.appliances.length) return true;

  // Appliances carry a nested `unsafe_situation` object, so identity comparison
  // would report every untouched form as touched. Both sides are built by the
  // same schema, so key order is stable and stringifying is a safe structural
  // comparison here.
  const differs = (value: unknown, against: unknown) =>
    typeof value === 'string'
      ? value.trim() !== String(against ?? '').trim()
      : JSON.stringify(value) !== JSON.stringify(against);

  const fieldsTouched = Object.entries(payload.fields).some(([key, value]) =>
    differs(value, baseline.fields[key as keyof typeof baseline.fields]),
  );
  if (fieldsTouched) return true;

  return payload.appliances.some((appliance, index) => {
    const base = baseline.appliances[index] ?? baseline.appliances[0];
    return Object.entries(appliance).some(([key, value]) =>
      differs(value, base[key as keyof typeof base]),
    );
  });
}
