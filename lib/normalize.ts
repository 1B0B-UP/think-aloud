import type { QuizQuestion, WeakArea } from '@/types';
import { resolveCorrectAnswer } from './quizMatch.ts';

type FlashcardDraft = {
  front: string;
  back: string;
  elaboration?: string | null;
};

export function toDisplayString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value.map(toDisplayString).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const preferredKeys = [
      'text',
      'content',
      'value',
      'label',
      'answer',
      'question',
      'definition',
      'description',
      'explanation',
      'recommendation',
      'study',
      'title',
      'name',
    ];

    for (const key of preferredKeys) {
      const rendered = toDisplayString(record[key]);
      if (rendered) return rendered;
    }

    return Object.entries(record)
      .map(([key, nested]) => {
        const rendered = toDisplayString(nested);
        return rendered ? `${key}: ${rendered}` : '';
      })
      .filter(Boolean)
      .join('; ');
  }
  return '';
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(toDisplayString).filter(Boolean);
}

export function normalizeQuizQuestions(value: unknown): QuizQuestion[] {
  const unwrapped = unwrapArray(value, ['questions', 'quiz', 'items', 'data', 'result']);
  if (unwrapped !== value) return normalizeQuizQuestions(unwrapped);
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): QuizQuestion[] => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const question = toDisplayString(record.question);
    const options = normalizeStringArray(record.options);
    const rawAnswer = record.answer ?? record.correct_answer ?? record.correctAnswer;
    const answer = resolveCorrectAnswer(rawAnswer, options);
    const explanation = toDisplayString(record.explanation ?? record.rationale ?? record.reason);

    if (!question || options.length < 2 || !answer) return [];

    return [{
      question,
      options,
      answer,
      explanation: explanation || 'No explanation provided.',
    }];
  });
}

export function normalizeFlashcardDrafts(value: unknown): FlashcardDraft[] {
  const unwrapped = unwrapArray(value, ['flashcards', 'cards', 'items', 'data', 'result']);
  if (unwrapped !== value) return normalizeFlashcardDrafts(unwrapped);
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): FlashcardDraft[] => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const front = toDisplayString(record.front ?? record.question ?? record.term ?? record.prompt);
    const back = toDisplayString(record.back ?? record.answer ?? record.definition ?? record.response);
    const elaboration = toDisplayString(record.elaboration ?? record.why ?? record.context);

    if (!front || !back) return [];
    return [{ front, back, elaboration: elaboration || null }];
  });
}

export function normalizeWeakAreas(value: unknown): WeakArea[] {
  const unwrapped = unwrapArray(value, ['weakAreas', 'weak_areas', 'areas', 'items', 'data', 'result']);
  if (unwrapped !== value) return normalizeWeakAreas(unwrapped);
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): WeakArea[] => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const topic = toDisplayString(record.topic);
    const recommendation = toDisplayString(record.recommendation ?? record.study);
    const numericScore = Number(record.score_pct);

    if (!topic || !recommendation) return [];
    return [{
      topic,
      score_pct: Number.isFinite(numericScore) ? numericScore : 0,
      recommendation,
    }];
  });
}

export function normalizeSequenceSteps(value: unknown): string[] {
  const unwrapped = unwrapArray(value, ['steps', 'sequence', 'items', 'data', 'result']);
  return normalizeStringArray(unwrapped).filter(Boolean);
}

function unwrapArray(value: unknown, keys: string[]): unknown {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key];
  }
  return value;
}
