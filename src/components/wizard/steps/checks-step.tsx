'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EnumChips, type EnumChipOption } from '@/components/wizard/inputs/enum-chips';
import { PassFailToggle, type PassFailValue } from '@/components/wizard/inputs/pass-fail-toggle';
import { UnitNumberInput } from '@/components/wizard/inputs/unit-number-input';

export type ChecksStepValues = {
  ventilation_satisfactory?: string;
  flue_condition?: string;
  stability_test?: string;
  gas_tightness_test?: string;
  operating_pressure?: string;
  gas_rate?: string;
  co_reading_ppm?: string;
  co_reading_high?: string;
  co_reading_low?: string;
  co2_reading?: string;
  heat_input?: string;
  safety_rating?: string;
  classification_code?: string;
  warning_notice_issued?: string;
  remedial_action?: string;
  defect_description?: string;
  safety_devices_correct?: string;
  flue_performance_test?: string;
  appliance_serviced?: string;
};

export type ChecksStepNotes = {
  ventilation?: string;
  flue?: string;
  stability?: string;
  gasTightness?: string;
};

type ChecksStepProps = {
  values: ChecksStepValues;
  onChange: (next: Partial<ChecksStepValues>) => void;
  notes?: ChecksStepNotes;
  onNotesChange?: (next: Partial<ChecksStepNotes>) => void;
  safetyOptions?: EnumChipOption[];
  gasRateUnit?: string;
  gasRateLabel?: string;
  operatingPressureLabel?: string;
  operatingPressureUnit?: string;
  heatInputLabel?: string;
  heatInputUnit?: string;
  coReadingLabel?: string;
  co2ReadingLabel?: string;
  combustionHighLabel?: string;
  combustionLowLabel?: string;
  measurementSource?: 'manual' | 'tpi';
  measurementReadOnly?: boolean;
};

const hasKey = (values: ChecksStepValues, key: keyof ChecksStepValues) =>
  Object.prototype.hasOwnProperty.call(values, key);

const normalizePassFail = (value?: string): PassFailValue => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === 'pass') return 'pass';
  if (normalized === 'fail') return 'fail';
  return null;
};

