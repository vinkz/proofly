'use client';

/**
 * The free boiler service form.
 *
 * Stateless by design, like the free CP12 form: state lives here and dies with
 * the tab. No autosave, no localStorage, no prefill, no server draft — that is
 * the free/paid boundary, so do not add persistence here.
 *
 * The required spine is short on purpose. A service record has no statutory
 * content list (audit/gas-service-field-analysis.md); the shared
 * validateGasServiceForIssue gate blocks only on engineer identity, appliance
 * identity and the Reg 26(9) safety outcomes. Everything else is Benchmark
 * convention and stays optional.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EnumChips } from '@/components/wizard/inputs/enum-chips';
import { SignaturePad } from '@/components/certificates/signature-pad';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics/events';
import {
  emptyFreeBoilerServicePayload,
  freeBoilerServiceValidationInput,
  type FreeBoilerServicePayload,
} from '@/lib/boiler-service/freeBoilerServicePayload';
import { validateGasServiceForIssue } from '@/lib/gas-service/validation';
import { AddressLookupField } from '@/components/address/address-lookup-field';
import type { AddressLookupResult } from '@/lib/address-lookup';
import { SearchableSelect } from '@/components/wizard/inputs/searchable-select';
import { getMakes, getModelsForMake } from '@/lib/applianceCatalog/ukBoilers';
import { CP12_FLUE_TYPES, CP12_LOCATIONS } from '@/types/cp12';
import { resolveCp12FlueKind } from '@/lib/cp12/applianceConfig';
import { toUserMessage } from '@/lib/user-errors';

const PASS_FAIL = [
  { label: 'Pass', value: 'pass' },
  { label: 'Fail', value: 'fail' },
];
const YES_NO = [
  { label: 'Yes', value: 'Yes' },
  { label: 'No', value: 'No' },
];
const LOCATION_OPTIONS = CP12_LOCATIONS.map((l) => ({ label: l.label, value: l.label }));
const FLUE_TYPE_OPTIONS = CP12_FLUE_TYPES.map((f) => ({ label: f.label, value: f.label }));

const BOILER_TYPES = [
  { label: 'Combi', value: 'combi' },
  { label: 'System', value: 'system' },
  { label: 'Regular', value: 'regular' },
  { label: 'Other', value: 'other' },
];

type Stage = 'form' | 'preview' | 'done';
type Field = keyof FreeBoilerServicePayload;

const SECTION_CLASS =
  'mb-6 rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4 sm:p-5';

/**
 * A form section. Sections holding only optional fields collapse by default, so
 * the required path down the page stays short — this is filled in on a phone,
 * often one-handed. That matters more here than on the CP12: the required spine
 * is tiny and most of this form is Benchmark convention.
 *
 * Uses native <details>: keyboard and screen-reader accessible for free,
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

function FieldLabel({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
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

export function FreeBoilerServiceForm() {
  const [payload, setPayload] = useState<FreeBoilerServicePayload>(() => emptyFreeBoilerServicePayload());
  const [stage, setStage] = useState<Stage>('form');
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailed, setEmailed] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const startedRef = useRef(false);
  const pdfBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const markStarted = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    track(ANALYTICS_EVENTS.freeBoilerServiceFormStarted);
  }, []);

  const set = useCallback(
    (key: Field, value: string) => {
      markStarted();
      setPayload((prev) => ({ ...prev, [key]: value }));
    },
    [markStarted],
  );

  // Shared with the CP12 rather than restated: the flue test an appliance needs
  // is a property of how it is flued, not of which document is recording it.
  const flueKind = resolveCp12FlueKind(payload.flue_type);

  const localIssues = useMemo(() => {
    try {
      return validateGasServiceForIssue(freeBoilerServiceValidationInput(payload));
    } catch {
      return [];
    }
  }, [payload]);

  const applyPropertyAddress = useCallback(
    (address: AddressLookupResult) => {
      markStarted();
      setPayload((prev) => ({
        ...prev,
        job_address_line1: address.line1 || address.summary,
        job_address_line2: address.line2,
        job_address_city: address.city,
        job_postcode: address.postcode,
      }));
    },
    [markStarted],
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
      const response = await fetch('/api/free-boiler-service/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string; issues?: string[] };
        setIssues(data.issues ?? []);
        setError(
          toUserMessage(
            data.error,
            'We could not generate the service record. Check the highlighted answers and try again.',
          ),
        );
        return;
      }
      const blob = await response.blob();
      pdfBlobRef.current = blob;
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
      setStage('preview');
      track(ANALYTICS_EVENTS.freeBoilerServiceGenerated);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const saveToDevice = () => {
    const blob = pdfBlobRef.current;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'boiler-service-record.pdf';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownload = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    track(ANALYTICS_EVENTS.freeBoilerServiceEmailSubmitted);
    try {
      const response = await fetch('/api/free-boiler-service/download', {
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
        setError(
          toUserMessage(
            data.error,
            'We could not prepare the download. Check your email address and try again.',
          ),
        );
        return;
      }
      setEmailed(Boolean(data.emailed));
      setReference(data.reference ?? null);
      saveToDevice();
      setStage('done');
      track(ANALYTICS_EVENTS.freeBoilerServiceDownloadCompleted, { emailed: Boolean(data.emailed) });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (stage === 'done') {
    return (
      <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5 sm:p-6">
        <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">
          Your service record is downloaded
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
          {emailed
            ? 'A copy is on its way to your inbox as well.'
            : 'The file has saved to your device. We could not email a copy this time.'}
          {reference ? ` Reference ${reference}.` : ''}
        </p>

        <div className="mt-5 rounded-[12px] bg-[var(--color-background-secondary)] p-4">
          <p className="text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
            We did not keep this record — you re-type everything next time. A CertNow account keeps
            every record you issue, lets you reissue them, and gives each one a shareable link for
            the customer.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="primary">
              <a href="/signup/step1">Create an account</a>
            </Button>
            <Button variant="secondary" onClick={saveToDevice}>
              Download again
            </Button>
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

  if (stage === 'preview') {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Check your record</h2>
          <Button variant="secondary" onClick={() => setStage('form')}>
            Back to edit
          </Button>
        </div>

        <div className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
          <iframe src={pdfUrl ?? undefined} title="Service record preview" className="h-[70vh] w-full border-0" />
        </div>
        <p className="mt-2 text-[12px] text-[var(--color-text-tertiary)]">
          Preview not showing?{' '}
          <a className="underline" href={pdfUrl ?? '#'} target="_blank" rel="noreferrer">
            Open the PDF in a new tab
          </a>
          .
        </p>

        <form
          onSubmit={handleDownload}
          className="mt-6 rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4 sm:p-5"
        >
          <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">Download it</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-tertiary)]">
            Where should we send a copy? Your email address is the only thing we keep — the record
            itself is not stored.{' '}
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
          {error ? <p role="alert" className="mt-3 text-[13px] text-[var(--color-red)]">{error}</p> : null}
        </form>
      </div>
    );
  }

  return (
    <div>
      <Section title="Visit & property">
        <FieldLabel label="Service date">
          <Input type="date" value={payload.service_date} onChange={(e) => set('service_date', e.target.value)} />
        </FieldLabel>
        <AddressLookupField
          label="Find the property address"
          hint="Or type it in below."
          onSelect={applyPropertyAddress}
        />
        <FieldLabel label="Property address">
          <Input
            placeholder="Address line 1"
            autoComplete="address-line1"
            value={payload.job_address_line1}
            onChange={(e) => set('job_address_line1', e.target.value)}
          />
        </FieldLabel>
        <Input
          placeholder="Address line 2 (optional)"
          value={payload.job_address_line2}
          onChange={(e) => set('job_address_line2', e.target.value)}
        />
        <Grid>
          <FieldLabel label="Town / city">
            <Input value={payload.job_address_city} onChange={(e) => set('job_address_city', e.target.value)} />
          </FieldLabel>
          <FieldLabel label="Postcode">
            <Input value={payload.job_postcode} onChange={(e) => set('job_postcode', e.target.value)} />
          </FieldLabel>
        </Grid>
      </Section>

      <Section title="Customer" collapsible hint="A service record is not a landlord document.">
        <Grid>
          <FieldLabel label="Name">
            <Input value={payload.customer_name} onChange={(e) => set('customer_name', e.target.value)} />
          </FieldLabel>
          <FieldLabel label="Telephone">
            <Input
              type="tel"
              inputMode="tel"
              value={payload.customer_phone}
              onChange={(e) => set('customer_phone', e.target.value)}
            />
          </FieldLabel>
        </Grid>
      </Section>

      <Section title="You" hint="Required — this identifies who carried out the work.">
        <Grid>
          <FieldLabel label="Engineer name">
            <Input value={payload.engineer_name} onChange={(e) => set('engineer_name', e.target.value)} />
          </FieldLabel>
          <FieldLabel label="Gas Safe registration number">
            <Input
              inputMode="numeric"
              value={payload.gas_safe_number}
              onChange={(e) => set('gas_safe_number', e.target.value)}
            />
          </FieldLabel>
        </Grid>
      </Section>

      <Section
        title="Your business details"
        collapsible
        hint="Appears in the record header. Omitted from the PDF if left blank."
      >
        <Grid>
          <FieldLabel label="Business name">
            <Input value={payload.company_name} onChange={(e) => set('company_name', e.target.value)} />
          </FieldLabel>
          <FieldLabel label="Business phone">
            <Input
              type="tel"
              inputMode="tel"
              value={payload.company_phone}
              onChange={(e) => set('company_phone', e.target.value)}
            />
          </FieldLabel>
        </Grid>
        <FieldLabel label="ID card number">
          <Input
            value={payload.engineer_id_card_number}
            onChange={(e) => set('engineer_id_card_number', e.target.value)}
          />
        </FieldLabel>
        <FieldLabel label="Business address">
          <Input value={payload.company_address} onChange={(e) => set('company_address', e.target.value)} />
        </FieldLabel>
      </Section>

      <Section title="Appliance">
        <Grid>
          <SearchableSelect
            label="Make"
            value={payload.boiler_make}
            options={getMakes().map((make) => ({ label: make, value: make }))}
            placeholder="Vaillant"
            onChange={(value) => {
              // Changing make invalidates the model, as in the paid wizard.
              markStarted();
              setPayload((prev) => ({
                ...prev,
                boiler_make: value,
                boiler_model: value === prev.boiler_make ? prev.boiler_model : '',
              }));
            }}
          />
          <SearchableSelect
            label="Model"
            value={payload.boiler_model}
            options={getModelsForMake(payload.boiler_make).map((m) => ({ label: m, value: m }))}
            placeholder={payload.boiler_make ? 'Start typing a model' : 'Choose a make first'}
            onChange={(value) => set('boiler_model', value)}
          />
        </Grid>
        <EnumChips
          label="Type"
          value={payload.boiler_type}
          options={BOILER_TYPES}
          onChange={(value) => set('boiler_type', value)}
        />
        <Grid>
          <SearchableSelect
            label="Location"
            value={payload.boiler_location}
            options={LOCATION_OPTIONS}
            placeholder="Kitchen"
            onChange={(value) => set('boiler_location', value)}
          />
          <FieldLabel label="Serial number (optional)">
            <Input value={payload.serial_number} onChange={(e) => set('serial_number', e.target.value)} />
          </FieldLabel>
          <FieldLabel label="GC number (optional)">
            <Input
              placeholder="47-311-92"
              value={payload.gc_number}
              onChange={(e) => set('gc_number', e.target.value)}
            />
          </FieldLabel>
        </Grid>
        <SearchableSelect
          label="Flue type (optional)"
          value={payload.flue_type}
          options={FLUE_TYPE_OPTIONS}
          placeholder="Room sealed"
          onChange={(value) => set('flue_type', value)}
        />
      </Section>

      <Section
        title="Safety examination"
        hint="Regulation 26(9) — the outcomes that must be recorded after working on the appliance."
      >
        <EnumChips
          label="Flue safe"
          value={payload.appliance_flueing_safe}
          options={PASS_FAIL}
          onChange={(value) => set('appliance_flueing_safe', value)}
        />
        {/* Which flue test applies is decided by the flue type, exactly as on a
            CP12 — a room-sealed appliance gets the integrity test, an open-flued
            one gets flow and spillage. The rule is shared, not restated here. */}
        {flueKind === 'room_sealed' || flueKind === 'unknown' ? (
          <>
            <EnumChips
              label="Flue integrity test"
              hint="Analyser at the air-inlet sampling point, at maximum and minimum rate."
              value={payload.flue_integrity_test}
              options={PASS_FAIL}
              onChange={(value) => set('flue_integrity_test', value)}
            />
            {payload.flue_integrity_test ? (
              <Grid>
                <FieldLabel label="Air inlet CO2 at high rate (optional)">
                  <Input
                    inputMode="decimal"
                    placeholder="0.02 %"
                    value={payload.flue_integrity_co2_high}
                    onChange={(e) => set('flue_integrity_co2_high', e.target.value)}
                  />
                </FieldLabel>
                <FieldLabel label="Air inlet CO2 at low rate (optional)">
                  <Input
                    inputMode="decimal"
                    placeholder="0.01 %"
                    value={payload.flue_integrity_co2_low}
                    onChange={(e) => set('flue_integrity_co2_low', e.target.value)}
                  />
                </FieldLabel>
              </Grid>
            ) : null}
          </>
        ) : null}
        {flueKind === 'open_flue' || flueKind === 'unknown' ? (
          <>
            <EnumChips
              label="Flue flow test"
              value={payload.flue_flow_test}
              options={PASS_FAIL}
              onChange={(value) => set('flue_flow_test', value)}
            />
            <EnumChips
              label="Spillage test"
              hint="Smoke match at the draught diverter with doors and windows shut."
              value={payload.spillage_test}
              options={PASS_FAIL}
              onChange={(value) => set('spillage_test', value)}
            />
          </>
        ) : null}
        <EnumChips
          label="Ventilation safe"
          value={payload.appliance_ventilation_safe}
          options={PASS_FAIL}
          onChange={(value) => set('appliance_ventilation_safe', value)}
        />
        <Grid>
          <FieldLabel label="Operating pressure">
            <Input
              inputMode="decimal"
              placeholder="20 mbar"
              value={payload.operating_pressure}
              onChange={(e) => set('operating_pressure', e.target.value)}
            />
          </FieldLabel>
          <FieldLabel label="Heat input">
            <Input
              inputMode="decimal"
              placeholder="24 kW"
              value={payload.heat_input}
              onChange={(e) => set('heat_input', e.target.value)}
            />
          </FieldLabel>
        </Grid>
        <EnumChips
          label="Appliance safe to use"
          value={payload.appliance_safe}
          options={YES_NO}
          onChange={(value) => set('appliance_safe', value)}
        />
        <FieldLabel label="Tightness test (optional)">
          <Input value={payload.tightness_test} onChange={(e) => set('tightness_test', e.target.value)} />
        </FieldLabel>
      </Section>

      <Section title="Service tasks" collapsible hint="Benchmark convention — never blocks the record.">
        <EnumChips
          label="Visual inspection"
          value={payload.service_visual_inspection}
          options={YES_NO}
          onChange={(value) => set('service_visual_inspection', value)}
        />
        <EnumChips
          label="Burner cleaned"
          value={payload.service_burner_cleaned}
          options={YES_NO}
          onChange={(value) => set('service_burner_cleaned', value)}
        />
        <EnumChips
          label="Heat exchanger cleaned"
          value={payload.service_heat_exchanger_cleaned}
          options={YES_NO}
          onChange={(value) => set('service_heat_exchanger_cleaned', value)}
        />
        <EnumChips
          label="Condensate checked"
          value={payload.service_condensate_checked}
          options={YES_NO}
          onChange={(value) => set('service_condensate_checked', value)}
        />
        <EnumChips
          label="Seals checked"
          value={payload.service_seals_checked}
          options={YES_NO}
          onChange={(value) => set('service_seals_checked', value)}
        />
        <EnumChips
          label="Controls tested"
          value={payload.service_controls_tested}
          options={YES_NO}
          onChange={(value) => set('service_controls_tested', value)}
        />
      </Section>

      <Section title="Combustion readings" collapsible hint="Mandatory at commissioning under Benchmark, optional for a service.">
        <div className="grid gap-3 sm:grid-cols-3">
          <FieldLabel label="High CO (ppm)">
            <Input inputMode="decimal" value={payload.high_co_ppm} onChange={(e) => set('high_co_ppm', e.target.value)} />
          </FieldLabel>
          <FieldLabel label="High CO₂ (%)">
            <Input inputMode="decimal" value={payload.high_co2} onChange={(e) => set('high_co2', e.target.value)} />
          </FieldLabel>
          <FieldLabel label="High ratio">
            <Input inputMode="decimal" value={payload.high_ratio} onChange={(e) => set('high_ratio', e.target.value)} />
          </FieldLabel>
          <FieldLabel label="Low CO (ppm)">
            <Input inputMode="decimal" value={payload.low_co_ppm} onChange={(e) => set('low_co_ppm', e.target.value)} />
          </FieldLabel>
          <FieldLabel label="Low CO₂ (%)">
            <Input inputMode="decimal" value={payload.low_co2} onChange={(e) => set('low_co2', e.target.value)} />
          </FieldLabel>
          <FieldLabel label="Low ratio">
            <Input inputMode="decimal" value={payload.low_ratio} onChange={(e) => set('low_ratio', e.target.value)} />
          </FieldLabel>
        </div>
      </Section>

      <Section title="Findings">
        <EnumChips
          label="Defects found"
          value={payload.defects_found}
          options={YES_NO}
          onChange={(value) => set('defects_found', value)}
        />
        {payload.defects_found === 'Yes' || payload.appliance_safe === 'No' ? (
          <>
            <FieldLabel label="Defect description">
              <Textarea value={payload.defect_description} onChange={(e) => set('defect_description', e.target.value)} />
            </FieldLabel>
            <FieldLabel label="Remedial action">
              <Textarea value={payload.remedial_action} onChange={(e) => set('remedial_action', e.target.value)} />
            </FieldLabel>
          </>
        ) : null}
        <FieldLabel label="Engineer comments (optional)">
          <Textarea value={payload.engineer_comments} onChange={(e) => set('engineer_comments', e.target.value)} />
        </FieldLabel>
        <FieldLabel label="Next service due (optional)">
          <Input type="date" value={payload.next_service_date} onChange={(e) => set('next_service_date', e.target.value)} />
        </FieldLabel>
      </Section>

      <Section title="Your signature">
        <SignaturePad
          label="Engineer"
          captured={Boolean(payload.engineer_signature)}
          onCapture={(dataUrl) => set('engineer_signature', dataUrl)}
          onClear={() => set('engineer_signature', '')}
        />
      </Section>

      {issues.length ? (
        <div className="mb-4 rounded-[12px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
          <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
            A service record needs these before it can be issued:
          </p>
          <ul className="mt-2 list-disc pl-5 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p role="alert" className="mb-4 text-[13px] text-[var(--color-red)]">{error}</p> : null}

      <div className="sticky bottom-4 flex justify-end">
        <Button variant="primary" onClick={handleGenerate} disabled={busy} className="shadow-lg">
          {busy ? 'Generating…' : 'Generate record'}
        </Button>
      </div>
    </div>
  );
}
