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
    <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{label}</p>
        <span className="rounded-full bg-[var(--color-background-secondary)] px-3 py-1 text-[11px] font-medium uppercase text-[var(--color-text-secondary)]">
          Reading
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1.5fr,1fr]">
        <Input
          type="text"
          value={value ?? ''}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Enter value"
          className="rounded-[8px]"
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
