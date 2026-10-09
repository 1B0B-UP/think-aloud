export const runtime = 'nodejs';

import { ollamaChatStream } from '@/lib/ollama';
import { coachSystemPrompt } from '@/lib/prompts';
import type { StepKey, Difficulty } from '@/lib/steps';

interface CoachReqBody {
  scenario: string;
  stepKey: StepKey;
  difficulty: Difficulty;
  priorSteps: { stepKey: StepKey; userText: string }[];
  userText: string;
  hintRequested: boolean;
}

export async function POST(req: Request) {
  const body = (await req.json()) as CoachReqBody;

  const system = coachSystemPrompt({
    scenario: body.scenario,
    stepKey: body.stepKey,
    priorSteps: body.priorSteps || [],
    userText: body.userText,
    hintRequested: !!body.hintRequested,
    difficulty: body.difficulty,
  });

  const userMsg = body.hintRequested
    ? `I'm stuck. Give me a hint.\n\nMy current attempt: "${body.userText || '(nothing yet)'}"`
    : `My response to this step: "${body.userText}"`;

  // Coach replies are 2–3 sentences plus the small tag — 320 tokens is plenty.
  const ollamaRes = await ollamaChatStream([
    { role: 'system', content: system },
    { role: 'user', content: userMsg },
  ], undefined, { numPredict: 320 });

  if (!ollamaRes) {
    return new Response('AI unavailable. Please make sure Ollama is running.', { status: 503 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const reader = ollamaRes.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line) as { message?: { content: string }; done?: boolean };
              if (data.message?.content) {
                controller.enqueue(encoder.encode(data.message.content));
              }
            } catch {
              // skip malformed
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
