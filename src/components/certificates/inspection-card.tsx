import { clsx } from 'clsx';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type InspectionCardProps = {
  label: string;
  value?: 'pass' | 'fail' | 'na';
  note?: string;
  onChange?: (next: { result?: 'pass' | 'fail' | 'na'; note?: string }) => void;
  onVoiceRequest?: () => void;
};

export function InspectionCard({ label, value, note, onChange, onVoiceRequest }: InspectionCardProps) {
  const setValue = (next: 'pass' | 'fail' | 'na') => onChange?.({ result: next, note });
  const setNote = (text: string) => onChange?.({ result: value, note: text });

  return (
    <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{label}</p>
        <div className="flex gap-2">
          {(['pass', 'fail', 'na'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setValue(status)}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-semibold transition',
                value === status
                  ? 'bg-[var(--color-action)] text-white'
                  : 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-background-tertiary)]',
              )}
            >
              {status.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Textarea
          placeholder="Notes or observations"
          value={note ?? ''}
          onChange={(event) => setNote(event.target.value)}
          className="min-h-[90px]"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => setNote('AI suggestion coming soon')}>
            AI Suggest (stub)
          </Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={onVoiceRequest}>
            Voice note (Whisper)
          </Button>
        </div>
      </div>
    </div>
  );
}
