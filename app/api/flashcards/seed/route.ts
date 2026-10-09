export const runtime = 'nodejs';

import { getDb } from '@/lib/db';
import { flashcardSeedPrompt, extractJSON } from '@/lib/ollama';
import { generate } from '@/lib/ai';
import { fallbackFlashcards } from '@/lib/aiFallbacks';
import { normalizeFlashcardDrafts, parseTopicIdBody, readJson } from '@/lib/validation';

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

  const prompt = flashcardSeedPrompt(topic.name);
  const raw = await generate(prompt);

  if (!raw) {
    return Response.json({ error: 'AI unavailable' }, { status: 503 });
  }

  const parsed = normalizeFlashcardDrafts(extractJSON<{ front: string; back: string }[]>(raw));
  const drafts = parsed.length > 0 ? parsed : fallbackFlashcards(topic.name);

  const insert = db.prepare(
    'INSERT INTO flashcards (topic_id, front, back) VALUES (?, ?, ?)'
  );

  const cards = [];
  for (const card of drafts.slice(0, 15)) {
    const res = insert.run(topicId, card.front, card.back);
    cards.push({ id: res.lastInsertRowid, front: card.front, back: card.back });
  }

  return Response.json({
    cards,
    count: cards.length,
    warning: parsed.length === 0 ? 'AI response could not be parsed, so local fallback cards were used.' : undefined,
  });
}
