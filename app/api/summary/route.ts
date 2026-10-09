export const runtime = 'nodejs';

import { getDb, upsertDailyStats } from '@/lib/db';
import { summaryPrompt } from '@/lib/ollama';
import { generate } from '@/lib/ai';
import { parseTopicIdBody, readJson } from '@/lib/validation';

export async function POST(req: Request) {
  const db = getDb();
  let topicId: number;
  try {
    ({ topicId } = parseTopicIdBody(await readJson(req)));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Invalid request' }, { status: 400 });
  }

  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId) as { name: string } | undefined;
  if (!topic) return Response.json({ error: 'Topic not found' }, { status: 404 });

  const prompt = summaryPrompt(topic.name);
  const content = await generate(prompt);

  if (!content) return Response.json({ error: 'AI unavailable' }, { status: 503 });

  upsertDailyStats({ xp_earned: 10 });

  return Response.json({ content, topicName: topic.name });
}
