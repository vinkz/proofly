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
import { useSignaturePad } from '@/hooks/useSignaturePad';
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
} from '@/lib/cp12/freeCp12Payload';
import { validateCp12TierOne } from '@/lib/cp12/validation';

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

type Stage = 'form' | 'preview' | 'done';

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4 sm:p-5">
      <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">{title}</h2>
      {hint ? <p className="mt-1 text-[13px] text-[var(--color-text-tertiary)]">{hint}</p> : null}
      <div className="mt-4 grid gap-4">{children}</div>
    </section>
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
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailed, setEmailed] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  // Categories whose combustion block is opt-in and has been opted into.
  const [combustionOptIn, setCombustionOptIn] = useState<Record<number, boolean>>({});

  const startedRef = useRef(false);
  const pdfBlobRef = useRef<Blob | null>(null);
  const pad = useSignaturePad();

  // Revoke the preview object URL when it is replaced or the tab closes, so the
  // certificate does not linger in memory longer than the visit.
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

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

  const addAppliance = () => {
    markStarted();
    setPayload((prev) => ({ ...prev, appliances: [...prev.appliances, emptyFreeCp12Appliance()] }));
  };

  const removeAppliance = (index: number) => {
    setPayload((prev) => ({
      ...prev,
      appliances: prev.appliances.length > 1 ? prev.appliances.filter((_, i) => i !== index) : prev.appliances,
    }));
    setCombustionOptIn((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  /**
   * Local view of the same statutory gate the server applies. Shown as a list
   * after a generate attempt — never used to disable inputs or block typing.
   */
  const localIssues = useMemo(() => {
    try {
      return validateCp12TierOne(freeCp12ValidationInput(payload));
    } catch {
      return [];
    }
  }, [payload]);

  const captureSignature = () => {
    if (!pad.hasInk()) {
      setError('Draw your signature in the box first.');
      return;
    }
    setField('engineer_signature', pad.toDataUrl());
    setError(null);
  };

  const clearSignature = () => {
    pad.clear();
    setField('engineer_signature', '');
  };

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
      const blob = await response.blob();
      pdfBlobRef.current = blob;
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
      setStage('preview');
      track(ANALYTICS_EVENTS.freeCp12Generated, { appliance_count: payload.appliances.length });
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
    anchor.download = 'cp12-landlord-gas-safety-record.pdf';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
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
        <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Your CP12 is downloaded</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
          {emailed
            ? 'A copy is on its way to your inbox as well.'
            : 'The file has saved to your device. We could not email a copy this time.'}
          {reference ? ` Reference ${reference}.` : ''}
        </p>

        {/* The honest pitch. Inline, once, no modal. */}
        <div className="mt-5 rounded-[12px] bg-[var(--color-background-secondary)] p-4">
          <p className="text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
            We did not keep this certificate — you re-type everything next time. A CertNow account
            keeps every certificate you issue, lets you reissue them, and gives each one a shareable
            link for the landlord.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="primary">
              <a href="/signup">Create an account</a>
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

        <div className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
          <iframe src={pdfUrl ?? undefined} title="CP12 preview" className="h-[70vh] w-full border-0" />
        </div>
        <p className="mt-2 text-[12px] text-[var(--color-text-tertiary)]">
          Preview not showing?{' '}
          <a
            className="underline"
            href={pdfUrl ?? '#'}
            target="_blank"
            rel="noreferrer"
          >
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
            Where should we send a copy? Your email address is the only thing we keep — the
            certificate itself is not stored.
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
        <Input
          placeholder="Address line 1"
          value={payload.fields.landlord_address_line1}
          onChange={(e) => setField('landlord_address_line1', e.target.value)}
        />
        <Input
          placeholder="Address line 2 (optional)"
          value={payload.fields.landlord_address_line2}
          onChange={(e) => setField('landlord_address_line2', e.target.value)}
        />
        <Grid>
          <Field label="Town / city">
            <Input
              value={payload.fields.landlord_city}
              onChange={(e) => setField('landlord_city', e.target.value)}
            />
          </Field>
          <Field label="Postcode">
            <Input
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

      <Section title="You and your business" hint="This is what appears at the top of the certificate.">
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
        <Grid>
          <Field label="ID card number (optional)">
            <Input
              value={payload.fields.engineer_id_card_number}
              onChange={(e) => setField('engineer_id_card_number', e.target.value)}
            />
          </Field>
          <Field label="Business name (optional)">
            <Input
              value={payload.fields.company_name}
              onChange={(e) => setField('company_name', e.target.value)}
            />
          </Field>
        </Grid>
        <Grid>
          <Field label="Business phone (optional)">
            <Input
              type="tel"
              inputMode="tel"
              value={payload.fields.company_phone}
              onChange={(e) => setField('company_phone', e.target.value)}
            />
          </Field>
          <Field label="Business email (optional)">
            <Input
              type="email"
              inputMode="email"
              value={payload.fields.company_email}
              onChange={(e) => setField('company_email', e.target.value)}
            />
          </Field>
        </Grid>
        <Field label="Business address (optional)">
          <Input
            value={payload.fields.company_address}
            onChange={(e) => setField('company_address', e.target.value)}
          />
        </Field>
      </Section>

      {payload.appliances.map((appliance, index) => {
        const category = resolveCp12Category(appliance.appliance_type);
        const combustion = cp12FieldVisibility(category, 'combustion');
        const showCombustion = combustion === 'shown' || (combustion === 'optional' && combustionOptIn[index]);
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
              <Field label="Location">
                <Input
                  placeholder="Kitchen"
                  value={appliance.location}
                  onChange={(e) => setAppliance(index, { location: e.target.value })}
                />
              </Field>
              <Field label="Make and model">
                <Input
                  placeholder="Vaillant EcoTec"
                  value={appliance.make_model}
                  onChange={(e) => setAppliance(index, { make_model: e.target.value })}
                />
              </Field>
            </Grid>

            {cp12FieldVisible(category, 'flue_type') ? (
              <Field label="Flue type">
                <Input
                  placeholder="Room sealed"
                  value={appliance.flue_type}
                  onChange={(e) => setAppliance(index, { flue_type: e.target.value })}
                />
              </Field>
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
                  label="Safety devices operating correctly"
                  value={appliance.safety_devices_correct}
                  options={PASS_FAIL}
                  onChange={(value) => setAppliance(index, { safety_devices_correct: value })}
                />
              ) : null}
              {cp12FieldVisible(category, 'ventilation_satisfactory') ? (
                <EnumChips
                  label="Ventilation satisfactory"
                  value={appliance.ventilation_satisfactory}
                  options={PASS_FAIL}
                  onChange={(value) => setAppliance(index, { ventilation_satisfactory: value })}
                />
              ) : null}
              {cp12FieldVisible(category, 'flue_condition') ? (
                <EnumChips
                  label="Visual condition of flue and termination"
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
                  label="Cooker stability bracket / chain"
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

            {combustion === 'optional' && !combustionOptIn[index] ? (
              <button
                type="button"
                className="justify-self-start text-[13px] font-medium text-[var(--color-text-secondary)] underline"
                onClick={() => setCombustionOptIn((prev) => ({ ...prev, [index]: true }))}
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
              label="Classification"
              value={appliance.safety_classification}
              options={CLASSIFICATIONS}
              onChange={(value) => setAppliance(index, { safety_classification: value })}
            />

            {appliance.safety_classification && appliance.safety_classification !== 'safe' ? (
              <>
                <Field label="Defect found">
                  <Textarea
                    value={appliance.defect_notes}
                    onChange={(e) => setAppliance(index, { defect_notes: e.target.value })}
                  />
                </Field>
                <Field label="Action taken">
                  <Textarea
                    value={appliance.actions_taken}
                    onChange={(e) => setAppliance(index, { actions_taken: e.target.value })}
                  />
                </Field>
                <EnumChips
                  label="Warning notice issued"
                  value={appliance.warning_notice_issued ? 'Yes' : 'No'}
                  options={YES_NO}
                  onChange={(value) => setAppliance(index, { warning_notice_issued: value === 'Yes' })}
                />
              </>
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
        <Button variant="secondary" onClick={addAppliance}>
          Add another appliance
        </Button>
      </div>

      <Section title="Whole-property checks" hint="Optional. Leave blank if not checked.">
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
            label="Emergency control accessible"
            value={payload.fields.emergency_control_accessible}
            options={YES_NO}
            onChange={(value) => setField('emergency_control_accessible', value)}
          />
          <EnumChips
            label="Gas installation tightness"
            value={payload.fields.gas_tightness_satisfactory}
            options={PASS_FAIL}
            onChange={(value) => setField('gas_tightness_satisfactory', value)}
          />
          <EnumChips
            label="Visual pipework inspection"
            value={payload.fields.pipework_visual_satisfactory}
            options={PASS_FAIL}
            onChange={(value) => setField('pipework_visual_satisfactory', value)}
          />
          <EnumChips
            label="Equipotential bonding"
            value={payload.fields.equipotential_bonding_satisfactory}
            options={PASS_FAIL}
            onChange={(value) => setField('equipotential_bonding_satisfactory', value)}
          />
        </Grid>
      </Section>

      <Section
        title="Defects and remedial action"
        hint="Leave blank if there were none — the certificate will say so."
      >
        <Field label="Defects identified">
          <Textarea
            value={payload.fields.defect_description}
            onChange={(e) => setField('defect_description', e.target.value)}
          />
        </Field>
        <Field label="Remedial action taken">
          <Textarea
            value={payload.fields.remedial_action}
            onChange={(e) => setField('remedial_action', e.target.value)}
          />
        </Field>
        <Field label="Additional notes (optional)">
          <Textarea
            value={payload.fields.comments}
            onChange={(e) => setField('comments', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Your signature">
        <div className="touch-none rounded-[12px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
          <canvas ref={pad.canvasRef} className="h-[140px] w-full rounded-[8px] bg-white" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={captureSignature}>
            {payload.fields.engineer_signature ? 'Replace signature' : 'Use this signature'}
          </Button>
          <Button variant="ghost" onClick={clearSignature}>
            Clear
          </Button>
        </div>
        {payload.fields.engineer_signature ? (
          <p className="text-[13px] text-[var(--color-text-tertiary)]">Signature captured.</p>
        ) : null}
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
