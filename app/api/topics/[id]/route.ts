export const runtime = 'nodejs';

import { getDb } from '@/lib/db';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(id) as { is_custom: number } | undefined;
  if (!topic) return Response.json({ error: 'Not found' }, { status: 404 });
  if (!topic.is_custom) return Response.json({ error: 'Cannot delete built-in topics' }, { status: 403 });

  // Delete related records that don't have ON DELETE CASCADE
  // (quiz_attempts, study_sessions, topic_skills only have NO ACTION)
  db.prepare('DELETE FROM topic_skills   WHERE topic_id = ?').run(id);
  db.prepare('DELETE FROM quiz_attempts  WHERE topic_id = ?').run(id);
  db.prepare('DELETE FROM study_sessions WHERE topic_id = ?').run(id);
  // feed_items and flashcards have CASCADE and are handled automatically

  db.prepare('DELETE FROM topics WHERE id = ?').run(id);
  return Response.json({ ok: true });
}
