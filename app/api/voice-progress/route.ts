export const runtime = 'nodejs';

import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();

  const totalsRow = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as completed,
      AVG(quality_score) as avg_score
    FROM voice_sessions
  `).get() as { total: number; completed: number; avg_score: number | null };

  const byDifficulty = db.prepare(`
    SELECT difficulty, COUNT(*) as count
    FROM voice_sessions
    WHERE completed_at IS NOT NULL
    GROUP BY difficulty
  `).all();

  const recent = db.prepare(`
    SELECT * FROM voice_sessions
    ORDER BY started_at DESC
    LIMIT 8
  `).all();

  // Streak: consecutive days with at least one completed session, ending today or yesterday.
  const days = db.prepare(`
    SELECT DISTINCT date(completed_at) as d
    FROM voice_sessions
    WHERE completed_at IS NOT NULL
    ORDER BY d DESC
  `).all() as { d: string }[];

  let streakDays = 0;
  if (days.length > 0) {
    const dayStr = (d: Date) => d.toISOString().slice(0, 10);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    let cursor = days[0].d === dayStr(today) ? new Date(today) :
                 days[0].d === dayStr(yesterday) ? new Date(yesterday) : null;

    if (cursor) {
      const dayset = new Set(days.map(x => x.d));
      while (dayset.has(dayStr(cursor))) {
        streakDays++;
        cursor.setDate(cursor.getDate() - 1);
      }
    }
  }

  return Response.json({
    totalSessions: totalsRow.total,
    completedSessions: totalsRow.completed,
    avgScore: totalsRow.avg_score ? Math.round(totalsRow.avg_score) : null,
    streakDays,
    byDifficulty,
    recent,
  });
}
