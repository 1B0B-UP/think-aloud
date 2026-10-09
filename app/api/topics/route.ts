export const runtime = 'nodejs';

import { getDb, ensureTopicSkill } from '@/lib/db';
import { parseTopicCreateBody, readJson } from '@/lib/validation';

export async function GET() {
  const db = getDb();
  const topics = db.prepare(`
    SELECT t.*,
      COALESCE(ts.level, 0) as level,
      COALESCE(ts.quiz_total, 0) as quiz_total,
      COALESCE(ts.quiz_correct, 0) as quiz_correct,
      COALESCE(ts.cards_mastered, 0) as cards_mastered,
      ts.last_practiced,
      (SELECT COUNT(*) FROM flashcards f WHERE f.topic_id = t.id) as card_count,
      (SELECT COUNT(*) FROM flashcards f WHERE f.topic_id = t.id AND f.due_date <= date('now')) as due_count
    FROM topics t
    LEFT JOIN topic_skills ts ON ts.topic_id = t.id
    ORDER BY t.is_custom ASC, t.name ASC
  `).all();
  return Response.json({ topics });
}

export async function POST(req: Request) {
  const db = getDb();
  let parsed: { name: string; description: string | null; icon: string };
  try {
    parsed = parseTopicCreateBody(await readJson(req));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Invalid request' }, { status: 400 });
  }

  try {
    const result = db.prepare(
      'INSERT INTO topics (name, description, icon, is_custom) VALUES (?, ?, ?, 1)'
    ).run(parsed.name, parsed.description, parsed.icon);

    ensureTopicSkill(result.lastInsertRowid as number);
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(result.lastInsertRowid);
    return Response.json({ topic }, { status: 201 });
  } catch {
    return Response.json({ error: 'Topic already exists' }, { status: 409 });
  }
}
