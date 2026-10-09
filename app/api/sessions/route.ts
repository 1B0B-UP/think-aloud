export const runtime = 'nodejs';

import { getDb, upsertDailyStats } from '@/lib/db';

export async function POST(req: Request) {
  const db = getDb();
  const { action, sessionType, topicId, durationMs } = await req.json() as {
    action: 'start' | 'end';
    sessionType: 'flashcard' | 'quiz' | 'summary' | 'focus';
    topicId?: number;
    durationMs?: number;
  };

  if (action === 'start') {
    const result = db.prepare(`
      INSERT INTO study_sessions (session_type, topic_id) VALUES (?, ?)
    `).run(sessionType, topicId ?? null);
    return Response.json({ sessionId: result.lastInsertRowid });
  }

  if (action === 'end' && durationMs) {
    upsertDailyStats({ total_time_ms: durationMs });
    if (sessionType === 'focus') {
      upsertDailyStats({ focus_sessions: 1, xp_earned: 20 });
    }
  }

  return Response.json({ ok: true });
}
