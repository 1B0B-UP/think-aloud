export const runtime = 'nodejs';

import { getDb } from '@/lib/db';
import { weakAreaPrompt, extractJSON } from '@/lib/ollama';
import { generate } from '@/lib/ai';
import type { WeakArea } from '@/types';
import { normalizeWeakAreas } from '@/lib/normalize';

export async function GET() {
  const db = getDb();

  const today = localDateStr(new Date());

  const last14 = db.prepare(`
    SELECT * FROM daily_stats
    WHERE date >= date('now', '-13 days')
    ORDER BY date ASC
  `).all();

  const streak = calcStreak(db);
  const todayStats = db.prepare('SELECT * FROM daily_stats WHERE date = ?').get(today) as {
    xp_earned: number;
  } | undefined;

  const topicSkills = db.prepare(`
    SELECT t.id, t.name, t.icon,
      COALESCE(ts.level, 0) as level,
      COALESCE(ts.quiz_total, 0) as quiz_total,
      COALESCE(ts.quiz_correct, 0) as quiz_correct,
      COALESCE(ts.cards_mastered, 0) as cards_mastered,
      ts.last_practiced
    FROM topics t
    LEFT JOIN topic_skills ts ON ts.topic_id = t.id
    ORDER BY ts.level DESC NULLS LAST
  `).all();

  const dueCards = (db.prepare(`
    SELECT COUNT(*) as c FROM flashcards WHERE due_date <= date('now')
  `).get() as { c: number }).c;

  const weakAreas = await getWeakAreas(db);

  return Response.json({
    streak,
    todayXP: todayStats?.xp_earned ?? 0,
    weeklyXP: last14,
    topicSkills,
    weakAreas,
    totalDueCards: dueCards,
  });
}

function localDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function calcStreak(db: ReturnType<typeof import('@/lib/db').getDb>): number {
  const rows = db.prepare(`
    SELECT date FROM daily_stats
    WHERE xp_earned > 0
    ORDER BY date DESC
    LIMIT 60
  `).all() as { date: string }[];

  if (rows.length === 0) return 0;

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < rows.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    if (rows[i].date === localDateStr(expected)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

const weakAreaCache: { data: WeakArea[]; ts: number } = { data: [], ts: 0 };

async function getWeakAreas(db: ReturnType<typeof import('@/lib/db').getDb>): Promise<WeakArea[]> {
  if (Date.now() - weakAreaCache.ts < 6 * 60 * 60 * 1000 && weakAreaCache.data.length > 0) {
    return weakAreaCache.data;
  }

  const stats = db.prepare(`
    SELECT t.name as topic, ts.quiz_total, ts.quiz_correct
    FROM topics t
    JOIN topic_skills ts ON ts.topic_id = t.id
    WHERE ts.quiz_total >= 3
    ORDER BY CAST(ts.quiz_correct AS REAL) / ts.quiz_total ASC
    LIMIT 6
  `).all() as { topic: string; quiz_total: number; quiz_correct: number }[];

  if (stats.length === 0) return [];

  const statsWithPct = stats.map(s => ({
    topic: s.topic,
    score_pct: Math.round((s.quiz_correct / s.quiz_total) * 100),
  }));

  const raw = await generate(weakAreaPrompt(statsWithPct));
  if (!raw) return statsWithPct.slice(0, 3).map(s => ({
    ...s,
    recommendation: 'Review core concepts and practice with flashcards.',
  }));

  const parsed = normalizeWeakAreas(extractJSON<WeakArea[]>(raw));
  if (parsed.length > 0) {
    weakAreaCache.data = parsed.slice(0, 3);
    weakAreaCache.ts = Date.now();
    return weakAreaCache.data;
  }

  return statsWithPct.slice(0, 3).map(s => ({
    ...s,
    recommendation: 'Review core concepts and practice with flashcards.',
  }));
}
