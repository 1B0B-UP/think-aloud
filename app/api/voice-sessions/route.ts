export const runtime = 'nodejs';

import { getDb } from '@/lib/db';
import type { Difficulty } from '@/lib/steps';

export async function GET() {
  const db = getDb();
  const sessions = db.prepare(`
    SELECT * FROM voice_sessions
    ORDER BY started_at DESC
    LIMIT 100
  `).all();
  return Response.json({ sessions });
}

export async function POST(req: Request) {
  const db = getDb();
  const body = (await req.json()) as {
    scenario: string;
    topic: string;
    difficulty: Difficulty;
  };

  if (!body.scenario || body.scenario.length < 4) {
    return Response.json({ error: 'Scenario is required' }, { status: 400 });
  }

  const result = db.prepare(
    'INSERT INTO voice_sessions (scenario, topic, difficulty) VALUES (?, ?, ?)'
  ).run(body.scenario, body.topic || 'custom', body.difficulty || 'medium');

  const id = result.lastInsertRowid as number;
  const session = db.prepare('SELECT * FROM voice_sessions WHERE id = ?').get(id);
  return Response.json({ session }, { status: 201 });
}
