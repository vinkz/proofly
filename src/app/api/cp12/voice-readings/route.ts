import { NextResponse } from 'next/server';

import { parseCp12VoiceReadings } from '@/lib/cp12/voice-readings';
import { getOpenAIClient } from '@/lib/openai';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const formData = await request.formData();
  const jobId = formData.get('jobId');
  const audio = formData.get('audio');

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
      model: 'gpt-4o-mini-transcribe',
      response_format: 'json',
    });

    const result = parseCp12VoiceReadings(transcription.text ?? '');
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Voice transcription failed';
    const status = /OPENAI_API_KEY/i.test(message) ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
