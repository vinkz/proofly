'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import {
  CP12_VOICE_READING_FIELDS,
  type Cp12VoiceReadingScope,
  type Cp12VoiceReadingsParsed,
} from '@/lib/cp12/voice-readings';

type Props = {
  jobId: string;
  scope?: Cp12VoiceReadingScope;
  disabled?: boolean;
  buttonLabel?: string;
  buttonClassName?: string;
  onApply: (values: Partial<Cp12VoiceReadingsParsed>) => void;
  onActiveChange?: (active: boolean) => void;
};

type RecorderState = 'idle' | 'starting' | 'recording' | 'transcribing' | 'review' | 'error';

const EMPTY_EDITABLE: Record<keyof Cp12VoiceReadingsParsed, string> = {
  workingPressure: '',
  heatInput: '',
  coPpm: '',
  highCoPpm: '',
  highCo2Percent: '',
  highRatio: '',
  lowCoPpm: '',
  lowCo2Percent: '',
  lowRatio: '',
};

function getSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const preferredTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  return preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function toEditableState(values: Cp12VoiceReadingsParsed) {
  return Object.entries(values).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = value ?? '';
    return acc;
  }, { ...EMPTY_EDITABLE }) as Record<keyof Cp12VoiceReadingsParsed, string>;
}

function buildApplyPayload(values: Record<keyof Cp12VoiceReadingsParsed, string>) {
  return Object.entries(values).reduce<Partial<Cp12VoiceReadingsParsed>>((acc, [key, value]) => {
    const normalized = value.trim();
    if (normalized) {
      acc[key as keyof Cp12VoiceReadingsParsed] = normalized;
    }
    return acc;
  }, {});
}

