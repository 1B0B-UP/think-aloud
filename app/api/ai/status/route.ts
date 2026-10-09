export const runtime = 'nodejs';

import { ollamaOnline, getModel } from '@/lib/ollama';

export async function GET() {
  const status = await ollamaOnline();
  const model = getModel();
  const modelInstalled = status.models.some(m => m === model || m.startsWith(model + ':'));
  return Response.json({
    online: status.online,
    hasModels: status.hasModels,
    models: status.models,
    // Think-aloud added: full model verification
    model,
    modelInstalled,
  });
}
