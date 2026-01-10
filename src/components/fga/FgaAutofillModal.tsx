'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { parseFgaText } from '@/lib/fga/parseFgaText';
import { saveFgaReadings } from '@/server/fga';
import { uploadJobFile } from '@/server/job-files';

type FgaValues = {
  co_ppm?: number;
  co2_pct?: number;
  o2_pct?: number;
  ratio?: number;
  flue_temp_c?: number;
  ambient_temp_c?: number;
  efficiency_pct?: number;
};

type FgaValueKey = keyof FgaValues;

const FGA_FIELDS: Array<{ key: FgaValueKey; label: string; unit?: string }> = [
  { key: 'co_ppm', label: 'CO', unit: 'ppm' },
  { key: 'co2_pct', label: 'CO2', unit: '%' },
  { key: 'o2_pct', label: 'O2', unit: '%' },
  { key: 'ratio', label: 'CO/CO2 ratio' },
  { key: 'flue_temp_c', label: 'Flue temp', unit: 'C' },
  { key: 'ambient_temp_c', label: 'Ambient temp', unit: 'C' },
  { key: 'efficiency_pct', label: 'Efficiency', unit: '%' },
];

const KIND_OPTIONS = [
  { value: 'fga_report', label: 'FGA report' },
  { value: 'fga_screenshot', label: 'FGA screenshot' },
];

type TabKey = 'paste' | 'upload';

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  jobId: string;
  applianceId: string;
  readingSet: 'high' | 'low';
  onApplied: (values: FgaValues) => void;
};

function toInputState(values: FgaValues) {
  return FGA_FIELDS.reduce((acc, field) => {
    const value = values[field.key];
    acc[field.key] = value === undefined ? '' : String(value);
    return acc;
  }, {} as Record<FgaValueKey, string>);
}

function toNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function FgaAutofillModal({
  open,
  onOpenChange,
  jobId,
  applianceId,
  readingSet,
  onApplied,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('paste');
  const [rawText, setRawText] = useState('');
  const [valueState, setValueState] = useState<Record<FgaValueKey, string>>(toInputState({}));
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadKind, setUploadKind] = useState<'fga_report' | 'fga_screenshot'>('fga_report');

  const parsedValues = useMemo(() => {
    const entries = FGA_FIELDS.reduce((acc, field) => {
      const value = toNumber(valueState[field.key] ?? '');
      if (value !== undefined) acc[field.key] = value;
      return acc;
    }, {} as FgaValues);
    return entries;
  }, [valueState]);

  const handleParse = () => {
    setErrorMessage('');
    setStatusMessage('');
    const parsed = parseFgaText(rawText);
    setValueState(toInputState(parsed));
  };

  const handleApply = async () => {
    setErrorMessage('');
    setStatusMessage('');
    setSaving(true);
    try {
      const payload: FgaValues = parsedValues;
      await saveFgaReadings({
        jobId,
        applianceId,
        readingSet,
        source: 'pasted_text',
        rawText,
        data: payload,
      });
      onApplied(payload);
      setStatusMessage('Saved readings and applied to fields.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save readings.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async () => {
    setErrorMessage('');
    setStatusMessage('');
    if (!uploadFile) {
      setErrorMessage('Please choose a file to upload.');
      return;
    }
    setUploading(true);
    try {
      await uploadJobFile({ jobId, applianceId, kind: uploadKind, file: uploadFile });
      setStatusMessage('Saved as evidence. Paste readings to auto-fill.');
      setUploadFile(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to upload evidence.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open={open} onClose={() => onOpenChange(false)} title="FGA auto-fill">
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/60 p-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('paste')}
          className={`rounded-full px-3 py-1.5 font-semibold ${
            activeTab === 'paste'
              ? 'bg-[var(--accent)] text-white'
              : 'text-muted-foreground hover:text-muted'
          }`}
        >
          Paste readings
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`rounded-full px-3 py-1.5 font-semibold ${
            activeTab === 'upload'
              ? 'bg-[var(--accent)] text-white'
              : 'text-muted-foreground hover:text-muted'
          }`}
        >
          Upload report
        </button>
      </div>

      {activeTab === 'paste' ? (
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
              Paste readings
            </label>
            <Textarea
              rows={4}
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder="Paste analyzer output here..."
            />
          </div>

          <Button type="button" variant="secondary" className="rounded-full" onClick={handleParse}>
            Parse
          </Button>

          <div className="rounded-xl border border-white/10 bg-white/40 p-3">
            <table className="w-full text-sm">
              <tbody>
                {FGA_FIELDS.map((field) => (
                  <tr key={field.key} className="border-b border-white/10 last:border-b-0">
                    <td className="py-2 pr-3 text-xs font-semibold uppercase text-muted-foreground/70">
                      {field.label}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={valueState[field.key] ?? ''}
                          onChange={(event) =>
                            setValueState((prev) => ({ ...prev, [field.key]: event.target.value }))
                          }
                          placeholder="--"
                        />
                        {field.unit ? <span className="text-xs text-muted-foreground/70">{field.unit}</span> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            type="button"
            variant="primary"
            className="rounded-full"
            onClick={handleApply}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Apply to fields'}
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Kind</label>
            <Select value={uploadKind} onChange={(event) => setUploadKind(event.target.value as typeof uploadKind)}>
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">File</label>
            <Input type="file" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
          </div>

          <Button
            type="button"
            variant="primary"
            className="rounded-full"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : 'Upload evidence'}
          </Button>
        </div>
      )}

      {statusMessage ? <p className="mt-4 text-sm text-emerald-600">{statusMessage}</p> : null}
      {errorMessage ? <p className="mt-4 text-sm text-red-500">{errorMessage}</p> : null}
    </Modal>
  );
}
