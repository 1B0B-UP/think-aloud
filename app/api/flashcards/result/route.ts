export const runtime = 'nodejs';

import { getDb, upsertDailyStats } from '@/lib/db';
import { fsrsUpdate, retrievability } from '@/lib/fsrs';
import type { Grade } from '@/lib/fsrs';
import { parseFlashcardResultBody, readJson } from '@/lib/validation';

export async function POST(req: Request) {
  const db = getDb();
  let parsed: { cardId: number; grade: Grade; elapsedMs: number };
  try {
    parsed = parseFlashcardResultBody(await readJson(req));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Invalid request' }, { status: 400 });
  }

  const card = db.prepare('SELECT * FROM flashcards WHERE id = ?').get(parsed.cardId) as {
    id: number;
    topic_id: number;
    stability: number;
    difficulty: number;
    repetitions: number;
    due_date: string;
  } | undefined;
  if (!card) return Response.json({ error: 'Card not found' }, { status: 404 });

  const elapsedDays = Math.max(0, parsed.elapsedMs / 86400000);
  const result = fsrsUpdate(
    { stability: card.stability ?? 0, difficulty: card.difficulty ?? 5, repetitions: card.repetitions },
    parsed.grade,
    elapsedDays
  );

  db.prepare(`
    UPDATE flashcards SET
      stability = ?,
      difficulty = ?,
      repetitions = ?,
      due_date = ?,
      ease_factor = ?,
      interval_days = ?
    WHERE id = ?
  `).run(
    result.stability,
    result.difficulty,
    result.repetitions,
    result.due_date,
    result.stability,  // keep ease_factor in sync for legacy compatibility
    result.interval,
    parsed.cardId
  );

  const correct = parsed.grade >= 3;
  // XP: Again=1, Hard=3, Good=7, Easy=10 (first time)
  const xp = [0, 1, 3, 7, 10][parsed.grade] ?? 1;

  upsertDailyStats({ flashcards_reviewed: 1, xp_earned: xp });

  // Only mark card as newly mastered when it crosses into "stable" territory
  const justMastered = correct && card.repetitions === 1 && result.repetitions >= 2;
  if (justMastered) {
    db.prepare(`
      UPDATE topic_skills SET cards_mastered = cards_mastered + 1, last_practiced = datetime('now')
      WHERE topic_id = ?
    `).run(card.topic_id);
  } else {
    db.prepare(`
      UPDATE topic_skills SET last_practiced = datetime('now') WHERE topic_id = ?
    `).run(card.topic_id);
  }

  if (justMastered || correct) recalcSkillLevel(db, card.topic_id);

  return Response.json({
    ok: true,
    xp,
    interval: result.interval,
    stability: result.stability,
    retrievability: retrievability(0, result.stability),
  });
}

function recalcSkillLevel(db: ReturnType<typeof import('@/lib/db').getDb>, topicId: number) {
  const skill = db.prepare('SELECT * FROM topic_skills WHERE topic_id = ?').get(topicId) as {
    quiz_total: number; quiz_correct: number; cards_mastered: number;
  } | undefined;
  if (!skill) return;

  const quizScore = skill.quiz_total > 0 ? (skill.quiz_correct / skill.quiz_total) * 70 : 0;
  const cardScore = Math.min(skill.cards_mastered * 2, 30);
  const level = Math.round(Math.min(100, quizScore + cardScore));
  db.prepare('UPDATE topic_skills SET level = ? WHERE topic_id = ?').run(level, topicId);
}