export function Cp12VoiceReadings({
  jobId,
  scope = 'all',
  disabled = false,
  buttonLabel,
  buttonClassName = 'rounded-full text-xs',
  onApply,
  onActiveChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<RecorderState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [transcript, setTranscript] = useState('');
  const [editableValues, setEditableValues] = useState<Record<keyof Cp12VoiceReadingsParsed, string>>({ ...EMPTY_EDITABLE });

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const stopModeRef = useRef<'transcribe' | 'cancel'>('cancel');
  const abortControllerRef = useRef<AbortController | null>(null);

  const applyPayload = useMemo(() => buildApplyPayload(editableValues), [editableValues]);
  const canApply = Object.keys(applyPayload).length > 0;
  const isInlineScoped = scope !== 'all';

  const onActiveChangeRef = useRef(onActiveChange);
  onActiveChangeRef.current = onActiveChange;
  useEffect(() => {
    onActiveChangeRef.current?.(state === 'recording');
  }, [state]);
  const resolvedButtonLabel = buttonLabel ?? 'Speak';

  const resetState = () => {
    setState('idle');
    setErrorMessage('');
    setWarnings([]);
    setTranscript('');
    setEditableValues({ ...EMPTY_EDITABLE });
  };

  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
  };

  const closeModal = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      stopModeRef.current = 'cancel';
      recorderRef.current.stop();
    } else {
      stopTracks();
    }
    setOpen(false);
    resetState();
  };

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        stopModeRef.current = 'cancel';
        recorderRef.current.stop();
      }
      stopTracks();
    };
  }, []);

  const handleTranscription = async (blob: Blob) => {
    setState('transcribing');
    setErrorMessage('');
    setWarnings([]);
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const formData = new FormData();
      const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      formData.append('jobId', jobId);
      formData.append('scope', scope);
      formData.append('audio', new File([blob], `cp12-readings.${extension}`, { type: blob.type || 'audio/webm' }));

      const response = await fetch('/api/cp12/voice-readings', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            transcript?: string;
            parsed?: Cp12VoiceReadingsParsed;
            warnings?: string[];
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || 'Voice transcription failed');
      }

      const nextTranscript = payload?.transcript ?? '';
      const nextWarnings = Array.isArray(payload?.warnings) ? payload.warnings : [];
      const nextValues = toEditableState(payload?.parsed ?? { ...EMPTY_EDITABLE });
      const nextApplyPayload = buildApplyPayload(nextValues);

      setTranscript(nextTranscript);
      setWarnings(nextWarnings);

      if (isInlineScoped) {
        if (!Object.keys(nextApplyPayload).length) {
          setState('error');
          setErrorMessage(nextWarnings[0] ?? 'No confident readings were parsed. Try again or enter the values manually.');
          return;
        }
        onApply(nextApplyPayload);
        setState('idle');
        return;
      }

      setEditableValues(nextValues);
      setState('review');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Voice transcription failed');
    } finally {
      abortControllerRef.current = null;
    }
  };

  const startRecording = async () => {
    setOpen(!isInlineScoped);
    resetState();
    setState('starting');

    try {
      if (typeof window === 'undefined') {
        throw new Error('Voice capture is only available in the browser.');
      }

      const host = window.location.hostname;
      const secureContext = window.isSecureContext || host === 'localhost' || host === '127.0.0.1';
      if (!secureContext) {
        throw new Error('Microphone access requires HTTPS or localhost.');
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not support microphone recording.');
      }

      if (typeof MediaRecorder === 'undefined') {
        throw new Error('This browser does not support MediaRecorder.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      stopModeRef.current = 'transcribe';

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener('stop', () => {
        const mode = stopModeRef.current;
        const mime = recorder.mimeType || mimeType || 'audio/webm';
        const chunks = [...chunksRef.current];
        chunksRef.current = [];
        stopTracks();

        if (mode === 'cancel') return;
        if (!chunks.length) {
          setState('error');
          setErrorMessage('No audio was captured. Try again.');
          return;
        }
        void handleTranscription(new Blob(chunks, { type: mime }));
      });

      recorder.start();
      setState('recording');
    } catch (error) {
      stopTracks();
      setState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Could not start microphone recording');
    }
  };

  const stopRecording = () => {
    if (!recorderRef.current || recorderRef.current.state === 'inactive') return;
    stopModeRef.current = 'transcribe';
    recorderRef.current.stop();
    setState('transcribing');
  };

  const handleApply = () => {
    if (!canApply) return;
    onApply(applyPayload);
    closeModal();
  };

  const handleButtonClick = () => {
    if (state === 'recording') {
      stopRecording();
      return;
    }
    void startRecording();
  };

  if (isInlineScoped) {
    const busy = state === 'starting' || state === 'transcribing';
    const active = state === 'recording';
    const idleHint = 'Speak in order with small pauses in between.';
    return (
      <span className="inline-flex flex-col items-start gap-1">
        <Button
          type="button"
          variant="outline"
          className={`${buttonClassName}${active ? ' border-[var(--color-red)] text-[var(--color-red)]' : ''}`}
          onClick={handleButtonClick}
          disabled={disabled || busy}
        >
          {state === 'starting'
            ? 'Starting...'
            : state === 'transcribing'
              ? 'Reading...'
              : active
                ? 'Stop'
                : resolvedButtonLabel}
        </Button>
        {state === 'idle' && !warnings.length ? (
          <span className="text-[11px] text-[var(--color-text-tertiary)]">{idleHint}</span>
        ) : null}
        {active ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-red)]">
            <span className="size-1.5 animate-pulse rounded-full bg-[var(--color-red)]" />
            {scope === 'combustion' ? 'Listening for high and low FGA readings…' : 'Listening…'}
          </span>
        ) : null}
        {state === 'error' && errorMessage ? (
          <span className="max-w-56 text-[11px] font-medium text-[var(--color-red)]">{errorMessage}</span>
        ) : null}
        {warnings.length && state === 'idle' ? (
          <span className="max-w-56 text-[11px] text-[var(--color-amber)]">{warnings[0]}</span>
        ) : null}
      </span>
    );
  }

  return (
    <>
      <Button type="button" variant="outline" className={buttonClassName} onClick={handleButtonClick} disabled={disabled}>
        {resolvedButtonLabel}
      </Button>

      <Modal open={open} onClose={closeModal} title="Speak readings">
        <div className="space-y-4">
          {state === 'starting' ? (
            <div className="rounded-[16px] border border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] p-4 text-sm text-[var(--color-text-secondary)]">
              Starting microphone…
            </div>
          ) : null}

          {state === 'recording' ? (
            <div className="rounded-[16px] border border-[var(--color-action)]/30 bg-[var(--color-action-bg)] p-4">
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">Listening…</p>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                Speak in order with small pauses in between.
              </p>
              <div className="mt-4 flex gap-2">
                <Button type="button" className="rounded-full" onClick={stopRecording}>
                  Stop
                </Button>
                <Button type="button" variant="outline" className="rounded-full" onClick={closeModal}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {state === 'transcribing' ? (
            <div className="rounded-[16px] border border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] p-4 text-sm text-[var(--color-text-secondary)]">
              Transcribing and parsing readings…
            </div>
          ) : null}

          {state === 'review' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-eyebrow)]">Transcript</p>
                <div className="rounded-[16px] border border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] p-3 text-sm text-[var(--color-text-secondary)]">
                  {transcript || 'No transcript returned.'}
                </div>
              </div>

              {warnings.length ? (
                <div className="rounded-[16px] border border-[var(--color-amber)]/30 bg-[var(--color-amber-bg)] p-3 text-sm text-[var(--color-text-secondary)]">
                  {warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              ) : null}

              <div className="rounded-[16px] border border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {CP12_VOICE_READING_FIELDS.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-eyebrow)]">
                        {field.label}
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          value={editableValues[field.key]}
                          onChange={(event) =>
                            setEditableValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                          }
                          placeholder="--"
                        />
                        {field.unit ? <span className="text-xs text-[var(--color-text-tertiary)]">{field.unit}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {!canApply ? (
                <div className="rounded-[16px] border border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] p-3 text-sm text-[var(--color-text-tertiary)]">
                  No confident readings were parsed. Close this and enter the values manually.
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="button" className="rounded-full" onClick={handleApply} disabled={!canApply}>
                  Apply
                </Button>
              </div>
            </div>
          ) : null}

          {state === 'error' ? (
            <div className="space-y-4">
              <div className="rounded-[16px] border border-[var(--color-red)]/30 bg-[var(--color-red-bg)] p-4 text-sm text-[var(--color-red)]">
                {errorMessage || 'Voice capture failed.'}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={closeModal}>
                  Close
                </Button>
                <Button type="button" className="rounded-full" onClick={startRecording} disabled={disabled}>
                  Try again
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
