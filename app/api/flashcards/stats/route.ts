export const runtime = 'nodejs';

import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();

  // Cards by retention health (based on stability)
  const total = (db.prepare('SELECT COUNT(*) as c FROM flashcards').get() as { c: number }).c;
  const new_cards = (db.prepare('SELECT COUNT(*) as c FROM flashcards WHERE repetitions = 0').get() as { c: number }).c;
  const learning = (db.prepare('SELECT COUNT(*) as c FROM flashcards WHERE repetitions BETWEEN 1 AND 2').get() as { c: number }).c;
  const reviewing = (db.prepare('SELECT COUNT(*) as c FROM flashcards WHERE repetitions >= 3 AND stability < 21').get() as { c: number }).c;
  const mature = (db.prepare('SELECT COUNT(*) as c FROM flashcards WHERE stability >= 21').get() as { c: number }).c;

  // Average stability by topic (top 5 strongest, bottom 5 weakest for reviewed cards)
  const byTopic = db.prepare(`
    SELECT t.name, t.icon,
      COUNT(*) as total,
      AVG(f.stability) as avg_stability,
      SUM(CASE WHEN f.stability >= 21 THEN 1 ELSE 0 END) as mature_count
    FROM flashcards f
    JOIN topics t ON t.id = f.topic_id
    WHERE f.repetitions > 0
    GROUP BY f.topic_id
    ORDER BY avg_stability DESC
  `).all() as { name: string; icon: string; total: number; avg_stability: number; mature_count: number }[];

  // Due in next 7 days by day
  const forecast = [];
  for (let i = 0; i <= 6; i++) {
    const count = (db.prepare(`
      SELECT COUNT(*) as c FROM flashcards
      WHERE due_date = date('now', '+' || ? || ' days')
    `).get(i) as { c: number }).c;
    forecast.push({ day: i, count });
  }

  return Response.json({ total, new_cards, learning, reviewing, mature, byTopic, forecast });
}
