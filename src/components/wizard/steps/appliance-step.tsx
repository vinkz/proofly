'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ApplianceProfileCard, type ApplianceProfile } from '@/components/wizard/appliance-profile-card';
import { EnumChips, type EnumChipOption } from '@/components/wizard/inputs/enum-chips';
import { PrefillBadge } from '@/components/wizard/inputs/prefill-badge';
import { SearchableSelect, type SearchableSelectOption } from '@/components/wizard/inputs/searchable-select';
import { getEntry, getMakes, getModelsForMake, type BoilerType, type GasType, type MountType } from '@/lib/applianceCatalog/ukBoilers';

const DEFAULT_LOCATIONS: SearchableSelectOption[] = [
  { label: 'Kitchen', value: 'Kitchen' },
  { label: 'Kitchen cupboard', value: 'Kitchen cupboard' },
  { label: 'Utility room', value: 'Utility room' },
  { label: 'Bathroom', value: 'Bathroom' },
  { label: 'Garage', value: 'Garage' },
  { label: 'Loft', value: 'Loft' },
  { label: 'Other', value: 'Other' },
];

export type ApplianceStepValues = ApplianceProfile;

type ApplianceStepProps = {
  appliances?: ApplianceStepValues[];
  onAppliancesChange?: (next: ApplianceStepValues[]) => void;
  appliance?: ApplianceStepValues;
  onApplianceChange?: (next: ApplianceStepValues) => void;
  typeOptions: EnumChipOption[];
  makeOptions?: SearchableSelectOption[];
  locationOptions?: SearchableSelectOption[];
  allowMultiple?: boolean;
  onNext?: () => void;
  onBack?: () => void;
  nextLabel?: string;
  prefillText?: string | null;
  onPrefillClick?: () => void;
  requiredKeys?: Array<keyof ApplianceStepValues>;
  showExtendedFields?: boolean;
  inlineEditor?: boolean;
};

const emptyAppliance: ApplianceStepValues = {
  type: '',
  make: '',
  model: '',
  location: '',
  serial: '',
  mountType: '',
  gasType: '',
  year: '',
};

const getRequiredComplete = (appliance: ApplianceStepValues, requiredKeys: Array<keyof ApplianceStepValues>) =>
  requiredKeys.every((key) => String(appliance[key] ?? '').trim().length > 0);

const DEFAULT_MOUNT: MountType = 'wall';
const DEFAULT_GAS: GasType = 'natural_gas';
const YEAR_MIN = 1990;

const normalizeSerial = (value: string) =>
  value
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

const BOILER_TYPE_VALUES: BoilerType[] = ['combi', 'system', 'regular', 'other', 'unknown'];

