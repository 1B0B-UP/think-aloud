import { getDb } from './db';
import { ollamaGenerate } from './ollama';

// Cache the verified model so we don't hit the API every call
let verifiedModel: string | null = null;
let lastVerified = 0;
const VERIFY_TTL = 60_000; // re-check every 60s

export async function getModelVerified(): Promise<string | null> {
  const now = Date.now();
  if (verifiedModel && (now - lastVerified) < VERIFY_TTL) return verifiedModel;

  try {
    // Get saved preference
    const db       = getDb();
    const row      = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('ollama_model') as { value: string } | undefined;
    const saved    = row?.value ?? 'llama3.2:3b';

    // Check which models are actually installed
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data    = await res.json() as { models: { name: string }[] };
    const models  = data.models?.map(m => m.name) ?? [];

    if (models.length === 0) return null;

    // Prefer the saved model, fall back to the first installed model
    const model = models.find(m => m === saved || m.startsWith(saved.split(':')[0]))
                  ?? models[0];

    // Update saved preference if it drifted
    if (model !== saved) {
      db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run('ollama_model', model);
    }

    verifiedModel = model;
    lastVerified  = now;
    return model;
  } catch {
    return null;
  }
}

export function getModel(): string {
  try {
    const db  = getDb();
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('ollama_model') as { value: string } | undefined;
    return row?.value ?? 'llama3.2:3b';
  } catch {
    return 'llama3.2:3b';
  }
}

export async function generate(prompt: string): Promise<string | null> {
  const model = await getModelVerified();
  if (!model) return null;
  return ollamaGenerate(prompt, model);
}
