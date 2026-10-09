export const runtime = 'nodejs';

import { sequenceMemoryPrompt, extractJSON } from '@/lib/ollama';
import { generate } from '@/lib/ai';
import { normalizeSequenceSteps, parseSequenceBody, readJson } from '@/lib/validation';

export async function POST(req: Request) {
  let topicName: string;
  try {
    ({ topicName } = parseSequenceBody(await readJson(req)));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Invalid request' }, { status: 400 });
  }

  const raw = await generate(sequenceMemoryPrompt(topicName));
  if (!raw) return Response.json({ error: 'AI unavailable' }, { status: 503 });

  const steps = normalizeSequenceSteps(extractJSON<string[]>(raw));
  if (steps.length < 3) {
    return Response.json({ error: 'Could not parse steps' }, { status: 500 });
  }

  return Response.json({ steps: steps.slice(0, 6) });
}
