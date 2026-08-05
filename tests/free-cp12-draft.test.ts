import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DRAFT_TTL_MS,
  clearFreeCp12Draft,
  freeCp12DraftHasContent,
  readFreeCp12Draft,
  saveFreeCp12Draft,
} from '@/lib/cp12/freeCp12Draft';
import { FreeCp12PayloadSchema, emptyFreeCp12Payload } from '@/lib/cp12/freeCp12Payload';

/**
 * The free tool's safety net. It exists because holding the form in React state
 * alone meant a refresh, a back button or a tap on the signup CTA destroyed a
 * finished certificate.
 *
 * The rule it must never break: a draft is either restored complete, or not at
 * all. Restoring a partially-valid certificate would be worse than restoring
 * nothing, because the engineer would not know which answers survived.
 */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  full = false;
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    if (this.full) throw new Error('QuotaExceededError');
    this.map.set(key, value);
  }
}

let store: MemoryStorage;

beforeEach(() => {
  store = new MemoryStorage();
  vi.stubGlobal('window', { localStorage: store } as unknown as Window);
});

const filled = () => {
  const payload = emptyFreeCp12Payload();
  payload.fields.job_address_line1 = '12 High Street';
  payload.fields.landlord_name = 'A Landlord';
  payload.appliances[0].location = 'Kitchen';
  payload.appliances[0].make = 'Vaillant';
  return FreeCp12PayloadSchema.parse(payload);
};

describe('free CP12 draft storage', () => {
  it('round-trips a draft through the browser', () => {
    const payload = filled();
    expect(saveFreeCp12Draft(payload)).toBe(true);
    expect(readFreeCp12Draft()).toEqual(payload);
  });

  it('keeps the autosave and carry-over slots apart', () => {
    const payload = filled();
    saveFreeCp12Draft(payload, 'carryover');
    expect(readFreeCp12Draft('carryover')).toEqual(payload);
    expect(readFreeCp12Draft('draft')).toBeNull();
  });

  it('clears only the slot it is asked to clear', () => {
    saveFreeCp12Draft(filled(), 'draft');
    saveFreeCp12Draft(filled(), 'carryover');
    clearFreeCp12Draft('draft');
    expect(readFreeCp12Draft('draft')).toBeNull();
    expect(readFreeCp12Draft('carryover')).not.toBeNull();
  });

  it('discards a draft past its expiry rather than restoring stale details', () => {
    saveFreeCp12Draft(filled());
    const stored = JSON.parse(store.getItem(store.key(0)!)!);
    stored.savedAt = Date.now() - DRAFT_TTL_MS - 1;
    store.setItem(store.key(0)!, JSON.stringify(stored));
    expect(readFreeCp12Draft()).toBeNull();
  });

  it('removes an expired draft so it cannot linger on a shared device', () => {
    saveFreeCp12Draft(filled());
    const k = store.key(0)!;
    const stored = JSON.parse(store.getItem(k)!);
    stored.savedAt = Date.now() - DRAFT_TTL_MS - 1;
    store.setItem(k, JSON.stringify(stored));
    readFreeCp12Draft();
    expect(store.getItem(k)).toBeNull();
  });

  it('discards anything that no longer matches the payload shape', () => {
    saveFreeCp12Draft(filled());
    const k = store.key(0)!;
    store.setItem(k, JSON.stringify({ savedAt: Date.now(), payload: { fields: 'nonsense' } }));
    expect(readFreeCp12Draft()).toBeNull();
    expect(store.getItem(k)).toBeNull();
  });

  it('discards unparseable JSON without throwing', () => {
    saveFreeCp12Draft(filled());
    store.setItem(store.key(0)!, '{not json');
    expect(() => readFreeCp12Draft()).not.toThrow();
    expect(readFreeCp12Draft()).toBeNull();
  });

  it('reports failure rather than throwing when storage is full', () => {
    store.full = true;
    expect(saveFreeCp12Draft(filled())).toBe(false);
  });

  it('survives an origin with no storage at all', () => {
    vi.stubGlobal('window', undefined);
    expect(saveFreeCp12Draft(filled())).toBe(false);
    expect(readFreeCp12Draft()).toBeNull();
    expect(() => clearFreeCp12Draft()).not.toThrow();
  });
});

describe('freeCp12DraftHasContent', () => {
  it('treats an untouched form as nothing worth restoring', () => {
    // The form always holds a full payload object, and the inspection date is
    // prefilled — without this, arriving and leaving would store an empty draft
    // and then offer to restore it.
    expect(freeCp12DraftHasContent(FreeCp12PayloadSchema.parse(emptyFreeCp12Payload()))).toBe(false);
  });

  it('notices a single answer anywhere in the form', () => {
    expect(freeCp12DraftHasContent(filled())).toBe(true);
  });

  it('notices an answer on the appliance alone', () => {
    const payload = FreeCp12PayloadSchema.parse(emptyFreeCp12Payload());
    payload.appliances[0].location = 'Kitchen';
    expect(freeCp12DraftHasContent(payload)).toBe(true);
  });
});
