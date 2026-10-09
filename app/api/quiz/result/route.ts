export const runtime = 'nodejs';

import { getDb, upsertDailyStats } from '@/lib/db';
import { parseQuizResultBody, readJson } from '@/lib/validation';
import { answersMatch } from '@/lib/quizMatch';

export async function POST(req: Request) {
  const db = getDb();
  let parsed: ReturnType<typeof parseQuizResultBody>;
  try {
    parsed = parseQuizResultBody(await readJson(req));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Invalid request' }, { status: 400 });
  }

  const correct = answersMatch(parsed.userAnswer, parsed.correctAnswer, parsed.options) ? 1 : 0;

  db.prepare(`
    INSERT INTO quiz_attempts (topic_id, session_id, question, options, correct_answer, user_answer, correct, response_time_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(parsed.topicId, parsed.sessionId, parsed.question, JSON.stringify(parsed.options), parsed.correctAnswer, parsed.userAnswer, correct, parsed.responseTimeMs);

  db.prepare(`
    UPDATE topic_skills SET
      quiz_total = quiz_total + 1,
      quiz_correct = quiz_correct + ?,
      last_practiced = datetime('now')
    WHERE topic_id = ?
  `).run(correct, parsed.topicId);

  recalcSkillLevel(db, parsed.topicId);

  const xp = correct ? 5 : 0;
  upsertDailyStats({ quiz_questions: 1, quiz_correct: correct, xp_earned: xp });

  return Response.json({ ok: true, correct: correct === 1, xp });
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
