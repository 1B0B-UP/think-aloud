export const runtime = 'nodejs';

import { getDb } from '@/lib/db';
import { SEED_FLASHCARDS } from '@/lib/seeds';

export async function POST() {
  const db = getDb();

  const insert = db.prepare(
    'INSERT OR IGNORE INTO flashcards (topic_id, front, back) VALUES (?, ?, ?)'
  );

  let total = 0;

  for (const [topicName, cards] of Object.entries(SEED_FLASHCARDS)) {
    const topic = db.prepare('SELECT id FROM topics WHERE name = ?').get(topicName) as { id: number } | undefined;
    if (!topic) continue;

    for (const card of cards) {
      const existing = db.prepare(
        'SELECT id FROM flashcards WHERE topic_id = ? AND front = ?'
      ).get(topic.id, card.front);
      if (!existing) {
        insert.run(topic.id, card.front, card.back);
        total++;
      }
    }
  }

  return Response.json({ ok: true, inserted: total });
}
