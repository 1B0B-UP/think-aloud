export const runtime = 'nodejs';

import { getDb } from '@/lib/db';
import { quizGeneratePrompt, extractJSON } from '@/lib/ollama';
import { generate } from '@/lib/ai';
import { fallbackQuizQuestions } from '@/lib/aiFallbacks';
import type { QuizQuestion } from '@/types';
import { normalizeQuizQuestions, parseTopicIdBody, readJson } from '@/lib/validation';

export async function POST(req: Request) {
  const db = getDb();
  let topicId: number;
  try {
    ({ topicId } = parseTopicIdBody(await readJson(req)));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Invalid request' }, { status: 400 });
  }

  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId) as { name: string } | undefined;
  if (!topic) return Response.json({ error: 'Topic not found' }, { status: 404 });

  const prompt = quizGeneratePrompt(topic.name);
  const raw = await generate(prompt);

  if (!raw) return Response.json({ error: 'AI unavailable' }, { status: 503 });

  const questions = normalizeQuizQuestions(extractJSON<QuizQuestion[]>(raw));
  if (questions.length === 0) {
    return Response.json({
      questions: fallbackQuizQuestions(topic.name),
      sessionId: crypto.randomUUID(),
      topicName: topic.name,
      warning: 'AI response could not be parsed, so local fallback questions were used.',
    });
  }

  const sessionId = crypto.randomUUID();
  return Response.json({ questions: questions.slice(0, 10), sessionId, topicName: topic.name });
}
