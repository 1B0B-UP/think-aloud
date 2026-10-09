const OLLAMA_BASE = 'http://localhost:11434';

import { getDb } from './db';

export function getModel(): string {
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('ollama_model') as { value: string } | undefined;
    return row?.value || 'llama3.2:3b';
  } catch {
    return 'llama3.2:3b';
  }
}

export async function ollamaOnline(): Promise<{ online: boolean; hasModels: boolean; models: string[] }> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return { online: false, hasModels: false, models: [] };
    const data = (await res.json()) as { models?: { name: string }[] };
    const models = (data.models ?? []).map(m => m.name);
    return { online: true, hasModels: models.length > 0, models };
  } catch {
    return { online: false, hasModels: false, models: [] };
  }
}

/* ───────── Self-healing model resolver ─────────
   The saved Ollama model preference can drift (model deleted, settings restored
   from a different machine, etc.). Cache the verified model for a minute; on a
   miss, swap to the first installed model and persist the change so the same
   request is fast next time. */

let verifiedModel: string | null = null;
let verifiedAt = 0;
const VERIFY_TTL_MS = 60_000;

async function resolveModel(): Promise<string | null> {
  const now = Date.now();
  if (verifiedModel && (now - verifiedAt) < VERIFY_TTL_MS) return verifiedModel;

  const saved = getModel();
  const status = await ollamaOnline();
  if (!status.online || status.models.length === 0) return null;

  // Prefer exact match, then same model family (before the colon tag), else first installed.
  const stem = saved.split(':')[0];
  const chosen =
    status.models.find(m => m === saved) ??
    status.models.find(m => m === stem || m.startsWith(stem + ':')) ??
    status.models[0];

  if (chosen !== saved) {
    try {
      const db = getDb();
      db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .run('ollama_model', chosen);
    } catch { /* best effort */ }
  }
  verifiedModel = chosen;
  verifiedAt = now;
  return chosen;
}

/** Clear the resolver cache. Call this when the user changes the model in settings. */
export function clearModelCache() { verifiedModel = null; verifiedAt = 0; }

interface OllamaOpts {
  /** Maximum tokens to generate. Cap responses to what they actually need. */
  numPredict?: number;
  /** How long to keep the model loaded after this request. Default: 10m. */
  keepAlive?: string;
}

const DEFAULT_KEEP_ALIVE = '10m';

export async function ollamaGenerate(prompt: string, model?: string, opts: OllamaOpts = {}): Promise<string | null> {
  try {
    const useModel = model || (await resolveModel());
    if (!useModel) return null;
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: useModel,
        prompt,
        stream: false,
        keep_alive: opts.keepAlive ?? DEFAULT_KEEP_ALIVE,
        options: opts.numPredict ? { num_predict: opts.numPredict } : undefined,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      // Saved model might have just disappeared — invalidate cache so next call re-resolves.
      if (res.status === 404) clearModelCache();
      return null;
    }
    const data = (await res.json()) as { response: string };
    return data.response;
  } catch {
    return null;
  }
}

export async function ollamaChatStream(
  messages: { role: string; content: string }[],
  model?: string,
  opts: OllamaOpts = {},
): Promise<Response | null> {
  try {
    const useModel = model || (await resolveModel());
    if (!useModel) return null;
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: useModel,
        messages,
        stream: true,
        keep_alive: opts.keepAlive ?? DEFAULT_KEEP_ALIVE,
        options: opts.numPredict ? { num_predict: opts.numPredict } : undefined,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      if (res.status === 404) clearModelCache();
      return null;
    }
    return res;
  } catch {
    return null;
  }
}

/* ───────── JSON extraction (used by quiz/flashcard generators) ─────────
   Pulls a JSON value out of a string that may contain prose around it.
   Recovers from truncated arrays (model ran out of tokens) by salvaging the
   last complete items. */

export function extractJSON<T>(text: string): T | null {
  const candidates: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '[' || text[i] === '{') candidates.push(i);
  }
  if (candidates.length === 0) return null;

  for (const start of candidates) {
    const open = text[start];
    const close = open === '[' ? ']' : '}';
    const parsed = extractFromStart<T>(text, start, open, close);
    if (parsed !== null) return parsed;
  }
  return null;
}

