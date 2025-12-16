import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type ReadingCardProps = {
  label: string;
  value?: string;
  note?: string;
  onChange?: (payload: { value?: string; note?: string }) => void;
  onVoiceRequest?: () => void;
};

export function ReadingCard({ label, value, note, onChange, onVoiceRequest }: ReadingCardProps) {
  const setValue = (next: string) => onChange?.({ value: next, note });
  const setNote = (next: string) => onChange?.({ value, note: next });

  return (
    <div className="rounded-3xl border border-white/30 bg-white/90 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-muted">{label}</p>
        <span className="rounded-full bg-[var(--muted)] px-3 py-1 text-[11px] font-semibold uppercase text-[var(--brand)]">
          Reading
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1.5fr,1fr]">
        <Input
          type="text"
          value={value ?? ''}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Enter value"
          className="rounded-2xl"
        />
        <Button type="button" variant="outline" className="rounded-full">
          OCR placeholder
        </Button>
      </div>
      <div className="mt-3">
        <Textarea
          value={note ?? ''}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Notes"
          className="min-h-[80px]"
        />
        <div className="mt-2 flex gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onVoiceRequest}>
            Voice note (Whisper)
          </Button>
        </div>
      </div>
    </div>
  );
}
