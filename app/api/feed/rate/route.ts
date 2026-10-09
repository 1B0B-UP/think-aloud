export const runtime = 'nodejs';

import { getDb } from '@/lib/db';

export async function POST(req: Request) {
  const db = getDb();
  const { itemId, rating } = await req.json() as { itemId: number; rating: 1 | -1 | 0 };

  if (!itemId || ![-1, 0, 1].includes(rating)) {
    return Response.json({ error: 'itemId and rating (-1|0|1) required' }, { status: 400 });
  }

  db.prepare('UPDATE feed_items SET user_rating = ?, seen_count = seen_count + 1 WHERE id = ?')
    .run(rating, itemId);

  // Adjust topic feed_weight: like → +0.1, dislike → -0.1, clamped 0.1–3.0
  if (rating !== 0) {
    const item = db.prepare('SELECT topic_id FROM feed_items WHERE id = ?').get(itemId) as { topic_id: number } | undefined;
    if (item) {
      const delta = rating === 1 ? 0.1 : -0.1;
      db.prepare(`
        UPDATE topic_skills
        SET feed_weight = MAX(0.1, MIN(3.0, COALESCE(feed_weight, 1.0) + ?))
        WHERE topic_id = ?
      `).run(delta, item.topic_id);
    }
  }

  return Response.json({ ok: true });
}
