export const runtime = 'nodejs';

import { getDb } from '@/lib/db';
import { parseManualFlashcardBody, readJson } from '@/lib/validation';

export async function POST(req: Request) {
  const db = getDb();
  let parsed: { topicId: number; front: string; back: string; elaboration: string | null };
  try {
    parsed = parseManualFlashcardBody(await readJson(req));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Invalid request' }, { status: 400 });
  }

  const result = db.prepare(
    'INSERT INTO flashcards (topic_id, front, back, elaboration) VALUES (?, ?, ?, ?)'
  ).run(parsed.topicId, parsed.front, parsed.back, parsed.elaboration);

  return Response.json({ id: result.lastInsertRowid, ok: true }, { status: 201 });
}

export async function GET(req: Request) {
  const db = getDb();
  const url = new URL(req.url);
  const topicId = url.searchParams.get('topicId');

  if (!topicId) return Response.json({ error: 'topicId required' }, { status: 400 });

  const cards = db.prepare(`
    SELECT * FROM flashcards WHERE topic_id = ? ORDER BY created_at DESC
  `).all(topicId);

  return Response.json({ cards });
}

export async function DELETE(req: Request) {
  const db = getDb();
  const { id } = await req.json() as { id: number };
  db.prepare('DELETE FROM flashcards WHERE id = ?').run(id);
  return Response.json({ ok: true });
}
