'use client';

/**
 * The free CP12 form.
 *
 * Stateless by design: form state lives in this component and dies with the
 * tab. No autosave, no localStorage, no prefill, no server-side draft. That is
 * the boundary between the free tool and the paid product, so it is built in
 * rather than missing — do not add persistence here.
 *
 * Field applicability comes from the shared appliance config, so this form
 * shows exactly the checks the paid wizard shows for a given category.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EnumChips } from '@/components/wizard/inputs/enum-chips';
import { SignaturePad } from '@/components/certificates/signature-pad';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics/events';
import {
  CP12_APPLIANCE_CATEGORIES,
  CP12_BOILER_SUBTYPES,
  cp12FieldVisibility,
  cp12FieldVisible,
  resolveCp12Category,
} from '@/lib/cp12/applianceConfig';
import {
  emptyFreeCp12Appliance,
  emptyFreeCp12Payload,
  freeCp12ValidationInput,
  type FreeCp12Appliance,
  type FreeCp12Payload,
  type FreeUnsafeSituation,
} from '@/lib/cp12/freeCp12Payload';
import { freeGwnIssues, gwnClassificationFor } from '@/lib/cp12/freeGwn';
import { UnsafeSituationFields } from '@/components/cp12/unsafe-situation';
import { validateCp12TierOne } from '@/lib/cp12/validation';
import { AddressLookupField } from '@/components/address/address-lookup-field';
import type { AddressLookupResult } from '@/lib/address-lookup';
import { SearchableSelect } from '@/components/wizard/inputs/searchable-select';
import { getApplianceCatalog } from '@/lib/applianceCatalog/ukAppliances';
import { CP12_FLUE_TYPES, CP12_LOCATIONS } from '@/types/cp12';
import { PresetChips } from '@/components/wizard/inputs/preset-chips';
import {
  ACTION_REQUIRED_PRESETS,
  ACTION_TAKEN_PRESETS,
  UNSAFE_SITUATION_PRESETS,
} from '@/lib/gas-safety/unsafe-presets';
import {
  composeCp12DefectSummary,
  cp12ApplianceHasFailedCheck,
  cp12FailedChecks,
  type Cp12DefectAppliance,
} from '@/lib/cp12/defect-summary';

const PASS_FAIL = [
  { label: 'Pass', value: 'pass' },
  { label: 'Fail', value: 'fail' },
];
const YES_NO = [
  { label: 'Yes', value: 'Yes' },
  { label: 'No', value: 'No' },
];
const CLASSIFICATIONS = [
  { label: 'Safe', value: 'safe' },
  { label: 'NCS', value: 'ncs' },
  { label: 'AR', value: 'ar' },
  { label: 'ID', value: 'id' },
];

/** Must match the array cap in FreeCp12PayloadSchema, or the server 400s opaquely. */
const MAX_APPLIANCES = 12;

// Same option sets the paid wizard offers, so the two flows suggest the same
// vocabulary. All three inputs stay free-text — the list is a shortcut, never a
// constraint, because real properties have rooms these lists have never heard of.
const LOCATION_OPTIONS = CP12_LOCATIONS.map((l) => ({ label: l.label, value: l.label }));
const FLUE_TYPE_OPTIONS = CP12_FLUE_TYPES.map((f) => ({ label: f.label, value: f.label }));

type Stage = 'form' | 'preview' | 'done';

type GeneratedDocument = {
  kind: 'cp12' | 'gas_warning_notice';
  title: string;
  filename: string;
  reference: string;
  base64: string;
};

const base64ToBlob = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: 'application/pdf' });
};

const SECTION_CLASS =
  'mb-6 rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4 sm:p-5';

/**
 * A form section. Sections holding only optional fields collapse by default, so
 * the required path down the page stays short — this is filled in on a phone,
 * often one-handed, and scrolling past checks you are not going to record is
 * the main cost of covering every appliance type properly.
 *
 * Uses native <details>: it is keyboard and screen-reader accessible for free,
 * survives without JS, and browser find-in-page opens it.
 */
