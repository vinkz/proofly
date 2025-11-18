import OpenAI from 'openai';

import { env } from '@/lib/env';

let client: OpenAI | null = null;

export function getOpenAIClient() {
  if (!client) {
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  return client;
}
