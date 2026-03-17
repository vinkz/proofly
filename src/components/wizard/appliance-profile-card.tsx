'use client';

import { Button } from '@/components/ui/button';

export type ApplianceProfile = {
  type?: string;
  make?: string;
  model?: string;
  location?: string;
  serial?: string;
  mountType?: string;
  gasType?: string;
  year?: string;
};

type ApplianceProfileCardProps = {
  appliance: ApplianceProfile;
  onEdit: () => void;
  onRemove?: () => void;
};

const formatValue = (value?: string) => (value && value.trim() ? value : '');

export function ApplianceProfileCard({ appliance, onEdit, onRemove }: ApplianceProfileCardProps) {
  const title = [formatValue(appliance.make), formatValue(appliance.model)].filter(Boolean).join(' ').trim();
  const subtitle = [formatValue(appliance.type), formatValue(appliance.location)].filter(Boolean).join(' • ').trim();
  const serial = formatValue(appliance.serial);
  return (
    <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          {title ? <p className="text-sm font-semibold text-muted">{title}</p> : null}
          {subtitle ? <p className="text-xs text-muted-foreground/70">{subtitle}</p> : null}
          {serial ? <p className="mt-1 text-xs text-muted-foreground/70">Serial: {serial}</p> : null}
          {!title && !subtitle && !serial ? (
            <p className="text-xs text-muted-foreground/60">Tap edit to add appliance details</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {onRemove ? (
            <Button type="button" variant="ghost" className="rounded-full px-2 py-1 text-xs" onClick={onRemove}>
              Remove
            </Button>
          ) : null}
          <Button type="button" variant="outline" className="rounded-full px-3 py-1 text-xs" onClick={onEdit}>
            Edit
          </Button>
        </div>
      </div>
    </div>
  );
}
