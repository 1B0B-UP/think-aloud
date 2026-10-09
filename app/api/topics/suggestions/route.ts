export const runtime = 'nodejs';

import { getDb } from '@/lib/db';
import { generate } from '@/lib/ai';
import { extractJSON } from '@/lib/ollama';
import { readJson, requireString } from '@/lib/validation';
import { toDisplayString } from '@/lib/normalize';

interface Suggestion {
  name: string;
  description: string;
  icon: string;
}

const FALLBACKS: Record<string, Suggestion[]> = {
  control: [
    { name: 'Control Loop Tuning', description: 'Practical tuning, stability margin, and response tradeoffs', icon: '🎛️' },
    { name: 'Sensor Feedback Faults', description: 'Detecting bias, drift, dropout, and noisy feedback paths', icon: '📡' },
    { name: 'Actuator Saturation', description: 'Limits, windup, command shaping, and safe fallback behavior', icon: '🦾' },
  ],
  electrical: [
    { name: 'Power Distribution', description: 'Loads, breakers, voltage drop, grounding, and protection basics', icon: '⚡' },
    { name: 'Signal Integrity', description: 'Noise, shielding, impedance, filtering, and grounding effects', icon: '〰️' },
    { name: 'Motor Drives', description: 'VFDs, inrush current, torque curves, and control interfaces', icon: '🔌' },
  ],
  software: [
    { name: 'Interface Contracts', description: 'Schemas, versioning, API boundaries, and compatibility rules', icon: '🔗' },
    { name: 'Fault-Tolerant Services', description: 'Retries, backoff, health checks, and graceful degradation', icon: '🧩' },
    { name: 'Telemetry Pipelines', description: 'Metrics, logs, traces, and operational signal design', icon: '📈' },
  ],
};

export async function POST(req: Request) {
  let seed: string;
  try {
    const body = await readJson(req);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Request body must be an object');
    seed = requireString((body as Record<string, unknown>).name, 'name');
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Invalid request' }, { status: 400 });
  }

  const db = getDb();
  const existing = db.prepare('SELECT name FROM topics ORDER BY name ASC').all() as { name: string }[];
  const existingNames = existing.map(t => t.name);

  const prompt = `Suggest 5 related engineering study topics for "${seed}".
Avoid exact duplicates from this existing list: ${JSON.stringify(existingNames)}.
Return ONLY JSON:
[{"name":"...","description":"one short practical description","icon":"one emoji"}]`;

  const raw = await generate(prompt);
  const ai = raw ? normalizeSuggestions(extractJSON<unknown>(raw), existingNames) : [];
  const suggestions = ai.length > 0 ? ai : fallbackSuggestions(seed, existingNames);

  return Response.json({ suggestions: suggestions.slice(0, 5) });
}

function normalizeSuggestions(value: unknown, existingNames: string[]): Suggestion[] {
  if (!Array.isArray(value)) return [];
  const existing = new Set(existingNames.map(n => n.toLowerCase()));
  const seen = new Set<string>();

  return value.flatMap((item): Suggestion[] => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const name = toDisplayString(record.name ?? record.topic);
    const key = name.toLowerCase();
    if (!name || existing.has(key) || seen.has(key)) return [];
    seen.add(key);
    return [{
      name,
      description: toDisplayString(record.description ?? record.reason) || `Related practice area for ${name}.`,
      icon: toDisplayString(record.icon) || '🔧',
    }];
  });
}

function fallbackSuggestions(seed: string, existingNames: string[]): Suggestion[] {
  const lower = seed.toLowerCase();
  const pool = lower.includes('control') ? FALLBACKS.control
    : lower.includes('electric') || lower.includes('power') ? FALLBACKS.electrical
    : lower.includes('software') || lower.includes('api') || lower.includes('service') ? FALLBACKS.software
    : [...FALLBACKS.control, ...FALLBACKS.electrical, ...FALLBACKS.software];
  const existing = new Set(existingNames.map(n => n.toLowerCase()));
  return pool.filter(s => !existing.has(s.name.toLowerCase())).slice(0, 5);
}
