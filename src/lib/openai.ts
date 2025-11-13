import OpenAI from 'openai';

let client: OpenAI | null = null;

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY. Set it in your environment to generate reports.');
  }

  if (!client) {
    client = new OpenAI({ apiKey });
  }

  return client;
}
