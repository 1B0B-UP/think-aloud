export const runtime = 'nodejs';

import { getDb, setSetting } from '@/lib/db';
import { clearModelCache } from '@/lib/ollama';

export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM app_settings').all() as { key: string; value: string }[];
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return Response.json({ settings });
}

/** Accepts either:
 *    { key: "x", value: "y" }           — single update (noble-shell legacy)
 *    { "foo": "bar", "baz": "qux", ... } — bulk update (think-aloud)         */
export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;

  let touchedOllamaModel = false;
  if (typeof body.key === 'string' && typeof body.value === 'string') {
    setSetting(body.key, body.value);
    if (body.key === 'ollama_model') touchedOllamaModel = true;
  } else {
    for (const [k, v] of Object.entries(body)) {
      if (typeof v === 'string') {
        setSetting(k, v);
        if (k === 'ollama_model') touchedOllamaModel = true;
      }
    }
  }
  if (touchedOllamaModel) clearModelCache();
  return Response.json({ ok: true });
}
