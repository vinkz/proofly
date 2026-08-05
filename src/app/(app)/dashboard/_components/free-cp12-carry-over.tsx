'use client';

/**
 * Offers to adopt a certificate started in the free tool.
 *
 * Signup runs step1 → step2 → step3 → onboarding → dashboard, and can detour
 * through email confirmation on another day or another tab. Threading a `next`
 * parameter through all of that would break on the confirmation path, so the
 * carry-over waits in the browser and is picked up here instead — wherever the
 * engineer ends up, whichever route they took.
 *
 * The import is a button rather than something that happens on arrival. The
 * whole point of the free tool is that nothing is stored without the visitor
 * asking, and that should not stop being true at the moment they get an
 * account.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics/events';
import {
  clearFreeCp12Draft,
  freeCp12DraftHasContent,
  readFreeCp12Draft,
} from '@/lib/cp12/freeCp12Draft';
import type { FreeCp12Payload } from '@/lib/cp12/freeCp12Payload';
import { toUserMessage } from '@/lib/user-errors';
import { importFreeCp12Draft } from '@/server/free-cp12-import';

export function FreeCp12CarryOver() {
  const router = useRouter();
  const [draft, setDraft] = useState<FreeCp12Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = readFreeCp12Draft('carryover');
    if (stored && freeCp12DraftHasContent(stored)) setDraft(stored);
  }, []);

  if (!draft) return null;

  const address = [draft.fields.job_address_line1, draft.fields.job_postcode]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await importFreeCp12Draft(draft);
      if (!result.ok) {
        setError(
          toUserMessage(
            result.message,
            'We could not save it just now. Your copy is still in this browser.',
          ),
        );
        return;
      }
      // Only now is it safe to drop: until the row exists, this copy is the
      // only one anywhere.
      clearFreeCp12Draft('carryover');
      track(ANALYTICS_EVENTS.freeCp12CarryOverImported, {
        appliance_count: draft.appliances.length,
      });
      setDraft(null);
      router.push(`/wizard/create/cp12?jobId=${result.jobId}`);
    } catch {
      setError('We could not save it just now. Your copy is still in this browser.');
    } finally {
      setBusy(false);
    }
  };

  const discard = () => {
    clearFreeCp12Draft('carryover');
    setDraft(null);
  };

  return (
    <div className="mb-5 rounded-[16px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4 sm:p-5">
      <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">
        Save the CP12 you started
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
        {address
          ? `You filled one in for ${address} before creating your account. `
          : 'You filled one in before creating your account. '}
        It is still in this browser — save it and it becomes a draft you can edit, issue and reissue.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-[var(--color-red)]">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save to my account'}
        </Button>
        <button
          type="button"
          onClick={discard}
          disabled={busy}
          className="text-[13px] font-medium text-[var(--color-text-tertiary)] underline"
        >
          No thanks, discard it
        </button>
      </div>
    </div>
  );
}
