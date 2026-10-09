export const runtime = 'nodejs';

import { ollamaGenerate, cleanScenarioText } from '@/lib/ollama';
import { scenarioPrompt } from '@/lib/prompts';
import { pickRandomTopic, type Difficulty } from '@/lib/steps';

const FALLBACK: Record<Difficulty, string[]> = {
  easy: [
    'Coffee in the morning makes you more productive.',
    'Cold showers are good for your health.',
    'Reading on a screen is just as good as reading on paper.',
    'Eating breakfast is essential for losing weight.',
    'Walking thirty minutes a day is all the exercise most people need.',
  ],
  medium: [
    'Remote work has hurt new employees more than it has helped them.',
    'Raising the minimum wage costs more jobs than it saves.',
    'Standardized tests are still the fairest way to compare students.',
    'Streaming services have made music worse for working musicians.',
    'Self-driving cars will be on most highways within the next decade.',
  ],
  hard: [
    'Privacy, as it existed in the 20th century, is permanently gone — and that is mostly fine.',
    'Free speech absolutism does more good than harm in democratic societies.',
    'It is wrong to bring a child into the world without their consent.',
    'Meritocracy is a comforting myth that mostly rewards inherited advantage.',
    'There is no meaningful moral difference between killing and letting die.',
  ],
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    topic?: string;
    difficulty?: Difficulty;
    customScenario?: string;
  };

  const difficulty: Difficulty = (['easy', 'medium', 'hard'] as const).includes(body.difficulty as Difficulty)
    ? (body.difficulty as Difficulty)
    : 'medium';

  // Custom scenario path: just echo it back.
  if (body.customScenario && body.customScenario.trim().length > 0) {
    return Response.json({
      scenario: body.customScenario.trim(),
      topic: body.topic?.trim() || 'custom',
      difficulty,
      source: 'custom',
    });
  }

  const topic = body.topic?.trim() || pickRandomTopic();
  const salt = Math.random().toString(36).slice(2, 8);
  const prompt = scenarioPrompt(topic, difficulty, salt);

  // Scenarios are short — 220 tokens is plenty and keeps generation under ~2s.
  const raw = await ollamaGenerate(prompt, undefined, { numPredict: 220 });
  if (raw) {
    const scenario = cleanScenarioText(raw);
    if (scenario.length > 8) {
      return Response.json({ scenario, topic, difficulty, source: 'ai' });
    }
  }

  const pool = FALLBACK[difficulty];
  const scenario = pool[Math.floor(Math.random() * pool.length)];
  return Response.json({ scenario, topic, difficulty, source: 'fallback' });
}
