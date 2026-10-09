export const runtime = 'nodejs';

import { ollamaWarmup } from '@/lib/ollama';

export async function POST() {
  const ok = await ollamaWarmup();
  return Response.json({ ok });
}
