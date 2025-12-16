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
    <div className="rounded-3xl border border-white/30 bg-white/90 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-muted">{label}</p>
        <div className="flex gap-2">
          {(['pass', 'fail', 'na'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setValue(status)}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-semibold transition',
                value === status
                  ? 'bg-[var(--accent)] text-white shadow'
                  : 'bg-[var(--muted)] text-gray-700 hover:bg-white',
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