function extractFromStart<T>(text: string, start: number, open: string, close: string): T | null {
  let depth = 0, inString = false, escape = false;
  let lastItemEnd = -1;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape)                  { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"')              { inString = !inString; continue; }
    if (inString)                continue;
    if (ch === open) depth++;
    if (ch === close) {
      depth--;
      if (depth === 0) {
        const parsed = parseAndUnwrap<T>(text.slice(start, i + 1));
        if (parsed !== null) return parsed;
        break;
      }
    }
    if (ch === '}' && depth === 1 && open === '[') lastItemEnd = i;
  }

  if (open === '[' && lastItemEnd > start) {
    return parseAndUnwrap<T>(text.slice(start, lastItemEnd + 1) + ']');
  }
  return null;
}

function parseAndUnwrap<T>(raw: string): T | null {
  const LDQUO = '“', RDQUO = '”', LSQUO = '‘', RSQUO = '’';
  const candidate = raw
    .replace(new RegExp(`[${LDQUO}${RDQUO}]`, 'g'), '"')
    .replace(new RegExp(`[${LSQUO}${RSQUO}]`, 'g'), '"')
    .replace(/,(\s*[}\]])/g, '$1');

  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (Array.isArray(parsed) && parsed.length === 1 && typeof parsed[0] === 'string') {
      try {
        const inner = JSON.parse(parsed[0] as string) as unknown;
        if (Array.isArray(inner) && inner.length > 0) return inner as T;
      } catch { /* fall through */ }
    }
    if (typeof parsed === 'string') {
      try {
        const inner = JSON.parse(parsed as string) as unknown;
        if (inner !== null) return inner as T;
      } catch { /* ignore */ }
    }
    return parsed as T;
  } catch {
    return null;
  }
}

/* ───────── Prompt builders (noble-shell heritage) ───────── */

export function flashcardSeedPrompt(topic: string): string {
  return `You are a senior systems engineer. Generate exactly 10 flashcards about "${topic}" for an engineer learning on the job.
Return ONLY a JSON array with no markdown or explanation:
[{"front": "question or term", "back": "concise answer or definition"}]`;
}

export function quizGeneratePrompt(topic: string): string {
  return `You are a technical trainer for aerospace/industrial systems engineers. Generate exactly 10 multiple-choice questions about "${topic}".
Return ONLY a JSON array with no markdown or explanation outside the JSON:
[{"question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "A) ...", "explanation": "brief explanation"}]`;
}

export function summaryPrompt(topic: string): string {
  return `Explain "${topic}" for a systems engineer learning on the job. Use markdown with these sections:
## What It Is
## Key Components
## How It Works
## Practical Use Cases
## Key Things to Remember
Be technical but clear. No fluff.`;
}

export function weakAreaPrompt(stats: { topic: string; score_pct: number }[]): string {
  return `A systems engineer has these quiz scores by topic: ${JSON.stringify(stats)}
List the 3 weakest areas and give one specific study recommendation each.
Return ONLY a JSON array with no markdown:
[{"topic": "...", "score_pct": 45, "recommendation": "..."}]`;
}

export function sequenceMemoryPrompt(topic: string): string {
  return `Generate 5 ordered steps for a process related to "${topic}" in systems engineering.
Return ONLY a JSON array with no markdown:
["Step 1: ...", "Step 2: ...", "Step 3: ...", "Step 4: ...", "Step 5: ..."]`;
}

/** Fire a 1-token generation to force the model to load into memory.
 *  Use to eliminate first-request cold-start latency. */
export async function ollamaWarmup(model?: string): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || getModel(),
        prompt: 'hi',
        stream: false,
        keep_alive: DEFAULT_KEEP_ALIVE,
        options: { num_predict: 1 },
      }),
      signal: AbortSignal.timeout(30000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Strip the model's own quoting / labels around scenario text. */
export function cleanScenarioText(raw: string): string {
  let t = raw.trim();
  // Remove "Scenario:" / "Statement:" / "Claim:" prefixes
  t = t.replace(/^(scenario|statement|claim|topic)\s*:\s*/i, '');
  // Strip surrounding quotes
  t = t.replace(/^["“'‘]+/, '').replace(/["”'’]+$/, '');
  // Strip trailing meta lines (e.g. "Difficulty: medium")
  t = t.split(/\n/).filter(line => !/^(difficulty|topic|category)\s*:/i.test(line.trim())).join('\n').trim();
  return t;
}
