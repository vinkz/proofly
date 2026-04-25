'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import {
  CP12_VOICE_READING_FIELDS,
  type Cp12VoiceReadingsParsed,
} from '@/lib/cp12/voice-readings';

type Props = {
  jobId: string;
  disabled?: boolean;
  buttonLabel?: string;
  buttonClassName?: string;
  onApply: (values: Partial<Cp12VoiceReadingsParsed>) => void;
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
  disabled = false,
  buttonLabel = 'Speak readings',
  buttonClassName = 'rounded-full text-xs',
  onApply,
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

      setTranscript(payload?.transcript ?? '');
      setWarnings(Array.isArray(payload?.warnings) ? payload.warnings : []);
      setEditableValues(toEditableState(payload?.parsed ?? { ...EMPTY_EDITABLE }));
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
    setOpen(true);
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

  return (
    <>
      <Button type="button" variant="outline" className={buttonClassName} onClick={startRecording} disabled={disabled}>
        {buttonLabel}
      </Button>

      <Modal open={open} onClose={closeModal} title="Speak readings">
        <div className="space-y-4">
          {state === 'starting' ? (
            <div className="rounded-2xl border border-white/10 bg-white/40 p-4 text-sm text-muted">
              Starting microphone…
            </div>
          ) : null}

          {state === 'recording' ? (
            <div className="rounded-2xl border border-[var(--action)]/30 bg-[var(--action)]/10 p-4">
              <p className="text-sm font-semibold text-muted">Listening…</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Say readings like “working pressure 20”, “high CO2 9 point 2”, or “low ratio 0 point 0006”.
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
            <div className="rounded-2xl border border-white/10 bg-white/40 p-4 text-sm text-muted">
              Transcribing and parsing readings…
            </div>
          ) : null}

          {state === 'review' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Transcript</p>
                <div className="rounded-2xl border border-white/10 bg-white/40 p-3 text-sm text-muted">
                  {transcript || 'No transcript returned.'}
                </div>
              </div>

              {warnings.length ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-muted">
                  {warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              ) : null}

              <div className="rounded-2xl border border-white/10 bg-white/40 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {CP12_VOICE_READING_FIELDS.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
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
                        {field.unit ? <span className="text-xs text-muted-foreground/70">{field.unit}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {!canApply ? (
                <div className="rounded-2xl border border-white/10 bg-white/30 p-3 text-sm text-muted-foreground/70">
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
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
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