function Section({
  title,
  hint,
  collapsible = false,
  children,
}: {
  title: string;
  hint?: string;
  collapsible?: boolean;
  children: React.ReactNode;
}) {
  if (!collapsible) {
    return (
      <section className={SECTION_CLASS}>
        <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">{title}</h2>
        {hint ? <p className="mt-1 text-[13px] text-[var(--color-text-tertiary)]">{hint}</p> : null}
        <div className="mt-4 grid gap-4">{children}</div>
      </section>
    );
  }

  return (
    <details className={`${SECTION_CLASS} group`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="text-[15px] font-semibold text-[var(--color-text-primary)]">{title}</span>
          <span className="ml-2 rounded-full bg-[var(--color-background-tertiary)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-tertiary)]">
            Optional
          </span>
          {hint ? <span className="mt-1 block text-[13px] text-[var(--color-text-tertiary)]">{hint}</span> : null}
        </span>
        <span
          aria-hidden
          className="shrink-0 text-[13px] text-[var(--color-text-tertiary)] transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <div className="mt-4 grid gap-4">{children}</div>
    </details>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-[var(--color-text-secondary)]">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[12px] text-[var(--color-text-tertiary)]">{hint}</span> : null}
    </label>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

export function FreeCp12Form() {
  const [payload, setPayload] = useState<FreeCp12Payload>(() => emptyFreeCp12Payload());
  const [stage, setStage] = useState<Stage>('form');
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [activeDoc, setActiveDoc] = useState(0);
  const [docUrls, setDocUrls] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [emailed, setEmailed] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const startedRef = useRef(false);

  // Revoke the preview object URLs when they are replaced or the tab closes, so
  // the documents do not linger in memory longer than the visit.
  useEffect(() => {
    return () => {
      docUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [docUrls]);

  const markStarted = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    track(ANALYTICS_EVENTS.freeCp12FormStarted);
  }, []);

  const setField = useCallback(
    (key: keyof FreeCp12Payload['fields'], value: string) => {
      markStarted();
      setPayload((prev) => ({ ...prev, fields: { ...prev.fields, [key]: value } }));
    },
    [markStarted],
  );

  const setAppliance = useCallback(
    (index: number, patch: Partial<FreeCp12Appliance>) => {
      markStarted();
      setPayload((prev) => ({
        ...prev,
        appliances: prev.appliances.map((a, i) => (i === index ? { ...a, ...patch } : a)),
      }));
    },
    [markStarted],
  );

  /**
   * Merge into one appliance's unsafe-situation answers.
   *
   * Functional rather than spreading the appliance captured in the current
   * render: the GIUSP block is a column of chips, and two taps landing in the
   * same React batch would otherwise both merge into the same stale object and
   * the first answer would be lost.
   */
  const setUnsafeSituation = useCallback(
    (index: number, patch: Partial<FreeUnsafeSituation>) => {
      markStarted();
      setPayload((prev) => ({
        ...prev,
        appliances: prev.appliances.map((a, i) =>
          i === index ? { ...a, unsafe_situation: { ...a.unsafe_situation, ...patch } } : a,
        ),
      }));
    },
    [markStarted],
  );

  const addAppliance = () => {
    markStarted();
    setPayload((prev) =>
      prev.appliances.length >= MAX_APPLIANCES
        ? prev
        : { ...prev, appliances: [...prev.appliances, emptyFreeCp12Appliance()] },
    );
  };

  const removeAppliance = (index: number) => {
    setPayload((prev) => ({
      ...prev,
      appliances: prev.appliances.length > 1 ? prev.appliances.filter((_, i) => i !== index) : prev.appliances,
    }));
  };

  /**
   * Local view of the same statutory gate the server applies. Shown as a list
   * after a generate attempt — never used to disable inputs or block typing.
   */
  const localIssues = useMemo(() => {
    try {
      return [
        ...validateCp12TierOne(freeCp12ValidationInput(payload)),
        // Warning-notice gate too, so an unsafe appliance surfaces its GIUSP
        // gaps here rather than only after a round trip. The reference and
        // timestamp are server-generated; placeholders keep them non-blocking.
        ...freeGwnIssues(payload, { recordId: 'preview', issuedAt: new Date() }),
      ];
    } catch {
      return [];
    }
  }, [payload]);

  const applyPropertyAddress = useCallback(
    (address: AddressLookupResult) => {
      markStarted();
      setPayload((prev) => ({
        ...prev,
        fields: {
          ...prev.fields,
          job_address_line1: address.line1 || address.summary,
          job_address_line2: address.line2,
          job_address_city: address.city,
          job_postcode: address.postcode,
        },
      }));
    },
    [markStarted],
  );

  const applyLandlordAddress = useCallback(
    (address: AddressLookupResult) => {
      markStarted();
      setPayload((prev) => ({
        ...prev,
        fields: {
          ...prev.fields,
          landlord_address_line1: address.line1 || address.summary,
          landlord_address_line2: address.line2,
          landlord_city: address.city,
          landlord_postcode: address.postcode,
        },
      }));
    },
    [markStarted],
  );

  const hasPropertyAddress = Boolean(
    payload.fields.job_address_line1.trim() || payload.fields.job_postcode.trim(),
  );
  const landlordAddressMatchesProperty =
    hasPropertyAddress &&
    payload.fields.landlord_address_line1.trim() === payload.fields.job_address_line1.trim() &&
    payload.fields.landlord_address_line2.trim() === payload.fields.job_address_line2.trim() &&
    payload.fields.landlord_city.trim() === payload.fields.job_address_city.trim() &&
    payload.fields.landlord_postcode.trim() === payload.fields.job_postcode.trim();

  /**
   * A landlord living at the property still needs their address captured as
   * theirs — the issue gate deliberately refuses to infer it. This copies it
   * explicitly, which is the engineer asserting it, not us guessing.
   */
  const copyPropertyToLandlord = useCallback(() => {
    markStarted();
    setPayload((prev) => ({
      ...prev,
      fields: {
        ...prev.fields,
        landlord_address_line1: prev.fields.job_address_line1,
        landlord_address_line2: prev.fields.job_address_line2,
        landlord_city: prev.fields.job_address_city,
        landlord_postcode: prev.fields.job_postcode,
      },
    }));
  }, [markStarted]);

  /**
   * Record-level defect / remedial text composed from the appliances.
   *
   * A failed safety check is itself a defect under Reg 36(3)(e), and its fix is
   * the remedial action under (f). The paid flow already composes this at issue
   * time when the boxes are blank; doing it in the form as well means the
   * engineer sees and can correct what will actually print, instead of
   * discovering it on the PDF.
   */
  const composed = useMemo(
    () => composeCp12DefectSummary(payload.appliances as unknown as Cp12DefectAppliance[]),
    [payload.appliances],
  );

  // Once the engineer types in a box, stop overwriting it.
  const [defectsDirty, setDefectsDirty] = useState(false);
  const [remedialDirty, setRemedialDirty] = useState(false);

  useEffect(() => {
    if (defectsDirty) return;
    setPayload((prev) =>
      prev.fields.defect_description === composed.defect_description
        ? prev
        : { ...prev, fields: { ...prev.fields, defect_description: composed.defect_description } },
    );
  }, [composed.defect_description, defectsDirty]);

  useEffect(() => {
    if (remedialDirty) return;
    setPayload((prev) =>
      prev.fields.remedial_action === composed.remedial_action
        ? prev
        : { ...prev, fields: { ...prev.fields, remedial_action: composed.remedial_action } },
    );
  }, [composed.remedial_action, remedialDirty]);

  const hasUnsafeAppliance = useMemo(
    () => payload.appliances.some((a) => gwnClassificationFor(a) !== null),
    [payload.appliances],
  );



  const handleGenerate = async () => {
    setError(null);
    setIssues([]);
    if (localIssues.length) {
      setIssues(localIssues);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/free-cp12/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string; issues?: string[] };
        setIssues(data.issues ?? []);
        setError(data.error ?? 'Something went wrong generating the certificate.');
        return;
      }
      const data = (await response.json()) as { reference: string; documents: GeneratedDocument[] };
      docUrls.forEach((url) => URL.revokeObjectURL(url));
      setDocuments(data.documents);
      setDocUrls(data.documents.map((doc) => URL.createObjectURL(base64ToBlob(doc.base64))));
      setActiveDoc(0);
      setStage('preview');
      track(ANALYTICS_EVENTS.freeCp12Generated, {
        appliance_count: payload.appliances.length,
        warning_notice_count: data.documents.filter((d) => d.kind === 'gas_warning_notice').length,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const saveOne = (doc: GeneratedDocument) => {
    const url = URL.createObjectURL(base64ToBlob(doc.base64));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = doc.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Revoking immediately can cancel the download in some browsers; give it a
    // moment to start.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  /**
   * Save every document, spaced out.
   *
   * Browsers block a second automatic download from one gesture unless the user
   * allows it — fired in a tight loop, an unsafe job's Gas Warning Notice would
   * silently never arrive. Spacing them makes that far less likely, and the
   * result page also lists each document with its own button so a blocked one
   * is still one tap away.
   */
  const saveToDevice = () => {
    documents.forEach((doc, i) => {
      if (i === 0) saveOne(doc);
      else window.setTimeout(() => saveOne(doc), i * 800);
    });
  };

  const handleDownload = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    track(ANALYTICS_EVENTS.freeCp12EmailSubmitted);
    try {
      const response = await fetch('/api/free-cp12/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, payload }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        emailed?: boolean;
        reference?: string;
      };
      if (!response.ok) {
        setError(data.error ?? 'Something went wrong. Try again in a moment.');
        return;
      }
      setEmailed(Boolean(data.emailed));
      setReference(data.reference ?? null);
      saveToDevice();
      setStage('done');
      track(ANALYTICS_EVENTS.freeCp12DownloadCompleted, { emailed: Boolean(data.emailed) });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------------------------ done
  if (stage === 'done') {
    return (
      <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5 sm:p-6">
        <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">
          {documents.length > 1 ? 'Your documents are downloaded' : 'Your CP12 is downloaded'}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
          {emailed
            ? 'A copy is on its way to your inbox as well.'
            : 'The files have saved to your device. We could not email a copy this time.'}
          {reference ? ` Reference ${reference}.` : ''}
        </p>
        {documents.some((d) => d.kind === 'gas_warning_notice') ? (
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
            Your warning notice downloaded alongside the certificate. Immediately Dangerous fittings
            must be reported to HSE under RIDDOR within 14 days.
          </p>
        ) : null}

        {/* The honest pitch. Inline, once, no modal. */}
        <div className="mt-5 rounded-[12px] bg-[var(--color-background-secondary)] p-4">
          <p className="text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
            We did not keep this certificate — you re-type everything next time. A CertNow account
            keeps every certificate you issue, lets you reissue them, and gives each one a shareable
            link for the landlord.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="primary">
              <a href="/signup/step1">Create an account</a>
            </Button>
          </div>
        </div>

        {/* Each document individually, so a browser that blocked the automatic
            second download has not cost the engineer their warning notice. */}
        <div className="mt-5">
          <p className="text-[13px] font-medium text-[var(--color-text-secondary)]">Your documents</p>
          <div className="mt-2 grid gap-2">
            {documents.map((doc) => (
              <button
                key={doc.reference}
                type="button"
                onClick={() => saveOne(doc)}
                className="flex items-center justify-between gap-3 rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] p-3 text-left transition-colors hover:bg-[var(--color-background-secondary)]"
              >
                <span className="text-[13px] text-[var(--color-text-primary)]">{doc.title}</span>
                <span className="shrink-0 text-[12px] text-[var(--color-text-tertiary)] underline">
                  Download
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="mt-5 text-[13px] font-medium text-[var(--color-text-tertiary)] underline"
          onClick={() => {
            setStage('form');
            setEmail('');
            setEmailed(false);
            setReference(null);
          }}
        >
          Back to the form
        </button>
      </div>
    );
  }

  // --------------------------------------------------------------- preview
  if (stage === 'preview') {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Check your certificate</h2>
          <Button variant="secondary" onClick={() => setStage('form')}>
            Back to edit
          </Button>
        </div>

        {documents.length > 1 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {documents.map((doc, i) => (
              <button
                key={doc.reference}
                type="button"
                onClick={() => setActiveDoc(i)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  i === activeDoc
                    ? 'bg-[var(--color-text-primary)] text-[var(--color-background-primary)]'
                    : 'bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)]'
                }`}
              >
                {doc.title}
              </button>
            ))}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
          <iframe
            key={docUrls[activeDoc]}
            src={docUrls[activeDoc] ?? undefined}
            title={documents[activeDoc]?.title ?? 'CP12 preview'}
            className="h-[70vh] w-full border-0"
          />
        </div>
        <p className="mt-2 text-[12px] text-[var(--color-text-tertiary)]">
          Preview not showing?{' '}
          <a className="underline" href={docUrls[activeDoc] ?? '#'} target="_blank" rel="noreferrer">
            Open the PDF in a new tab
          </a>
          .
        </p>

        {documents.some((d) => d.kind === 'gas_warning_notice') ? (
          <div className="mt-4 rounded-[12px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
              A warning notice has been produced alongside the certificate
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
              Give a copy to the responsible person. Immediately Dangerous fittings must also be
              reported to HSE under RIDDOR within 14 days — that report is not something this tool
              can make for you.
            </p>
          </div>
        ) : null}

        <form
          onSubmit={handleDownload}
          className="mt-6 rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4 sm:p-5"
        >
          <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">Download it</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-tertiary)]">
            Where should we send a copy? Your email address is the only thing we keep — the
            certificate itself is not stored. 
            <a
              href="/legal/privacy#free-tools"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              How we use it
            </a>
            .
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="sm:flex-1"
            />
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Sending…' : 'Email and download'}
            </Button>
          </div>
          {error ? <p className="mt-3 text-[13px] text-[var(--color-red)]">{error}</p> : null}
        </form>
      </div>
    );
  }

  // ------------------------------------------------------------------ form
  return (
    <div>
      <Section title="Inspection & property">
        <Field label="Inspection date">
          <Input
            type="date"
            value={payload.fields.inspection_date}
            onChange={(e) => setField('inspection_date', e.target.value)}
          />
        </Field>
        <AddressLookupField
          label="Find the property address"
          hint="Or type it in below."
          onSelect={applyPropertyAddress}
        />
        <Field label="Property address">
          <Input
            placeholder="Address line 1"
            autoComplete="address-line1"
            value={payload.fields.job_address_line1}
            onChange={(e) => setField('job_address_line1', e.target.value)}
          />
        </Field>
        <Input
          placeholder="Address line 2 (optional)"
          autoComplete="address-line2"
          value={payload.fields.job_address_line2}
          onChange={(e) => setField('job_address_line2', e.target.value)}
        />
        <Grid>
          <Field label="Town / city">
            <Input
              autoComplete="address-level2"
              value={payload.fields.job_address_city}
              onChange={(e) => setField('job_address_city', e.target.value)}
            />
          </Field>
          <Field label="Postcode">
            <Input
              autoComplete="postal-code"
              value={payload.fields.job_postcode}
              onChange={(e) => setField('job_postcode', e.target.value)}
            />
          </Field>
        </Grid>
      </Section>

      <Section
        title="Landlord or agent"
        hint="Their correspondence address, which may differ from the property."
      >
        <Grid>
          <Field label="Name">
            <Input
              value={payload.fields.landlord_name}
              onChange={(e) => setField('landlord_name', e.target.value)}
            />
          </Field>
          <Field label="Company (optional)">
            <Input
              value={payload.fields.landlord_company}
              onChange={(e) => setField('landlord_company', e.target.value)}
            />
          </Field>
        </Grid>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-[var(--color-text-secondary)]">
            Correspondence address
          </span>
          <button
            type="button"
            onClick={copyPropertyToLandlord}
            disabled={!hasPropertyAddress}
            className="rounded-[8px] bg-[var(--color-action-bg)] px-3 py-2 text-[13px] font-semibold text-[var(--color-action)] transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-action-ring)] disabled:cursor-not-allowed disabled:bg-[var(--color-background-tertiary)] disabled:text-[var(--color-text-tertiary)]"
          >
            {landlordAddressMatchesProperty
              ? 'Using property address'
              : 'Use same as property address'}
          </button>
        </div>
        {!hasPropertyAddress ? (
          <span className="-mt-2 text-[12px] text-[var(--color-text-tertiary)]">
            Add the property address first to use it here.
          </span>
        ) : null}
        <AddressLookupField
          label="Address line 1"
          value={payload.fields.landlord_address_line1}
          onValueChange={(value) => setField('landlord_address_line1', value)}
          placeholder="Start typing the landlord's address or postcode"
          autoComplete="address-line1"
          onSelect={applyLandlordAddress}
        />
        <Input
          placeholder="Address line 2 (optional)"
          autoComplete="address-line2"
          value={payload.fields.landlord_address_line2}
          onChange={(e) => setField('landlord_address_line2', e.target.value)}
        />
        <Grid>
          <Field label="Town / city">
            <Input
              autoComplete="address-level2"
              value={payload.fields.landlord_city}
              onChange={(e) => setField('landlord_city', e.target.value)}
            />
          </Field>
          <Field label="Postcode">
            <Input
              autoComplete="postal-code"
              value={payload.fields.landlord_postcode}
              onChange={(e) => setField('landlord_postcode', e.target.value)}
            />
          </Field>
        </Grid>
        <Field label="Telephone (optional)">
          <Input
            type="tel"
            inputMode="tel"
            value={payload.fields.landlord_tel}
            onChange={(e) => setField('landlord_tel', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="You" hint="Required — this identifies who carried out the check.">
        <Grid>
          <Field label="Engineer name">
            <Input
              value={payload.fields.engineer_name}
              onChange={(e) => setField('engineer_name', e.target.value)}
            />
          </Field>
          <Field label="Gas Safe registration number">
            <Input
              inputMode="numeric"
              value={payload.fields.gas_safe_number}
              onChange={(e) => setField('gas_safe_number', e.target.value)}
            />
          </Field>
        </Grid>
      </Section>

      <Section
        title="Your business details"
        collapsible
        hint="Appears in the certificate header. Omitted from the PDF if left blank."
      >
        <Grid>
          <Field label="Business name">
            <Input
              value={payload.fields.company_name}
              onChange={(e) => setField('company_name', e.target.value)}
            />
          </Field>
          <Field label="ID card number">
            <Input
              value={payload.fields.engineer_id_card_number}
              onChange={(e) => setField('engineer_id_card_number', e.target.value)}
            />
          </Field>
        </Grid>
        <Grid>
          <Field label="Business phone">
            <Input
              type="tel"
              inputMode="tel"
              value={payload.fields.company_phone}
              onChange={(e) => setField('company_phone', e.target.value)}
            />
          </Field>
          <Field label="Business email">
            <Input
              type="email"
              inputMode="email"
              value={payload.fields.company_email}
              onChange={(e) => setField('company_email', e.target.value)}
            />
          </Field>
        </Grid>
        <Field label="Business address">
          <Input
            value={payload.fields.company_address}
            onChange={(e) => setField('company_address', e.target.value)}
          />
        </Field>
      </Section>

      {payload.appliances.map((appliance, index) => {
        const category = resolveCp12Category(appliance.appliance_type);
        const combustion = cp12FieldVisibility(category, 'combustion');
        // Boilers get the boiler catalogue, hobs the hob catalogue, and so on.
        const catalog = getApplianceCatalog(category);
        const defectView = appliance as unknown as Cp12DefectAppliance;
        const failedChecks = cp12FailedChecks(defectView);
        const needsDefectNotes =
          cp12ApplianceHasFailedCheck(defectView) ||
          Boolean(appliance.safety_classification && appliance.safety_classification !== 'safe');
        const showCombustion =
          combustion === 'shown' || (combustion === 'optional' && appliance.combustion_opt_in);
        return (
          <Section key={index} title={`Appliance ${index + 1}`}>
            <EnumChips
              label="Type"
              value={appliance.appliance_type}
              options={CP12_APPLIANCE_CATEGORIES.map((c) => ({ label: c.label, value: c.value }))}
              onChange={(value) => setAppliance(index, { appliance_type: value })}
            />
            {category === 'boiler' ? (
              <EnumChips
                label="Boiler type"
                value={appliance.appliance_subtype}
                options={CP12_BOILER_SUBTYPES.map((s) => ({ label: s.label, value: s.value }))}
                onChange={(value) => setAppliance(index, { appliance_subtype: value })}
              />
            ) : null}
            <Grid>
              <SearchableSelect
                label="Location"
                value={appliance.location}
                options={LOCATION_OPTIONS}
                placeholder="Kitchen"
                onChange={(value) => setAppliance(index, { location: value })}
              />
              <SearchableSelect
                label="Make"
                value={appliance.make}
                options={catalog.getMakes().map((make) => ({ label: make, value: make }))}
                placeholder="Vaillant"
                onChange={(value) =>
                  // Changing make invalidates the model, exactly as in the paid
                  // wizard — otherwise a Worcester model can end up under Baxi.
                  setAppliance(index, {
                    make: value,
                    model: value === appliance.make ? appliance.model : '',
                  })
                }
              />
            </Grid>
            <SearchableSelect
              label="Model"
              value={appliance.model}
              options={catalog
                .getModelsForMake(appliance.make)
                .map((model) => ({ label: model, value: model }))}
              placeholder={appliance.make ? 'Start typing a model' : 'Choose a make first'}
              onChange={(value) => setAppliance(index, { model: value })}
            />

            {cp12FieldVisible(category, 'flue_type') ? (
              <SearchableSelect
                label="Flue type"
                value={appliance.flue_type}
                options={FLUE_TYPE_OPTIONS}
                placeholder="Room sealed"
                onChange={(value) => setAppliance(index, { flue_type: value })}
              />
            ) : null}

            <Grid>
              {cp12FieldVisible(category, 'operating_pressure') ? (
                <Field label="Operating pressure">
                  <Input
                    inputMode="decimal"
                    placeholder="20 mbar"
                    value={appliance.operating_pressure}
                    onChange={(e) => setAppliance(index, { operating_pressure: e.target.value })}
                  />
                </Field>
              ) : null}
              {cp12FieldVisible(category, 'heat_input') ? (
                <Field label="Heat input">
                  <Input
                    inputMode="decimal"
                    placeholder="24 kW"
                    value={appliance.heat_input}
                    onChange={(e) => setAppliance(index, { heat_input: e.target.value })}
                  />
                </Field>
              ) : null}
            </Grid>

            <div className="grid gap-4">
              {cp12FieldVisible(category, 'safety_devices_correct') ? (
                <EnumChips
                  label="Safety device(s) correct operation"
                  value={appliance.safety_devices_correct}
                  options={PASS_FAIL}
                  onChange={(value) => setAppliance(index, { safety_devices_correct: value })}
                />
              ) : null}
              {cp12FieldVisible(category, 'ventilation_satisfactory') ? (
                <EnumChips
                  label="Ventilation provision satisfactory"
                  value={appliance.ventilation_satisfactory}
                  options={PASS_FAIL}
                  onChange={(value) => setAppliance(index, { ventilation_satisfactory: value })}
                />
              ) : null}
              {cp12FieldVisible(category, 'flue_condition') ? (
                <EnumChips
                  label="Visual condition of flue and termination satisfactory"
                  value={appliance.flue_condition}
                  options={PASS_FAIL}
                  onChange={(value) => setAppliance(index, { flue_condition: value })}
                />
              ) : null}
              {cp12FieldVisible(category, 'flue_performance_test') ? (
                <EnumChips
                  label="Flue performance test"
                  value={appliance.flue_performance_test}
                  options={PASS_FAIL}
                  onChange={(value) => setAppliance(index, { flue_performance_test: value })}
                />
              ) : null}
              {cp12FieldVisible(category, 'cooker_stability') ? (
                <EnumChips
                  label="Cooker stability (bracket/chain)"
                  value={appliance.cooker_stability}
                  options={PASS_FAIL}
                  onChange={(value) => setAppliance(index, { cooker_stability: value })}
                />
              ) : null}
              {cp12FieldVisible(category, 'gas_tightness_test') ? (
                <EnumChips
                  label="Gas tightness test"
                  value={appliance.gas_tightness_test}
                  options={PASS_FAIL}
                  onChange={(value) => setAppliance(index, { gas_tightness_test: value })}
                />
              ) : null}
              {cp12FieldVisible(category, 'appliance_serviced') ? (
                <EnumChips
                  label="Appliance serviced"
                  value={appliance.appliance_serviced}
                  options={YES_NO}
                  onChange={(value) => setAppliance(index, { appliance_serviced: value })}
                />
              ) : null}
            </div>

            {combustion === 'optional' && !appliance.combustion_opt_in ? (
              <button
                type="button"
                className="justify-self-start text-[13px] font-medium text-[var(--color-text-secondary)] underline"
                onClick={() => setAppliance(index, { combustion_opt_in: true })}
              >
                Add combustion readings
              </button>
            ) : null}

            {showCombustion ? (
              <div className="rounded-[12px] bg-[var(--color-background-secondary)] p-3">
                <p className="mb-3 text-[13px] font-medium text-[var(--color-text-secondary)]">
                  Combustion readings
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="High CO (ppm)">
                    <Input
                      inputMode="decimal"
                      value={appliance.high_co_ppm}
                      onChange={(e) => setAppliance(index, { high_co_ppm: e.target.value })}
                    />
                  </Field>
                  <Field label="High CO₂ (%)">
                    <Input
                      inputMode="decimal"
                      value={appliance.high_co2}
                      onChange={(e) => setAppliance(index, { high_co2: e.target.value })}
                    />
                  </Field>
                  <Field label="High ratio">
                    <Input
                      inputMode="decimal"
                      value={appliance.high_ratio}
                      onChange={(e) => setAppliance(index, { high_ratio: e.target.value })}
                    />
                  </Field>
                  <Field label="Low CO (ppm)">
                    <Input
                      inputMode="decimal"
                      value={appliance.low_co_ppm}
                      onChange={(e) => setAppliance(index, { low_co_ppm: e.target.value })}
                    />
                  </Field>
                  <Field label="Low CO₂ (%)">
                    <Input
                      inputMode="decimal"
                      value={appliance.low_co2}
                      onChange={(e) => setAppliance(index, { low_co2: e.target.value })}
                    />
                  </Field>
                  <Field label="Low ratio">
                    <Input
                      inputMode="decimal"
                      value={appliance.low_ratio}
                      onChange={(e) => setAppliance(index, { low_ratio: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            ) : null}

            <EnumChips
              label="Condition classification"
              value={appliance.safety_classification}
              options={CLASSIFICATIONS}
              onChange={(value) => setAppliance(index, { safety_classification: value })}
            />

            {/* A failed check is a defect in its own right (Reg 36(3)(e)), so the
                notes open on any fail — not only once the appliance has been
                classified. What is typed here feeds the record-level summary. */}
            {needsDefectNotes ? (
              <div className="rounded-[12px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                {failedChecks.length ? (
                  <p className="mb-3 text-[13px] text-[var(--color-text-secondary)]">
                    Failed: {failedChecks.join(', ')}. This appears in “Defects identified” below.
                  </p>
                ) : null}

                {failedChecks.length && !appliance.safety_classification ? (
                  <p className="mb-3 text-[13px] font-medium text-[var(--color-red)]">
                    Classify this appliance above — a failed check needs a classification, and an
                    At Risk or Immediately Dangerous one also produces a warning notice.
                  </p>
                ) : null}

                <div className="grid gap-4">
                  <Field label="Defect / unsafe situation">
                    <Textarea
                      value={appliance.defect_notes}
                      onChange={(e) => setAppliance(index, { defect_notes: e.target.value })}
                    />
                  </Field>
                  <PresetChips
                    presets={UNSAFE_SITUATION_PRESETS}
                    value={appliance.defect_notes}
                    onChange={(next) => setAppliance(index, { defect_notes: next })}
                  />
                  <Field label="Actions taken">
                    <Textarea
                      value={appliance.actions_taken}
                      onChange={(e) => setAppliance(index, { actions_taken: e.target.value })}
                    />
                  </Field>
                  <PresetChips
                    presets={ACTION_TAKEN_PRESETS}
                    value={appliance.actions_taken}
                    onChange={(next) => setAppliance(index, { actions_taken: next })}
                  />
                  <Field label="Actions required">
                    <Textarea
                      value={appliance.actions_required}
                      onChange={(e) => setAppliance(index, { actions_required: e.target.value })}
                    />
                  </Field>
                  <PresetChips
                    presets={ACTION_REQUIRED_PRESETS}
                    value={appliance.actions_required}
                    onChange={(next) => setAppliance(index, { actions_required: next })}
                  />
                </div>
              </div>
            ) : null}

            {gwnClassificationFor(appliance) ? (
              <UnsafeSituationFields
                classification={gwnClassificationFor(appliance)!}
                answers={appliance.unsafe_situation}
                onChange={(key, value) => setUnsafeSituation(index, { [key]: value })}
              />
            ) : null}

            <label className="flex items-start gap-3 rounded-[12px] bg-[var(--color-background-secondary)] p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0"
                checked={appliance.reg_26_9_confirmed}
                onChange={(e) => setAppliance(index, { reg_26_9_confirmed: e.target.checked })}
              />
              <span className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                I confirm the safety checks required by Regulation 26(9)(a)–(d) were carried out on
                this appliance and its flue.
              </span>
            </label>

            {payload.appliances.length > 1 ? (
              <button
                type="button"
                className="justify-self-start text-[13px] font-medium text-[var(--color-red)] underline"
                onClick={() => removeAppliance(index)}
              >
                Remove appliance {index + 1}
              </button>
            ) : null}
          </Section>
        );
      })}

      <div className="mb-6">
        {payload.appliances.length < MAX_APPLIANCES ? (
          <Button variant="secondary" onClick={addAppliance}>
            Add another appliance
          </Button>
        ) : (
          <p className="text-[13px] text-[var(--color-text-tertiary)]">
            {MAX_APPLIANCES} appliances is the limit for the free tool. An account has no limit.
          </p>
        )}
      </div>

      <Section title="Whole-property checks" collapsible hint="Leave blank if not checked.">
        <Grid>
          <EnumChips
            label="CO alarm fitted"
            value={payload.fields.co_alarm_fitted}
            options={YES_NO}
            onChange={(value) => setField('co_alarm_fitted', value)}
          />
          <EnumChips
            label="CO alarm tested"
            value={payload.fields.co_alarm_tested}
            options={YES_NO}
            onChange={(value) => setField('co_alarm_tested', value)}
          />
          <EnumChips
            label="CO alarm satisfactory"
            value={payload.fields.co_alarm_satisfactory}
            options={YES_NO}
            onChange={(value) => setField('co_alarm_satisfactory', value)}
          />
          <EnumChips
            label="Emergency control accessible"
            value={payload.fields.emergency_control_accessible}
            options={YES_NO}
            onChange={(value) => setField('emergency_control_accessible', value)}
          />
          <EnumChips
            label="Gas tightness satisfactory"
            value={payload.fields.gas_tightness_satisfactory}
            options={PASS_FAIL}
            onChange={(value) => setField('gas_tightness_satisfactory', value)}
          />
          <EnumChips
            label="Pipework visual inspection satisfactory"
            value={payload.fields.pipework_visual_satisfactory}
            options={PASS_FAIL}
            onChange={(value) => setField('pipework_visual_satisfactory', value)}
          />
          <EnumChips
            label="Equipotential bonding satisfactory"
            value={payload.fields.equipotential_bonding_satisfactory}
            options={PASS_FAIL}
            onChange={(value) => setField('equipotential_bonding_satisfactory', value)}
          />
        </Grid>
      </Section>

      <Section
        title="Defects and remedial action"
        // Reg 36(3)(e)/(f) content: optional to fill while everything is safe
        // (the certificate prints "None identified"), but required the moment an
        // appliance is unsafe — so it stops collapsing at that point.
        collapsible={!hasUnsafeAppliance}
        hint={
          hasUnsafeAppliance
            ? 'Required — an appliance on this record is unsafe.'
            : 'Leave blank if there were none — the certificate will say so.'
        }
      >
        <Field
          label="Defects identified"
          hint={
            defectsDirty
              ? 'You have edited this, so it no longer updates automatically.'
              : 'Filled in automatically from failed checks and appliance notes. Edit freely.'
          }
        >
          <Textarea
            value={payload.fields.defect_description}
            onChange={(e) => {
              setDefectsDirty(true);
              setField('defect_description', e.target.value);
            }}
          />
        </Field>
        <PresetChips
          presets={UNSAFE_SITUATION_PRESETS}
          value={payload.fields.defect_description}
          onChange={(next) => {
            setDefectsDirty(true);
            setField('defect_description', next);
          }}
        />
        {defectsDirty && composed.defect_description ? (
          <button
            type="button"
            className="justify-self-start text-[13px] font-medium text-[var(--color-text-secondary)] underline"
            onClick={() => {
              setDefectsDirty(false);
              setField('defect_description', composed.defect_description);
            }}
          >
            Reset to the automatic summary
          </button>
        ) : null}

        <Field
          label="Remedial action taken"
          hint={
            remedialDirty
              ? 'You have edited this, so it no longer updates automatically.'
              : 'Filled in automatically from the actions recorded on each appliance. Edit freely.'
          }
        >
          <Textarea
            value={payload.fields.remedial_action}
            onChange={(e) => {
              setRemedialDirty(true);
              setField('remedial_action', e.target.value);
            }}
          />
        </Field>
        <PresetChips
          presets={ACTION_TAKEN_PRESETS}
          value={payload.fields.remedial_action}
          onChange={(next) => {
            setRemedialDirty(true);
            setField('remedial_action', next);
          }}
        />
        {remedialDirty && composed.remedial_action ? (
          <button
            type="button"
            className="justify-self-start text-[13px] font-medium text-[var(--color-text-secondary)] underline"
            onClick={() => {
              setRemedialDirty(false);
              setField('remedial_action', composed.remedial_action);
            }}
          >
            Reset to the automatic summary
          </button>
        ) : null}
        <Field label="Additional notes (optional)">
          <Textarea
            value={payload.fields.comments}
            onChange={(e) => setField('comments', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Your signature">
        <SignaturePad
          label="Engineer"
          captured={Boolean(payload.fields.engineer_signature)}
          onCapture={(dataUrl) => setField('engineer_signature', dataUrl)}
          onClear={() => setField('engineer_signature', '')}
        />
      </Section>

      {issues.length ? (
        <div className="mb-4 rounded-[12px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
          <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
            A CP12 needs these before it can be issued:
          </p>
          <ul className="mt-2 list-disc pl-5 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="mb-4 text-[13px] text-[var(--color-red)]">{error}</p> : null}

      <div className="sticky bottom-4 flex justify-end">
        <Button variant="primary" onClick={handleGenerate} disabled={busy} className="shadow-lg">
          {busy ? 'Generating…' : 'Generate CP12'}
        </Button>
      </div>
    </div>
  );
}
