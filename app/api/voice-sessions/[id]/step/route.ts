export const runtime = 'nodejs';

import { getDb } from '@/lib/db';
import type { StepKey } from '@/lib/steps';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const body = (await req.json()) as {
    stepKey: StepKey;
    userText: string;
    coachFeedback: string | null;
    hintsUsed: number;
    quality: number | null;
  };

  if (!body.stepKey || !body.userText) {
    return Response.json({ error: 'stepKey and userText are required' }, { status: 400 });
  }

  db.prepare(`
    INSERT INTO voice_steps (session_id, step_key, user_text, coach_feedback, hints_used, quality)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id, step_key) DO UPDATE SET
      user_text = excluded.user_text,
      coach_feedback = excluded.coach_feedback,
      hints_used = excluded.hints_used,
      quality = excluded.quality
  `).run(id, body.stepKey, body.userText, body.coachFeedback, body.hintsUsed || 0, body.quality);

  // Bump session hint total
  db.prepare(`
    UPDATE voice_sessions
    SET total_hints = (SELECT COALESCE(SUM(hints_used), 0) FROM voice_steps WHERE session_id = ?)
    WHERE id = ?
  `).run(id, id);

  return Response.json({ ok: true });
}
