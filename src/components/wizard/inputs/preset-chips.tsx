'use client';

/**
 * Tap-to-append phrase chips for a free-text field.
 *
 * Deliberately append rather than replace: an engineer usually wants "Gas
 * supply isolated / capped" plus a sentence of their own, and a chip that
 * overwrote what they had already typed would be worse than no chip at all.
 * The wording comes from the shared GIUSP preset lists so the free tools and
 * the paid wizard say the same things.
 */
import { appendPresetSnippet } from '@/lib/gas-safety/unsafe-presets';

type Props = {
  label?: string;
  presets: readonly string[];
  value: string;
  onChange: (next: string) => void;
};

export function PresetChips({ label, presets, value, onChange }: Props) {
  return (
    <div>
      {label ? (
        <p className="mb-1.5 text-[12px] text-[var(--color-text-tertiary)]">{label}</p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(appendPresetSnippet(value, preset))}
            className="rounded-full border-[0.5px] border-[var(--color-border-primary)] bg-[var(--color-background-tertiary)] px-2.5 py-1 text-[12px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-background-secondary)] hover:text-[var(--color-text-primary)]"
          >
            + {preset}
          </button>
        ))}
      </div>
    </div>
  );
}
