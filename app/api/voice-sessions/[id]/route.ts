export const runtime = 'nodejs';

import { getDb } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const session = db.prepare('SELECT * FROM voice_sessions WHERE id = ?').get(id);
  if (!session) return Response.json({ error: 'Not found' }, { status: 404 });
  const steps = db.prepare('SELECT * FROM voice_steps WHERE session_id = ? ORDER BY id ASC').all(id);
  return Response.json({ ...session, steps });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM voice_sessions WHERE id = ?').run(id);
  db.prepare('DELETE FROM voice_steps WHERE session_id = ?').run(id);
  return Response.json({ ok: true });
}
