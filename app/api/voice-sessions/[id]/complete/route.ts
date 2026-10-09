export const runtime = 'nodejs';

import { getDb } from '@/lib/db';
import { ollamaGenerate } from '@/lib/ollama';
import { summaryPrompt, parseSummaryTag } from '@/lib/prompts';
import type { Difficulty, StepKey } from '@/lib/steps';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const session = db.prepare('SELECT * FROM voice_sessions WHERE id = ?').get(id) as
    | { id: number; scenario: string; difficulty: Difficulty; total_hints: number }
    | undefined;
  if (!session) return Response.json({ error: 'Not found' }, { status: 404 });

  const steps = db.prepare('SELECT step_key, user_text, quality FROM voice_steps WHERE session_id = ? ORDER BY id ASC').all(id) as {
    step_key: StepKey;
    user_text: string;
    quality: number | null;
  }[];

  const prompt = summaryPrompt({
    scenario: session.scenario,
    difficulty: session.difficulty,
    steps: steps.map(s => ({ stepKey: s.step_key, userText: s.user_text, quality: s.quality })),
    totalHints: session.total_hints,
  });

  let summary = 'Session complete. Reflect on which step felt hardest, and try a harder difficulty next.';
  let score: number | null = null;
  // Summary is 3-4 sentences plus tag — 320 tokens is generous.
  const raw = await ollamaGenerate(prompt, undefined, { numPredict: 320 });
  if (raw) {
    const parsed = parseSummaryTag(raw);
    summary = parsed.body || summary;
    score = parsed.score;
  }

  // Fallback score: average of step qualities ×20, plus completeness bonus.
  if (score === null) {
    const validQ = steps.map(s => s.quality).filter((q): q is number => typeof q === 'number');
    const avg = validQ.length > 0 ? validQ.reduce((a, b) => a + b, 0) / validQ.length : 3;
    score = Math.round(Math.min(100, avg * 18 + (steps.length / 4) * 10));
  }

  db.prepare(`
    UPDATE voice_sessions
    SET completed_at = datetime('now'), summary = ?, quality_score = ?
    WHERE id = ?
  `).run(summary, score, id);

  return Response.json({ summary, score });
}
