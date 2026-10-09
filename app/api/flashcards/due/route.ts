export const runtime = 'nodejs';

import { getDb } from '@/lib/db';

export async function GET(req: Request) {
  const db = getDb();
  const url = new URL(req.url);
  const topicId = url.searchParams.get('topicId');
  const limit = parseInt(url.searchParams.get('limit') ?? '20');

  let cards;
  if (topicId) {
    cards = db.prepare(`
      SELECT f.*, t.name as topic_name, t.icon as topic_icon
      FROM flashcards f
      JOIN topics t ON t.id = f.topic_id
      WHERE f.topic_id = ? AND f.due_date <= date('now')
      ORDER BY f.due_date ASC, RANDOM()
      LIMIT ?
    `).all(topicId, limit);
  } else {
    cards = db.prepare(`
      SELECT f.*, t.name as topic_name, t.icon as topic_icon
      FROM flashcards f
      JOIN topics t ON t.id = f.topic_id
      WHERE f.due_date <= date('now')
      ORDER BY RANDOM()
      LIMIT ?
    `).all(limit);

    if (cards.length < limit) {
      const extra = db.prepare(`
        SELECT f.*, t.name as topic_name, t.icon as topic_icon
        FROM flashcards f
        JOIN topics t ON t.id = f.topic_id
        WHERE f.due_date <= date('now')
        ORDER BY RANDOM()
        LIMIT ?
      `).all(limit - cards.length);
      const seen = new Set((cards as { id: number }[]).map(c => c.id));
      cards = [...cards, ...(extra as { id: number }[]).filter(c => !seen.has(c.id))];
    }
  }

  const total = (db.prepare(`
    SELECT COUNT(*) as c FROM flashcards WHERE due_date <= date('now')
  `).get() as { c: number }).c;

  return Response.json({ cards, total });
}