export function ChecksStep({
  values,
  onChange,
  notes,
  onNotesChange,
  safetyOptions = [
    { label: 'Safe', value: 'safe' },
    { label: 'At risk', value: 'at_risk' },
    { label: 'Immediately dangerous', value: 'immediately_dangerous' },
  ],
  gasRateUnit = 'm³/h',
  gasRateLabel = 'Gas rate',
  operatingPressureLabel = 'Working pressure',
  operatingPressureUnit = 'mbar',
  heatInputLabel = 'Heat input',
  heatInputUnit = 'kW',
  coReadingLabel = 'CO reading',
  co2ReadingLabel = 'CO2 reading',
  combustionHighLabel = 'Combustion (high)',
  combustionLowLabel = 'Combustion (low)',
  measurementSource = 'manual',
  measurementReadOnly = false,
}: ChecksStepProps) {
  const ventilationValue = normalizePassFail(values.ventilation_satisfactory);
  const flueValue = normalizePassFail(values.flue_condition);
  const stabilityValue = normalizePassFail(values.stability_test);
  const tightnessValue = normalizePassFail(values.gas_tightness_test);
  const safetyValue = values.safety_rating ?? '';
  const isSafe = safetyValue.toLowerCase() === 'safe';
  const measurementNote = measurementSource === 'tpi' ? 'Captured from meter' : undefined;
  const showSafetyChecks =
    hasKey(values, 'safety_rating') ||
    hasKey(values, 'safety_devices_correct') ||
    hasKey(values, 'flue_performance_test') ||
    hasKey(values, 'appliance_serviced');

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Measurements</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {hasKey(values, 'co_reading_high') ? (
          <UnitNumberInput
            label={combustionHighLabel}
            unit="ppm"
            value={values.co_reading_high ?? ''}
            onChange={(val) => onChange({ co_reading_high: val })}
            placeholder={combustionHighLabel}
            disabled={measurementReadOnly}
            note={measurementNote}
          />
        ) : null}

        {hasKey(values, 'co_reading_low') ? (
          <UnitNumberInput
            label={combustionLowLabel}
            unit="ppm"
            value={values.co_reading_low ?? ''}
            onChange={(val) => onChange({ co_reading_low: val })}
            placeholder={combustionLowLabel}
            disabled={measurementReadOnly}
            note={measurementNote}
          />
        ) : null}

        {hasKey(values, 'ventilation_satisfactory') ? (
          <div className="space-y-2">
            <PassFailToggle
              label="Ventilation satisfactory"
              value={ventilationValue}
              onChange={(val) => onChange({ ventilation_satisfactory: val ?? '' })}
            />
            {ventilationValue === 'fail' && notes && onNotesChange ? (
              <Textarea
                value={notes.ventilation ?? ''}
                onChange={(e) => onNotesChange({ ventilation: e.target.value })}
                placeholder="Ventilation notes"
                className="min-h-[80px]"
              />
            ) : null}
          </div>
        ) : null}

        {hasKey(values, 'flue_condition') ? (
          <div className="space-y-2">
            <PassFailToggle
              label="Flue condition"
              value={flueValue}
              onChange={(val) => onChange({ flue_condition: val ?? '' })}
            />
            {flueValue === 'fail' && notes && onNotesChange ? (
              <Textarea
                value={notes.flue ?? ''}
                onChange={(e) => onNotesChange({ flue: e.target.value })}
                placeholder="Flue notes"
                className="min-h-[80px]"
              />
            ) : null}
          </div>
        ) : null}

        {hasKey(values, 'stability_test') ? (
          <div className="space-y-2">
            <PassFailToggle
              label="Stability test"
              value={stabilityValue}
              onChange={(val) => onChange({ stability_test: val ?? '' })}
            />
            {stabilityValue === 'fail' && notes && onNotesChange ? (
              <Textarea
                value={notes.stability ?? ''}
                onChange={(e) => onNotesChange({ stability: e.target.value })}
                placeholder="Stability notes"
                className="min-h-[80px]"
              />
            ) : null}
          </div>
        ) : null}

        {hasKey(values, 'gas_tightness_test') ? (
          <div className="space-y-2">
            <PassFailToggle
              label="Gas tightness test"
              value={tightnessValue}
              onChange={(val) => onChange({ gas_tightness_test: val ?? '' })}
            />
            {tightnessValue === 'fail' && notes && onNotesChange ? (
              <Textarea
                value={notes.gasTightness ?? ''}
                onChange={(e) => onNotesChange({ gasTightness: e.target.value })}
                placeholder="Gas tightness notes"
                className="min-h-[80px]"
              />
            ) : null}
          </div>
        ) : null}

        {hasKey(values, 'operating_pressure') ? (
          <UnitNumberInput
            label={operatingPressureLabel}
            unit={operatingPressureUnit}
            value={values.operating_pressure ?? ''}
            onChange={(val) => onChange({ operating_pressure: val })}
            placeholder={operatingPressureLabel}
            disabled={measurementReadOnly}
            note={measurementNote}
          />
        ) : null}

        {hasKey(values, 'gas_rate') ? (
          <UnitNumberInput
            label={gasRateLabel}
            unit={gasRateUnit}
            value={values.gas_rate ?? ''}
            onChange={(val) => onChange({ gas_rate: val })}
            placeholder={gasRateLabel}
            disabled={measurementReadOnly}
            note={measurementNote}
          />
        ) : null}

        {hasKey(values, 'co_reading_ppm') ? (
          <UnitNumberInput
            label={coReadingLabel}
            unit="ppm"
            value={values.co_reading_ppm ?? ''}
            onChange={(val) => onChange({ co_reading_ppm: val })}
            placeholder={coReadingLabel}
            disabled={measurementReadOnly}
            note={measurementNote}
          />
        ) : null}

        {hasKey(values, 'co2_reading') ? (
          <UnitNumberInput
            label={co2ReadingLabel}
            unit="%"
            value={values.co2_reading ?? ''}
            onChange={(val) => onChange({ co2_reading: val })}
            placeholder={co2ReadingLabel}
            disabled={measurementReadOnly}
            note={measurementNote}
          />
        ) : null}

        {hasKey(values, 'heat_input') ? (
          <UnitNumberInput
            label={heatInputLabel}
            unit={heatInputUnit}
            value={values.heat_input ?? ''}
            onChange={(val) => onChange({ heat_input: val })}
            placeholder={heatInputLabel}
            disabled={measurementReadOnly}
            note={measurementNote}
          />
        ) : null}
      </div>

      {showSafetyChecks ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Safety checks</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {hasKey(values, 'safety_devices_correct') ? (
              <PassFailToggle
                label="Safety devices correct"
                value={normalizePassFail(values.safety_devices_correct)}
                onChange={(val) => onChange({ safety_devices_correct: val ?? '' })}
              />
            ) : null}
            {hasKey(values, 'flue_performance_test') ? (
              <PassFailToggle
                label="Flue performance test"
                value={normalizePassFail(values.flue_performance_test)}
                onChange={(val) => onChange({ flue_performance_test: val ?? '' })}
              />
            ) : null}
            {hasKey(values, 'appliance_serviced') ? (
              <PassFailToggle
                label="Appliance serviced"
                value={normalizePassFail(values.appliance_serviced)}
                onChange={(val) => onChange({ appliance_serviced: val ?? '' })}
              />
            ) : null}
          </div>
          {hasKey(values, 'safety_rating') ? (
            <EnumChips label="Safety rating" value={safetyValue} options={safetyOptions} onChange={(val) => onChange({ safety_rating: val })} />
          ) : null}
          {hasKey(values, 'safety_rating') && !isSafe ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {hasKey(values, 'classification_code') ? (
                <Input
                  value={values.classification_code ?? ''}
                  onChange={(e) => onChange({ classification_code: e.target.value })}
                  placeholder="Classification code"
                />
              ) : null}
              {hasKey(values, 'warning_notice_issued') ? (
                <EnumChips
                  label="Warning notice issued"
                  value={values.warning_notice_issued ?? ''}
                  options={[
                    { label: 'Yes', value: 'YES' },
                    { label: 'No', value: 'NO' },
                  ]}
                  onChange={(val) => onChange({ warning_notice_issued: val })}
                />
              ) : null}
              {hasKey(values, 'remedial_action') ? (
                <Textarea
                  value={values.remedial_action ?? ''}
                  onChange={(e) => onChange({ remedial_action: e.target.value })}
                  placeholder="Remedial action"
                  className="min-h-[80px] sm:col-span-2"
                />
              ) : null}
              {hasKey(values, 'defect_description') ? (
                <Textarea
                  value={values.defect_description ?? ''}
                  onChange={(e) => onChange({ defect_description: e.target.value })}
                  placeholder="Defect description"
                  className="min-h-[80px] sm:col-span-2"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
