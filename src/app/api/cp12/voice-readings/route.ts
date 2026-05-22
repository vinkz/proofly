import { NextResponse } from 'next/server';

import { parseCp12VoiceReadings, type Cp12VoiceReadingScope } from '@/lib/cp12/voice-readings';
import { getOpenAIClient } from '@/lib/openai';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

const getTranscriptionModel = () =>
  process.env.OPENAI_TRANSCRIBE_MODEL?.trim() ||
  process.env.OPENAI_TRANSCRIBE_MODE?.trim() ||
  'gpt-4o-mini-transcribe';

export async function POST(request: Request) {
  const formData = await request.formData();
  const jobId = formData.get('jobId');
  const audio = formData.get('audio');
  const rawScope = formData.get('scope');
  const scope = typeof rawScope === 'string' && ['pressure', 'high', 'low', 'combustion'].includes(rawScope)
    ? rawScope as Cp12VoiceReadingScope
    : 'all';

  if (typeof jobId !== 'string' || !jobId.trim()) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
  }

  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: 'Missing audio file' }, { status: 400 });
  }

  const supabase = await supabaseServerReadOnly();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  try {
    const transcription = await getOpenAIClient().audio.transcriptions.create({
      file: audio,
      model: getTranscriptionModel(),
      prompt:
        'Gas engineer reading appliance values. Preserve numbers exactly, including decimals and small pauses. The engineer may speak only numbers in order. Pressure scope order: operating pressure, heat input. Combustion scope order: CO ppm, CO2 percent, ratio. Likely phrases include operating pressure, working pressure, burner pressure, heat input, heating put, input, gas rate, rated input, high rate, full rate, high fire, low rate, low fire, load rate, CO ppm, CO2 percent, carbon monoxide, carbon dioxide, ratio, CO/CO2 ratio.',
      response_format: 'json',
    });

    const result = parseCp12VoiceReadings(transcription.text ?? '', { scope });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Voice transcription failed';
    const status = /OPENAI_API_KEY/i.test(message) ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