export function ApplianceStep({
  appliances,
  onAppliancesChange,
  appliance,
  onApplianceChange,
  typeOptions,
  makeOptions,
  locationOptions = DEFAULT_LOCATIONS,
  allowMultiple = true,
  onNext,
  onBack,
  nextLabel = 'Looks good → Next',
  prefillText,
  onPrefillClick,
  requiredKeys = ['type', 'location'],
  showExtendedFields = false,
  inlineEditor = false,
}: ApplianceStepProps) {
  const catalogMakes = useMemo(() => getMakes(), []);
  const resolvedMakeOptions = useMemo(() => {
    if (makeOptions?.length) return makeOptions;
    return catalogMakes.map((make) => ({ label: make, value: make }));
  }, [catalogMakes, makeOptions]);
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years: string[] = [];
    for (let year = current; year >= YEAR_MIN; year -= 1) {
      years.push(String(year));
    }
    return ['Unknown', ...years];
  }, []);
  const isArrayMode = Array.isArray(appliances) && typeof onAppliancesChange === 'function';
  const normalizeExtendedFields = useCallback((items: ApplianceStepValues[]) => {
    if (!showExtendedFields) return items;
    return items.map((item) => ({
      ...item,
      mountType: item.mountType || DEFAULT_MOUNT,
      gasType: item.gasType || DEFAULT_GAS,
      year: item.year || 'unknown',
    }));
  }, [showExtendedFields]);

  const [localAppliances, setLocalAppliances] = useState<ApplianceStepValues[]>(
    normalizeExtendedFields(appliances && appliances.length ? appliances : [appliance ?? emptyAppliance]),
  );
  const [editingIndex, setEditingIndex] = useState(0);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  useEffect(() => {
    if (isArrayMode) return;
    if (appliance) {
      setLocalAppliances((prev) => {
        const next = [...prev];
        next[0] = { ...emptyAppliance, ...appliance };
        return normalizeExtendedFields(next);
      });
    }
  }, [appliance, isArrayMode, normalizeExtendedFields]);

  useEffect(() => {
    if (!isArrayMode || !appliances) return;
    setLocalAppliances(normalizeExtendedFields(appliances.length ? appliances : [emptyAppliance]));
  }, [appliances, isArrayMode, normalizeExtendedFields]);

  const activeAppliances = useMemo(
    () => (isArrayMode ? appliances ?? [] : localAppliances),
    [isArrayMode, appliances, localAppliances],
  );

  const updateAppliances = (next: ApplianceStepValues[]) => {
    const normalized = normalizeExtendedFields(next);
    if (isArrayMode) {
      onAppliancesChange?.(normalized);
      return;
    }
    setLocalAppliances(normalized);
    onApplianceChange?.(normalized[0] ?? emptyAppliance);
  };

  const editAppliance = (index: number) => {
    setEditingIndex(index);
    setIsEditorOpen(true);
  };

  const isKnownMake = (make: string) => catalogMakes.map((item) => item.toLowerCase()).includes(make.trim().toLowerCase());
  const isBoilerTypeOptions = typeOptions.every((option) =>
    BOILER_TYPE_VALUES.includes(option.value as BoilerType),
  );

  const applyEntryDefaults = (current: ApplianceStepValues, entry?: ReturnType<typeof getEntry>) => {
    if (!entry) return current;
    const next = { ...current };
    if (isBoilerTypeOptions && entry.types?.length) {
      const normalized = (next.type ?? '').trim().toLowerCase();
      const allowed = entry.types.map((type) => type.toLowerCase());
      if (!normalized || !allowed.includes(normalized)) {
        next.type = entry.defaultType ?? entry.types[0];
      }
    }
    if (showExtendedFields && entry.mountTypes?.length) {
      const normalized = (next.mountType ?? '').trim().toLowerCase();
      const allowed = entry.mountTypes.map((type) => type.toLowerCase());
      if (!normalized || !allowed.includes(normalized)) {
        next.mountType = entry.defaultMount ?? entry.mountTypes[0];
      }
    }
    if (showExtendedFields && entry.fuels?.length) {
      const normalized = (next.gasType ?? '').trim().toLowerCase();
      const allowed = entry.fuels.map((type) => type.toLowerCase());
      if (!normalized || !allowed.includes(normalized)) {
        next.gasType = entry.defaultFuel ?? entry.fuels[0];
      }
    }
    return next;
  };

  const updateApplianceField = (index: number, key: keyof ApplianceStepValues, value: string) => {
    const next = activeAppliances.map((item, idx) => {
      if (idx !== index) return item;
      const updated = { ...item, [key]: value };
      if (key === 'serial') {
        updated.serial = normalizeSerial(value);
      }
      if (key === 'make') {
        const models = getModelsForMake(value);
        if (updated.model && value !== 'Other' && models.length && !models.includes(updated.model)) {
          updated.model = '';
        }
      }
      if (key === 'model' || key === 'make') {
        const entry = getEntry(updated.make ?? '', updated.model ?? '');
        return applyEntryDefaults(updated, entry);
      }
      return updated;
    });
    updateAppliances(next);
  };

  const addAppliance = () => {
    const next = [...activeAppliances, { ...emptyAppliance }];
    updateAppliances(next);
    setEditingIndex(next.length - 1);
    setIsEditorOpen(true);
  };

  const removeAppliance = (index: number) => {
    if (activeAppliances.length <= 1) return;
    const next = activeAppliances.filter((_, idx) => idx !== index);
    updateAppliances(next);
  };

  const canContinue = activeAppliances.length > 0 && getRequiredComplete(activeAppliances[0], requiredKeys);
  const modelOptions = useMemo(() => {
    const make = activeAppliances[editingIndex]?.make ?? '';
    const models = getModelsForMake(make);
    return [...models, 'Other'].map((model) => ({ label: model, value: model }));
  }, [activeAppliances, editingIndex]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {prefillText ? <PrefillBadge text={prefillText} onClick={onPrefillClick} /> : <span />}
        {allowMultiple ? (
          <Button type="button" variant="outline" className="rounded-full" onClick={addAppliance}>
            + Add appliance
          </Button>
        ) : null}
      </div>

      <div className="space-y-3">
        {inlineEditor ? (
          <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <EnumChips
                label="Appliance type"
                value={activeAppliances[0]?.type ?? ''}
                options={typeOptions}
                onChange={(val) => updateApplianceField(0, 'type', val)}
              />
              <SearchableSelect
                label="Make"
                value={activeAppliances[0]?.make ?? ''}
                options={resolvedMakeOptions}
                placeholder="Select or type"
                onChange={(val) => updateApplianceField(0, 'make', val)}
              />
              {isKnownMake(activeAppliances[0]?.make ?? '') && activeAppliances[0]?.make !== 'Other' ? (
                <SearchableSelect
                  label="Model"
                  value={activeAppliances[0]?.model ?? ''}
                  options={modelOptions}
                  placeholder="Select or type"
                  onChange={(val) => updateApplianceField(0, 'model', val)}
                />
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Model</p>
                  <Input
                    value={activeAppliances[0]?.model ?? ''}
                    onChange={(e) => updateApplianceField(0, 'model', e.target.value)}
                    placeholder="Type model"
                  />
                </div>
              )}
              <SearchableSelect
                label="Location"
                value={activeAppliances[0]?.location ?? ''}
                options={locationOptions}
                placeholder="Select or type"
                onChange={(val) => updateApplianceField(0, 'location', val)}
              />
              {showExtendedFields ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Mount type</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Wall-mounted', value: 'wall' },
                      { label: 'Floor-standing', value: 'floor' },
                      { label: 'Unknown', value: 'unknown' },
                    ].map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={(activeAppliances[0]?.mountType ?? '') === option.value ? 'primary' : 'outline'}
                        className="rounded-full px-3 py-1 text-xs"
                        onClick={() => updateApplianceField(0, 'mountType', option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
              {showExtendedFields ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Gas type</p>
                  <Select
                    value={activeAppliances[0]?.gasType ?? ''}
                    onChange={(e) => updateApplianceField(0, 'gasType', e.target.value)}
                  >
                    <option value="natural_gas">Natural Gas (G20)</option>
                    <option value="lpg">LPG (G31)</option>
                    <option value="unknown">Unknown</option>
                  </Select>
                </div>
              ) : null}
              {showExtendedFields ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Year of manufacture</p>
                  <Select
                    value={activeAppliances[0]?.year ?? ''}
                    onChange={(e) => updateApplianceField(0, 'year', e.target.value)}
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year === 'Unknown' ? 'unknown' : year}>
                        {year}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
              <div className="space-y-2 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Serial number</p>
                <Input
                  value={activeAppliances[0]?.serial ?? ''}
                  onChange={(e) => updateApplianceField(0, 'serial', e.target.value)}
                  placeholder="Serial number"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground/70">
                  <span>Usually on data plate/label.</span>
                  <Button type="button" variant="ghost" className="h-7 rounded-full px-3 text-[11px]" disabled>
                    Scan label (soon)
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          activeAppliances.map((item, index) => (
            <ApplianceProfileCard
              key={`appliance-${index}`}
              appliance={item}
              onEdit={() => editAppliance(index)}
              onRemove={allowMultiple && activeAppliances.length > 1 ? () => removeAppliance(index) : undefined}
            />
          ))
        )}
      </div>

      {!inlineEditor ? (
        <Sheet open={isEditorOpen} onOpenChange={setIsEditorOpen}>
          <SheetContent side="bottom" title="Appliance profile" description="Add core appliance details.">
            <div className="grid gap-4 sm:grid-cols-2">
              <EnumChips
                label="Appliance type"
                value={activeAppliances[editingIndex]?.type ?? ''}
                options={typeOptions}
                onChange={(val) => updateApplianceField(editingIndex, 'type', val)}
              />
              <SearchableSelect
                label="Make"
                value={activeAppliances[editingIndex]?.make ?? ''}
                options={resolvedMakeOptions}
                placeholder="Select or type"
                onChange={(val) => updateApplianceField(editingIndex, 'make', val)}
              />
              {isKnownMake(activeAppliances[editingIndex]?.make ?? '') && activeAppliances[editingIndex]?.make !== 'Other' ? (
                <SearchableSelect
                  label="Model"
                  value={activeAppliances[editingIndex]?.model ?? ''}
                  options={modelOptions}
                  placeholder="Select or type"
                  onChange={(val) => updateApplianceField(editingIndex, 'model', val)}
                />
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Model</p>
                  <Input
                    value={activeAppliances[editingIndex]?.model ?? ''}
                    onChange={(e) => updateApplianceField(editingIndex, 'model', e.target.value)}
                    placeholder="Type model"
                  />
                </div>
              )}
              <SearchableSelect
                label="Location"
                value={activeAppliances[editingIndex]?.location ?? ''}
                options={locationOptions}
                placeholder="Select or type"
                onChange={(val) => updateApplianceField(editingIndex, 'location', val)}
              />
              {showExtendedFields ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Mount type</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Wall-mounted', value: 'wall' },
                      { label: 'Floor-standing', value: 'floor' },
                      { label: 'Unknown', value: 'unknown' },
                    ].map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={(activeAppliances[editingIndex]?.mountType ?? '') === option.value ? 'primary' : 'outline'}
                        className="rounded-full px-3 py-1 text-xs"
                        onClick={() => updateApplianceField(editingIndex, 'mountType', option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
              {showExtendedFields ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Gas type</p>
                  <Select
                    value={activeAppliances[editingIndex]?.gasType ?? ''}
                    onChange={(e) => updateApplianceField(editingIndex, 'gasType', e.target.value)}
                  >
                    <option value="natural_gas">Natural Gas (G20)</option>
                    <option value="lpg">LPG (G31)</option>
                    <option value="unknown">Unknown</option>
                  </Select>
                </div>
              ) : null}
              {showExtendedFields ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Year of manufacture</p>
                  <Select
                    value={activeAppliances[editingIndex]?.year ?? ''}
                    onChange={(e) => updateApplianceField(editingIndex, 'year', e.target.value)}
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year === 'Unknown' ? 'unknown' : year}>
                        {year}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
              <div className="space-y-2 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Serial number</p>
                <Input
                  value={activeAppliances[editingIndex]?.serial ?? ''}
                  onChange={(e) => updateApplianceField(editingIndex, 'serial', e.target.value)}
                  placeholder="Serial number"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground/70">
                  <span>Usually on data plate/label.</span>
                  <Button type="button" variant="ghost" className="h-7 rounded-full px-3 text-[11px]" disabled>
                    Scan label (soon)
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button type="button" className="rounded-full" onClick={() => setIsEditorOpen(false)}>
                Done
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      {(onBack || onNext) ? (
        <div className="mt-6 flex justify-between">
          {onBack ? (
            <Button variant="outline" className="rounded-full" onClick={onBack}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {onNext ? (
            <Button className="rounded-full" onClick={onNext} disabled={!canContinue}>
              {nextLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
